// Shared, client-safe contract + chain config for the MonadFLIP marketplace.
import type { Address, Chain } from "viem";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x629751D83702E11FFbB84a44fE9990a5E36B4501") as Address;

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz"],
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

// Minimal ABI — just what the marketplace reads/writes.
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
