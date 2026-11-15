import "server-only";
import { encodePacked, isAddress, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export class OracleError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ---------- config ----------

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export function getConfig() {
  const pk = process.env.ORACLE_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new OracleError("config", "ORACLE_PRIVATE_KEY is missing or malformed", 500);
  }
  const account = privateKeyToAccount(pk as Hex);

  const chainId = Number(process.env.CHAIN_ID ?? "10143");
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new OracleError("config", "CHAIN_ID is invalid", 500);
  }

  const contract = (process.env.CONTRACT_ADDRESS || ZERO) as Address;
  if (!isAddress(contract)) {
    throw new OracleError("config", "CONTRACT_ADDRESS is not a valid address", 500);
  }

  return { account, chainId, contract, contractIsPlaceholder: contract.toLowerCase() === ZERO };
}

export function allowedHosts(): string[] {
  const hosts = (process.env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  // Vercel sets these automatically, so the deployment can always quote its own mock stores.
  for (const v of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (v) hosts.push(v.toLowerCase());
  }
  return [...new Set(hosts)];
}

// ---------- url validation ----------

export function checkUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    throw new OracleError("bad_url", "url must be a non-empty string (max 2048 chars)");
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new OracleError("bad_url", "url is not a valid absolute URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new OracleError("bad_url", "url must be http or https");
  }
  if (u.username || u.password) {
    throw new OracleError("bad_url", "url must not contain credentials");
  }
  const allowed = allowedHosts();
  if (!allowed.includes(u.hostname.toLowerCase())) {
    throw new OracleError("bad_host", `host "${u.hostname}" is not in ALLOWED_HOSTS`, 403);
  }
  return u;
}

// ---------- fetch ----------

const MAX_BYTES = 2_000_000;

export async function fetchPage(start: URL): Promise<string> {
  let url = start;
  // Follow redirects manually so every hop is re-checked against the allowlist.
  for (let hop = 0; hop < 4; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "MonadFLIP-Oracle/0.1", accept: "text/html,*/*" },
      });
    } catch (e) {
      throw new OracleError("fetch_failed", `could not fetch page: ${(e as Error).message}`, 502);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new OracleError("fetch_failed", "redirect without location", 502);
      url = checkUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) {
      throw new OracleError("fetch_failed", `page returned HTTP ${res.status}`, 502);
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new OracleError("fetch_failed", "page too large", 502);
    return text;
  }
  throw new OracleError("fetch_failed", "too many redirects", 502);
}

// ---------- price extraction ----------

/** "1,299.5" | 1299.5 | "$189" -> integer cents, string-based to avoid float error. */
export function toCents(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim().replace(/[$,\s]/g, "");
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0").slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

type Found = { cents: number; currency: string | null; source: string };

function isProduct(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  return t === "Product" || (Array.isArray(t) && t.includes("Product"));
}

function priceFromOffer(o: unknown): { cents: number; currency: string | null } | null {
  if (!o || typeof o !== "object") return null;
  const offer = o as Record<string, unknown>;
  const spec = offer.priceSpecification as Record<string, unknown> | undefined;
  const cents =
    toCents(offer.price) ?? toCents(offer.lowPrice) ?? (spec ? toCents(spec.price) : null);
  if (cents === null) return null;
  const currency = (offer.priceCurrency ?? spec?.priceCurrency ?? null) as string | null;
  return { cents, currency };
}

function walkJsonLd(node: unknown): Found | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = walkJsonLd(n);
      if (r) return r;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (isProduct(obj) && obj.offers) {
    const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
    for (const o of offers) {
      const p = priceFromOffer(o);
      if (p) return { ...p, source: "json-ld" };
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const r = walkJsonLd(v);
      if (r) return r;
    }
  }
  return null;
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  return out;
}

export function extractPrice(html: string): Found | null {
  // 1. JSON-LD Product offers.price
  const scriptRe =
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html))) {
    try {
      const r = walkJsonLd(JSON.parse(m[1].trim()));
      if (r) return r;
    } catch {
      // malformed block: try the next one
    }
  }

  // 2. meta[itemprop=price], then og:price:amount / product:price:amount
  const metas = (html.match(/<meta\b[^>]*>/gi) ?? []).map(parseAttrs);
  const get = (pred: (a: Record<string, string>) => boolean) =>
    metas.find((a) => pred(a) && a.content)?.content;
  const currency =
    get((a) => a.itemprop === "pricecurrency") ??
    get((a) => a.property === "og:price:currency" || a.property === "product:price:currency") ??
    null;

  const itemprop = toCents(get((a) => a.itemprop === "price"));
  if (itemprop) return { cents: itemprop, currency, source: "meta-itemprop" };

  const og = toCents(
    get((a) => a.property === "og:price:amount" || a.property === "product:price:amount"),
  );
  if (og) return { cents: og, currency, source: "og-price" };

  return null;
}

// ---------- signing ----------

/** Must match Solidity: keccak256(abi.encodePacked(id, url, priceCents, block.chainid, address(this))) */
export function quoteHash(
  bountyId: bigint,
  url: string,
  priceCents: bigint,
  chainId: bigint,
  contract: Address,
): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "string", "uint256", "uint256", "address"],
      [bountyId, url, priceCents, chainId, contract],
    ),
  );
}

export function parseBountyId(v: unknown): bigint {
  const s = typeof v === "number" ? String(v) : v;
  if (typeof s !== "string" || !/^\d{1,78}$/.test(s)) {
    throw new OracleError("bad_bounty_id", "bountyId must be a non-negative integer");
  }
  const id = BigInt(s);
  if (id >= BigInt(2) ** BigInt(256)) {
    throw new OracleError("bad_bounty_id", "bountyId exceeds uint256");
  }
  return id;
}
