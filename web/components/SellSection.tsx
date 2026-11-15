"use client";

import { useState } from "react";
import { explorerTx } from "@/lib/contract";
import { useWallet } from "./wallet";
import { WalletButton } from "./ui";
import s from "@/app/market.module.css";

export function SellSection({ onPosted }: { onPosted: () => void }) {
  const { account, createBounty } = useWallet();
  const [item, setItem] = useState("AirPods Pro 2 (USB-C)");
  const [msrp, setMsrp] = useState("249.00");
  const [sharePct, setSharePct] = useState("20");
  const [escrow, setEscrow] = useState("0.1");
  const [days, setDays] = useState("7");
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setTx(null);
    try {
      const refPriceCents = BigInt(Math.round(parseFloat(msrp) * 100));
      const pct = Number(sharePct);
      if (!item.trim()) throw new Error("Item name is required");
      if (!(refPriceCents > 0n)) throw new Error("MSRP must be greater than 0");
      if (!(pct >= 1 && pct <= 100)) throw new Error("Finder share must be 1–100%");
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);

      setBusy(true);
      const hash = await createBounty({ item: item.trim(), refPriceCents, sharePct: pct, expiry, escrowMon: escrow });
      setTx(hash);
      onPosted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.sell}>
      <div className={s.sellIntro}>
        <h2>Post a bounty</h2>
        <p>
          Escrow MON against the MSRP of an item you want. A finder who beats the price earns their
          share of the savings; you get the rest refunded. No deal before expiry → full refund.
        </p>
      </div>

      <div className={s.card}>
        <label className={s.field}>
          <span>Item</span>
          <input value={item} onChange={(e) => setItem(e.target.value)} />
        </label>

        <div className={s.row}>
          <label className={s.field}>
            <span>MSRP (USD)</span>
            <input value={msrp} onChange={(e) => setMsrp(e.target.value)} inputMode="decimal" />
          </label>
          <label className={s.field}>
            <span>Finder share %</span>
            <input value={sharePct} onChange={(e) => setSharePct(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        <div className={s.row}>
          <label className={s.field}>
            <span>Escrow (MON)</span>
            <input value={escrow} onChange={(e) => setEscrow(e.target.value)} inputMode="decimal" />
          </label>
          <label className={s.field}>
            <span>Expires in (days)</span>
            <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        {account ? (
          <button className={s.primaryBtn} onClick={submit} disabled={busy}>
            {busy ? "Posting…" : "Post bounty"}
          </button>
        ) : (
          <WalletButton />
        )}

        {err && <p className={s.error}>⚠ {err}</p>}
        {tx && (
          <p className={s.success}>
            ✓ Bounty posted!{" "}
            <a href={explorerTx(tx)} target="_blank" rel="noreferrer">
              View transaction ↗
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
