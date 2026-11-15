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
          No open bounties yet. Head to <strong>Post a bounty</strong> to create one.
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

type QuoteState = { quote?: Quote; loading?: boolean; error?: string };

function OpenBountyCard({ bounty, onFilled }: { bounty: Bounty; onFilled: () => void }) {
  const { account, submitDeal } = useWallet();
  const [urlInput, setUrlInput] = useState("");
  const [custom, setCustom] = useState<QuoteState>({});
  const [demoStates, setDemoStates] = useState<Record<string, QuoteState>>({});
  const [tx, setTx] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function quoteUrl(url: string, setState: (st: QuoteState) => void) {
    setState({ loading: true });
    try {
      const quote = await scrapeQuote(bounty.id, url);
      setState({ quote });
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }

  async function scrapeDemo(slug: string) {
    const url = `${window.location.origin}/stores/${slug}`;
    await quoteUrl(url, (st) => setDemoStates((p) => ({ ...p, [slug]: st })));
  }

  async function quoteCustom() {
    const url = urlInput.trim();
    if (!url) {
      setCustom({ error: "Paste a product URL first" });
      return;
    }
    await quoteUrl(url, setCustom);
  }

  async function submit(quote: Quote) {
    setSubmitErr(null);
    setSubmitting(quote.url);
    try {
      // Must submit the exact url returned by /api/quote (oracle signs that string).
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

  function QuoteResult({ quote, label }: { quote: Quote; label?: string }) {
    const beats = BigInt(quote.priceCents) < bounty.refPriceCents;
    const pct = discountPct(bounty.refPriceCents, BigInt(quote.priceCents));
    return (
      <div className={s.quoteResult}>
        {label && <div className={s.storeName}>{label}</div>}
        <div className={s.storeQuote}>
          Verified {usd(quote.priceCents)}{" "}
          {beats ? (
            <DiscountBadge pct={pct} />
          ) : (
            <span className={s.noBeat}>does not beat {usd(bounty.refPriceCents)}</span>
          )}
        </div>
        <div className={s.quoteUrl} title={quote.url}>
          signed url: {quote.url}
        </div>
        {beats && account && (
          <button
            className={s.primaryBtn}
            disabled={submitting === quote.url}
            onClick={() => submit(quote)}
          >
            {submitting === quote.url
              ? "Submitting…"
              : `Submit deal · earn ${finderEarnedUsd(bounty.refPriceCents, BigInt(quote.priceCents), bounty.sharePct)}`}
          </button>
        )}
        {beats && !account && (
          <div className={s.connectHint}>
            <WalletButton /> <span className={s.muted}>to submit this deal</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <article className={s.card}>
      <div className={s.cardHead}>
        <h3>{bounty.item}</h3>
        <span className={s.id}>#{bounty.id.toString()}</span>
      </div>

      <div className={s.meta}>
        <span>
          Reference <strong>{usd(bounty.refPriceCents)}</strong>
        </span>
        <span>
          Escrow <strong>{formatEther(bounty.escrow)} MON</strong>
        </span>
        <span>
          Finder share <strong>{bounty.sharePct}%</strong>
        </span>
      </div>

      <div className={s.huntUrl}>
        <div className={s.approvedLabel}>Product URL</div>
        <div className={s.urlRow}>
          <input
            className={s.urlInput}
            placeholder="https://…/product"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button className={s.ghostBtn} disabled={custom.loading} onClick={() => void quoteCustom()}>
            {custom.loading ? "Quoting…" : "Get quote"}
          </button>
        </div>
        {custom.error && <span className={s.errorSm}>⚠ {custom.error}</span>}
        {custom.quote && <QuoteResult quote={custom.quote} />}
      </div>

      <div className={s.approved}>
        <div className={s.approvedLabel}>Try demo stores</div>
        {STORES.map((store) => {
          const st = demoStates[store.slug] ?? {};
          return (
            <div key={store.slug} className={s.storeRow}>
              <div className={s.storeInfo}>
                <span className={s.storeName}>{store.name}</span>
                {!st.quote && !st.error && <span className={s.muted}>not checked</span>}
                {st.quote && (
                  <span className={s.storeQuote}>
                    {usd(st.quote.priceCents)}{" "}
                    {BigInt(st.quote.priceCents) < bounty.refPriceCents ? (
                      <DiscountBadge
                        pct={discountPct(bounty.refPriceCents, BigInt(st.quote.priceCents))}
                      />
                    ) : (
                      <span className={s.noBeat}>no beat</span>
                    )}
                  </span>
                )}
              </div>

              {!st.quote && (
                <button
                  className={s.ghostBtn}
                  disabled={st.loading}
                  onClick={() => void scrapeDemo(store.slug)}
                >
                  {st.loading ? "Quoting…" : "Quote"}
                </button>
              )}

              {st.quote && BigInt(st.quote.priceCents) < bounty.refPriceCents && account && (
                <button
                  className={s.primaryBtn}
                  disabled={submitting === st.quote.url}
                  onClick={() => submit(st.quote!)}
                >
                  {submitting === st.quote.url
                    ? "Submitting…"
                    : `Submit · earn ${finderEarnedUsd(bounty.refPriceCents, BigInt(st.quote.priceCents), bounty.sharePct)}`}
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
