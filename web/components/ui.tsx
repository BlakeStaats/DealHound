"use client";

import type { Hex } from "viem";
import { useWallet } from "./wallet";
import { QuoteError } from "@/lib/friendly";
import { matchingDemoProducts } from "@/lib/match";
import { classifyCategory } from "@/lib/categories";
import s from "@/app/market.module.css";

export function shortAddr(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/** The headline savings label used on marketplace + NFT cards. */
export function DiscountBadge({ pct, size = "md" }: { pct: number; size?: "md" | "lg" }) {
  if (pct <= 0) return null;
  return <span className={`${s.badge} ${size === "lg" ? s.badgeLg : ""}`}>−{pct}% vs MSRP</span>;
}

export function WalletButton() {
  const { account, connect, connecting, hasWallet } = useWallet();
  if (account) return <span className={s.walletPill}>🟢 {shortAddr(account)}</span>;
  return (
    <button
      className={s.walletBtn}
      disabled={connecting}
      onClick={() => connect().catch((e) => alert(e.message))}
    >
      {connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "Install a wallet"}
    </button>
  );
}

// ---------- agents vs humans ----------

// Wallets known to be bots, e.g. the hunter bot's address. Comma-separated, set on Vercel.
const AGENTS = (process.env.NEXT_PUBLIC_AGENT_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

export function isAgent(addr?: string): boolean {
  return !!addr && AGENTS.includes(addr.toLowerCase());
}

export function HunterBadge({ addr }: { addr: string }) {
  const agent = isAgent(addr);
  return (
    <span className={agent ? s.agentBadge : s.humanBadge} title={addr}>
      {agent ? "🤖 Agent" : "🧑 Human"} {shortAddr(addr)}
    </span>
  );
}

// ---------- product tile + countdown ----------

const TILE_BG: Record<string, string> = {
  tech: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
  apparel: "linear-gradient(135deg,#fee2e2,#fecaca)",
  home: "linear-gradient(135deg,#dcfce7,#bbf7d0)",
  gaming: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
  beauty: "linear-gradient(135deg,#fce7f3,#fbcfe8)",
  other: "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
};

export function ProductTile({ item, size = 56 }: { item: string; size?: number }) {
  const cat = classifyCategory(item);
  const emoji = matchingDemoProducts(item)[0]?.emoji ?? cat.icon;
  return (
    <div
      className={s.tile}
      style={{ width: size, height: size, fontSize: size * 0.5, background: TILE_BG[cat.id] ?? TILE_BG.other }}
      aria-hidden="true"
    >
      {emoji}
    </div>
  );
}

export function timeLeft(expiry: bigint): string {
  const secs = Number(expiry) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "expired";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ---------- oracle ----------

export type Quote = {
  bountyId: string;
  url: string;
  priceCents: number;
  sig: Hex;
  oracle: string;
  priceSource: string;
  productName?: string;
};

/** Ask the oracle to scrape a product URL and sign the price. Throws QuoteError. */
export async function scrapeQuote(bountyId: bigint, url: string): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bountyId: bountyId.toString(), url }),
    });
  } catch {
    throw new QuoteError("network", "Couldn't reach the price oracle.");
  }
  const data = await res.json();
  if (!res.ok) throw new QuoteError(data.error ?? "unknown", data.message ?? "quote failed");
  return data as Quote;
}
