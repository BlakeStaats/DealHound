// Demo hunter bot: poll open bounties, quote demo stores, submit the best deal.
// Usage: npm run hunter   (loads web/.env.local)
//
// Env:
//   HUNTER_PRIVATE_KEY  — funded Monad testnet wallet that calls submitDeal
//   HUNTER_BASE_URL     — app origin (default http://localhost:3000)
//   CONTRACT_ADDRESS    — DealBounty (defaults to deployed testnet address)
//   RPC_URL / MONAD_RPC_URL / NEXT_PUBLIC_MONAD_RPC_URL — chain RPC
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddressEqual,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CONTRACT_ADDRESS,
  DEAL_BOUNTY_ABI,
  getRpcUrl,
  monadTestnet,
  type OpenBountyJson,
} from "../lib/contract";
import { STORES } from "../lib/stores";

const BASE = (process.env.HUNTER_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const POLL_MS = 3000;

type Quote = {
  bountyId: string;
  url: string;
  priceCents: number;
  sig: Hex;
};

function log(step: string, detail?: unknown) {
  const ts = new Date().toISOString().slice(11, 19);
  if (detail === undefined) console.log(`[${ts}] ${step}`);
  else console.log(`[${ts}] ${step}`, detail);
}

async function fetchOpenBounties(): Promise<OpenBountyJson[]> {
  const res = await fetch(`${BASE}/api/bounties`);
  const data = (await res.json()) as { bounties?: OpenBountyJson[]; message?: string };
  if (!res.ok) throw new Error(data.message ?? `GET /api/bounties → ${res.status}`);
  return data.bounties ?? [];
}

async function quote(bountyId: string, url: string): Promise<Quote> {
  const res = await fetch(`${BASE}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bountyId, url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? `quote failed (${res.status})`);
  return data as Quote;
}

async function main() {
  const pk = process.env.HUNTER_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error("HUNTER_PRIVATE_KEY missing or malformed (set in .env.local)");
  }

  const account = privateKeyToAccount(pk as Hex);
  const rpc = getRpcUrl();
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(rpc) });
  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(rpc),
  });

  log("hunter starting", {
    address: account.address,
    base: BASE,
    contract: CONTRACT_ADDRESS,
    rpc,
    pollMs: POLL_MS,
  });

  const seen = new Set<string>();

  for (;;) {
    try {
      log("poll GET /api/bounties");
      const bounties = await fetchOpenBounties();
      log(`open bounties: ${bounties.length}`);

      for (const b of bounties) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);

        const ref = BigInt(b.refPriceCents);
        log(`new bounty #${b.id}`, { item: b.item, refPriceCents: b.refPriceCents, sharePct: b.sharePct });

        const candidates: Quote[] = [];
        for (const store of STORES) {
          const url = `${BASE}/stores/${store.slug}`;
          log(`  quote ${store.name}`, url);
          try {
            const q = await quote(b.id, url);
            log(`  → ${q.priceCents} cents`, { beats: BigInt(q.priceCents) < ref, signedUrl: q.url });
            if (BigInt(q.priceCents) < ref) candidates.push(q);
          } catch (e) {
            log(`  quote failed (${store.slug})`, (e as Error).message);
          }
        }

        if (candidates.length === 0) {
          log(`  no price below reference for #${b.id} — skipping submit`);
          continue;
        }

        candidates.sort((a, c) => a.priceCents - c.priceCents);
        const best = candidates[0];
        log(`  best deal`, { priceCents: best.priceCents, url: best.url });

        // CRITICAL: submit the exact url returned by /api/quote
        log(`  submitDeal(#${b.id}, quote.url, ${best.priceCents}, sig)`);
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: DEAL_BOUNTY_ABI,
          functionName: "submitDeal",
          args: [BigInt(b.id), best.url, BigInt(best.priceCents), best.sig],
        });
        log(`  tx sent`, hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        log(`  mined status=${receipt.status}`, { block: receipt.blockNumber.toString() });

        if (receipt.status === "success") {
          const after = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: DEAL_BOUNTY_ABI,
            functionName: "bounties",
            args: [BigInt(b.id)],
          });
          const finder = (after as readonly Address[])[6];
          log(
            `  filled — finder ${finder}${isAddressEqual(finder, account.address) ? " (us)" : ""}`,
          );
        }
      }
    } catch (e) {
      log("poll error", (e as Error).message);
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
