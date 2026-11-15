"use client";

import type { Hex } from "viem";
import { useWallet } from "./wallet";
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

export type Quote = {
  bountyId: string;
  url: string;
  priceCents: number;
  sig: Hex;
  oracle: string;
  priceSource: string;
};

/** Ask the oracle agent to scrape an approved marketplace URL and sign the price. */
export async function scrapeQuote(bountyId: bigint, url: string): Promise<Quote> {
  const res = await fetch("/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bountyId: bountyId.toString(), url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "scrape failed");
  return data as Quote;
}
