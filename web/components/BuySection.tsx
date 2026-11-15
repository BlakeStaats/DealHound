"use client";

import { useState } from "react";
import {
  Bounty,
  BountyStatus,
  discountPct,
  explorerTx,
  finderEarnedUsd,
  usd,
} from "@/lib/contract";
import { STORES } from "@/lib/stores";
import { useBounties, useWallet } from "./wallet";
import { DiscountBadge, Quote, WalletButton, scrapeQuote, shortAddr } from "./ui";
import { formatEther } from "viem";
import s from "@/app/market.module.css";

export function BuySection({ bountiesHook }: { bountiesHook: ReturnType<typeof useBounties> }) {
  const { bounties, loading, error, refresh } = bountiesHook;
  const open = bounties.filter((b) => b.status === BountyStatus.Open);

  return (
    <section>
      <div className={s.sectionHead}>
        <h2>Open bounties</h2>
        <button className={s.ghostBtn} onClick={() => void refresh()}>
          ↻ Refresh
        </button>
      </div>

      {loading && <p className={s.muted}>Loading bounties from Monad…</p>}
      {error && <p className={s.error}>⚠ {error}</p>}
      {!loading && open.length === 0 && (
        <div className={s.empty}>
          No open bounties yet. Head to the <strong>Sell</strong> tab to post one.
        </div>
      )}

      <div className={s.grid}>
        {open.map((b) => (
          <OpenBountyCard key={b.id.toString()} bounty={b} onFilled={() => void refresh()} />
        ))}
      </div>
    </section>
  );
}

type StoreState = { quote?: Quote; loading?: boolean; error?: string };

function OpenBountyCard({ bounty, onFilled }: { bounty: Bounty; onFilled: () => void }) {
  const { account, submitDeal } = useWallet();
  const [states, setStates] = useState<Record<string, StoreState>>({});
  const [tx, setTx] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function scrape(slug: string) {
    setStates((p) => ({ ...p, [slug]: { loading: true } }));
    try {
      const url = `${window.location.origin}/stores/${slug}`;
      const quote = await scrapeQuote(bounty.id, url);
      setStates((p) => ({ ...p, [slug]: { quote } }));
    } catch (e) {
      setStates((p) => ({ ...p, [slug]: { error: (e as Error).message } }));
    }
  }

  async function submit(quote: Quote) {
    setSubmitErr(null);
    setSubmitting(quote.url);
    try {
      const hash = await submitDeal({
        id: bounty.id,
        url: quote.url,
        priceCents: BigInt(quote.priceCents),
        oracleSig: quote.sig,
      });
      setTx(hash);
      onFilled();
    } catch (e) {
      setSubmitErr((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <article className={s.card}>
      <div className={s.cardHead}>
        <h3>{bounty.item}</h3>
        <span className={s.id}>#{bounty.id.toString()}</span>
      </div>

      <div className={s.meta}>
        <span>
          MSRP <strong>{usd(bounty.refPriceCents)}</strong>
        </span>
        <span>
          Escrow <strong>{formatEther(bounty.escrow)} MON</strong>
        </span>
        <span>
          Finder share <strong>{bounty.sharePct}%</strong>
        </span>
      </div>

      <div className={s.approved}>
        <div className={s.approvedLabel}>🤖 Agent · approved marketplaces</div>
        {STORES.map((store) => {
          const st = states[store.slug] ?? {};
          const q = st.quote;
          const pct = q ? discountPct(bounty.refPriceCents, BigInt(q.priceCents)) : 0;
          return (
            <div key={store.slug} className={s.storeRow}>
              <div className={s.storeInfo}>
                <span className={s.storeName}>{store.name}</span>
                {q ? (
                  <span className={s.storeQuote}>
                    {usd(q.priceCents)} <DiscountBadge pct={pct} />
                  </span>
                ) : (
                  <span className={s.muted}>not checked</span>
                )}
              </div>

              {!q && (
                <button
                  className={s.ghostBtn}
                  disabled={st.loading}
                  onClick={() => scrape(store.slug)}
                >
                  {st.loading ? "Scraping…" : "Scrape with agent"}
                </button>
              )}

              {q && account && (
                <button
                  className={s.primaryBtn}
                  disabled={submitting === q.url}
                  onClick={() => submit(q)}
                >
                  {submitting === q.url ? "Submitting…" : `Submit · earn ${finderEarnedUsd(bounty.refPriceCents, BigInt(q.priceCents), bounty.sharePct)}`}
                </button>
              )}
              {st.error && <span className={s.errorSm}>⚠ {st.error}</span>}
            </div>
          );
        })}
        {!account && (
          <div className={s.connectHint}>
            <WalletButton /> <span className={s.muted}>to submit a verified deal</span>
          </div>
        )}
      </div>

      {submitErr && <p className={s.error}>⚠ {submitErr}</p>}
      {tx && (
        <p className={s.success}>
          ✓ Deal submitted — NFT minting.{" "}
          <a href={explorerTx(tx)} target="_blank" rel="noreferrer">
            View tx ↗
          </a>
        </p>
      )}
      <div className={s.posterLine}>posted by {shortAddr(bounty.poster)}</div>
    </article>
  );
}
