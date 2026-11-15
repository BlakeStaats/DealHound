// Shared contract + chain config for the MonadFLIP marketplace (client + server).
import {
  createPublicClient,
  http,
  type Address,
  type Chain,
} from "viem";

/** Prefer public (browser) env, then server-only CONTRACT_ADDRESS, then deployed testnet address. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  process.env.CONTRACT_ADDRESS ??
  "0x629751D83702E11FFbB84a44fE9990a5E36B4501") as Address;

/** RPC for reads. Server: RPC_URL / MONAD_RPC_URL; browser: NEXT_PUBLIC_MONAD_RPC_URL. */
export function getRpcUrl(): string {
  return (
    process.env.RPC_URL ??
    process.env.MONAD_RPC_URL ??
    process.env.NEXT_PUBLIC_MONAD_RPC_URL ??
    "https://testnet-rpc.monad.xyz"
  );
}

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [getRpcUrl()],
    },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
} as const satisfies Chain;

export function explorerTx(hash: string): string {
  return `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
}
export function explorerAddress(addr: string): string {
  return `${monadTestnet.blockExplorers.default.url}/address/${addr}`;
}

// Minimal ABI — matches src/DealBounty.sol (nextId, bounties, createBounty, submitDeal, refund).
export const DEAL_BOUNTY_ABI = [
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "oracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "bounties",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "poster", type: "address" },
      { name: "expiry", type: "uint64" },
      { name: "sharePct", type: "uint8" },
      { name: "status", type: "uint8" }, // 0 Open, 1 Filled, 2 Refunded
      { name: "refPriceCents", type: "uint256" },
      { name: "escrow", type: "uint256" },
      { name: "finder", type: "address" },
      { name: "foundPriceCents", type: "uint256" },
      { name: "payout", type: "uint256" },
      { name: "item", type: "string" },
      { name: "url", type: "string" },
    ],
  },
  {
    type: "function",
    name: "createBounty",
    stateMutability: "payable",
    inputs: [
      { name: "item", type: "string" },
      { name: "refPriceCents", type: "uint256" },
      { name: "sharePct", type: "uint8" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitDeal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "url", type: "string" },
      { name: "priceCents", type: "uint256" },
      { name: "oracleSig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
] as const;

// ---------- domain model ----------

export enum BountyStatus {
  Open = 0,
  Filled = 1,
  Refunded = 2,
}

export type Bounty = {
  id: bigint;
  poster: Address;
  expiry: bigint;
  sharePct: number;
  status: BountyStatus;
  refPriceCents: bigint; // MSRP / reference price
  escrow: bigint; // wei MON
  finder: Address;
  foundPriceCents: bigint;
  payout: bigint; // wei MON paid to finder
  item: string;
  url: string;
};

/** JSON shape returned by GET /api/bounties (open + unexpired only). */
export type OpenBountyJson = {
  id: string;
  item: string;
  refPriceCents: string;
  sharePct: number;
  escrow: string; // wei
  expiry: string; // unix seconds
};

export function createDealPublicClient() {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(getRpcUrl()),
  });
}

/** Read every bounty via nextId + bounties(i). */
export async function readAllBounties(): Promise<Bounty[]> {
  const client = createDealPublicClient();
  const count = (await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: DEAL_BOUNTY_ABI,
    functionName: "nextId",
  })) as bigint;

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const results = await Promise.all(
    ids.map((id) =>
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: DEAL_BOUNTY_ABI,
        functionName: "bounties",
        args: [id],
      }),
    ),
  );

  return results.map((r, i) => {
    const b = r as readonly [
      Address,
      bigint,
      number,
      number,
      bigint,
      bigint,
      Address,
      bigint,
      bigint,
      string,
      string,
    ];
    return {
      id: ids[i],
      poster: b[0],
      expiry: b[1],
      sharePct: Number(b[2]),
      status: b[3] as BountyStatus,
      refPriceCents: b[4],
      escrow: b[5],
      finder: b[6],
      foundPriceCents: b[7],
      payout: b[8],
      item: b[9],
      url: b[10],
    } satisfies Bounty;
  });
}

/** Open + not past expiry (for hunters / GET /api/bounties). */
export async function readOpenUnexpiredBounties(nowSec = Math.floor(Date.now() / 1000)): Promise<Bounty[]> {
  const all = await readAllBounties();
  return all.filter((b) => b.status === BountyStatus.Open && Number(b.expiry) > nowSec);
}

export function toOpenBountyJson(b: Bounty): OpenBountyJson {
  return {
    id: b.id.toString(),
    item: b.item,
    refPriceCents: b.refPriceCents.toString(),
    sharePct: b.sharePct,
    escrow: b.escrow.toString(),
    expiry: b.expiry.toString(),
  };
}

// ---------- pure money helpers ----------

export function usd(cents: bigint | number): string {
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Discount of a found price vs its MSRP, as a whole percent (e.g. 24). */
export function discountPct(msrpCents: bigint, foundCents: bigint): number {
  if (msrpCents <= 0n || foundCents >= msrpCents) return 0;
  return Math.round((Number(msrpCents - foundCents) / Number(msrpCents)) * 100);
}

export function savingsCents(msrpCents: bigint, foundCents: bigint): bigint {
  return foundCents >= msrpCents ? 0n : msrpCents - foundCents;
}

/** Finder's USD cut = sharePct% of the savings. Matches on-chain payout proportion. */
export function finderEarnedUsd(msrpCents: bigint, foundCents: bigint, sharePct: number): string {
  const earnedCents = (Number(savingsCents(msrpCents, foundCents)) * sharePct) / 100;
  return usd(earnedCents);
}

/** MON (wei) the finder is paid. Same integer math as DealBounty.submitDeal. */
export function payoutWei(escrow: bigint, sharePct: number, refPriceCents: bigint, foundCents: bigint): bigint {
  if (foundCents >= refPriceCents || refPriceCents === BigInt(0)) return BigInt(0);
  return (escrow * BigInt(sharePct) * (refPriceCents - foundCents)) / (BigInt(100) * refPriceCents);
}

/** Short MON amount for display, e.g. 0.0048 MON. */
export function mon(wei: bigint): string {
  const n = Number(wei) / 1e18;
  if (n === 0) return "0 MON";
  if (n >= 1) return `${n.toLocaleString("en-US", { maximumFractionDigits: 3 })} MON`;
  return `${n.toPrecision(2)} MON`;
}
