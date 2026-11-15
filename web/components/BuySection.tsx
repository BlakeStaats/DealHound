"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import {
  Bounty,
  BountyStatus,
  discountPct,
  explorerTx,
  mon,
  payoutWei,
  savingsCents,
  usd,
} from "@/lib/contract";
import { STORES, storePath } from "@/lib/stores";
import { matchingDemoProducts } from "@/lib/match";
import { SECTORS, classifyCategory } from "@/lib/categories";
import { friendlyQuoteError, friendlyTxError } from "@/lib/friendly";
import { useBounties, useWallet, waitForTx } from "./wallet";
import { ActivityFeed } from "./ActivityFeed";
import {
  DiscountBadge,
  ProductTile,
  Quote,
  WalletButton,
  scrapeQuote,
  shortAddr,
  timeLeft,
} from "./ui";
import s from "@/app/market.module.css";

type Win = { bounty: Bounty; quote: Quote; hash: Hex; payout: bigint };

export function BuySection({
  bountiesHook,
  onViewProofs,
}: {
  bountiesHook: ReturnType<typeof useBounties>;
  onViewProofs: () => void;
}) {
  const { bounties, loading, error, refresh, activity } = bountiesHook;
  const [category, setCategory] = useState<string>("all");
  const [huntingId, setHuntingId] = useState<bigint | null>(null);
  const [win, setWin] = useState<Win | null>(null);

  const open = bounties.filter((b) => b.status === BountyStatus.Open);
  const shown = category === "all" ? open : open.filter((b) => classifyCategory(b.item).id === category);
  const hunting = huntingId === null ? null : bounties.find((b) => b.id === huntingId) ?? null;

  const counts = new Map<string, number>();
  for (const b of open) {
    const id = classifyCategory(b.item).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return (
    <section>
      <ActivityFeed activity={activity} />

      <nav className={s.catbar}>
        <button
          className={category === "all" ? s.catPillActive : s.catPill}
          onClick={() => setCategory("all")}
        >
          🏆 All <span className={s.catCount}>{open.length}</span>
        </button>
        {SECTORS.map((sec) => (
          <button
            key={sec.id}
            className={category === sec.id ? s.catPillActive : s.catPill}
            onClick={() => setCategory(sec.id)}
          >
            {sec.icon} {sec.label}
            {counts.get(sec.id) ? <span className={s.catCount}>{counts.get(sec.id)}</span> : null}
          </button>
        ))}
      </nav>

      <div className={s.sectionHead}>
        <h2>Open bounties</h2>
        <span className={s.liveDot}>Live · updates every few seconds</span>
      </div>

      {loading && <p className={s.muted}>Loading bounties from Monad…</p>}
      {error && <p className={s.error}>⚠ Couldn&apos;t reach Monad: {error}</p>}
      {!loading && open.length === 0 && (
        <div className={s.empty}>
          No open bounties yet. Head to <strong>Post a bounty</strong> to create one.
        </div>
      )}
      {!loading && open.length > 0 && shown.length === 0 && (
        <div className={s.empty}>No open bounties in this category yet.</div>
      )}

      <div className={s.grid}>
        {shown.map((b) => (
          <BountyCard key={b.id.toString()} bounty={b} onHunt={() => setHuntingId(b.id)} />
        ))}
      </div>

      {hunting && (
        <HuntPanel
          key={hunting.id.toString()}
          bounty={hunting}
          onClose={() => setHuntingId(null)}
          onWon={(w) => {
            setHuntingId(null);
            setWin(w);
            void refresh();
          }}
        />
      )}
      {win && (
        <SuccessModal
          win={win}
          onClose={() => setWin(null)}
          onViewProofs={() => {
            setWin(null);
            onViewProofs();
          }}
        />
      )}
    </section>
  );
}

function BountyCard({ bounty: b, onHunt }: { bounty: Bounty; onHunt: () => void }) {
  const cat = classifyCategory(b.item);
  return (
    <article className={s.card}>
      <div className={s.cardTop}>
        <span className={s.catChip}>
          {cat.icon} {cat.label}
        </span>
        <span className={s.timeLeft}>⏱ {timeLeft(b.expiry)}</span>
      </div>

      <div className={s.cardMain}>
        <ProductTile item={b.item} />
        <div>
          <h3 className={s.cardTitle}>{b.item}</h3>
          <div className={s.cardSub}>
            #{b.id.toString()} · posted by {shortAddr(b.poster)}
          </div>
        </div>
      </div>

      <div className={s.stats}>
        <div>
          <div className={s.statLabel}>Find it under</div>
          <div className={s.statBig}>{usd(b.refPriceCents)}</div>
        </div>
        <div>
          <div className={s.statLabel}>Reward pool</div>
          <div className={s.statMid}>{mon(b.escrow)}</div>
        </div>
        <div>
          <div className={s.statLabel}>Finder gets</div>
          <div className={s.statMid}>{b.sharePct}% of savings</div>
        </div>
      </div>

      <button className={s.huntBtn} onClick={onHunt}>
        Hunt this deal →
      </button>
    </article>
  );
}

type QuoteState = { quote?: Quote; loading?: boolean; error?: string };
type TxPhase = "idle" | "wallet" | "confirming";

function HuntPanel({
  bounty,
  onClose,
  onWon,
}: {
  bounty: Bounty;
  onClose: () => void;
  onWon: (w: Win) => void;
}) {
  const { account, submitDeal } = useWallet();
  const [urlInput, setUrlInput] = useState("");
  const [custom, setCustom] = useState<QuoteState>({});
  const [demo, setDemo] = useState<Record<string, QuoteState>>({});
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [pendingHash, setPendingHash] = useState<Hex | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && phase === "idle" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const demoProducts = matchingDemoProducts(bounty.item);
  const demoRows = demoProducts.flatMap((product) =>
    STORES.map((store) => ({ key: `${product.id}:${store.slug}`, store, product })),
  );

  async function quoteUrl(url: string, set: (st: QuoteState) => void) {
    set({ loading: true });
    try {
      set({ quote: await scrapeQuote(bounty.id, url) });
    } catch (e) {
      set({ error: friendlyQuoteError(e) });
    }
  }

  async function submit(quote: Quote) {
    setTxErr(null);
    setActiveUrl(quote.url);
    setPhase("wallet");
    try {
      // Must submit the exact url returned by /api/quote (the oracle signed that string).
      const hash = await submitDeal({
        id: bounty.id,
        url: quote.url,
        priceCents: BigInt(quote.priceCents),
        oracleSig: quote.sig,
      });
      setPendingHash(hash);
      setPhase("confirming");
      await waitForTx(hash);
      onWon({
        bounty,
        quote,
        hash,
        payout: payoutWei(bounty.escrow, bounty.sharePct, bounty.refPriceCents, BigInt(quote.priceCents)),
      });
    } catch (e) {
      setTxErr(friendlyTxError(e, bounty.refPriceCents));
      setPhase("idle");
    }
  }

  function QuoteLine({ st, label, onQuote }: { st: QuoteState; label: string; onQuote?: () => void }) {
    const q = st.quote;
    const price = q ? BigInt(q.priceCents) : null;
    const beats = price !== null && price < bounty.refPriceCents;
    const busy = phase !== "idle" && q?.url === activeUrl;
    return (
      <div className={s.quoteLine}>
        <div className={s.quoteLineHead}>
          <span className={s.storeName}>{label}</span>
          {!q && onQuote && (
            <button className={s.ghostBtn} disabled={st.loading} onClick={onQuote}>
              {st.loading ? "Checking…" : "Check price"}
            </button>
          )}
          {q && price !== null && (
            <span className={s.storeQuote}>
              {usd(price)} {beats ? <DiscountBadge pct={discountPct(bounty.refPriceCents, price)} /> : null}
            </span>
          )}
        </div>
        {st.error && <div className={s.errorSm}>⚠ {st.error}</div>}
        {q && price !== null && !beats && (
          <div className={s.noBeat}>
            {usd(price)} isn&apos;t below the {usd(bounty.refPriceCents)} target. Keep hunting.
          </div>
        )}
        {q && price !== null && beats && (
          <>
            <div className={s.verified}>✓ Price verified and signed by the oracle</div>
            {account ? (
              <button className={s.primaryBtn} disabled={phase !== "idle"} onClick={() => void submit(q)}>
                {busy && phase === "wallet"
                  ? "Confirm in your wallet…"
                  : busy && phase === "confirming"
                    ? "Settling on Monad…"
                    : `Claim · earn ${mon(payoutWei(bounty.escrow, bounty.sharePct, bounty.refPriceCents, price))}`}
              </button>
            ) : (
              <div className={s.connectHint}>
                <WalletButton /> <span className={s.muted}>to claim this deal</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={s.overlay} onClick={() => phase === "idle" && onClose()} />
      <aside className={s.drawer} role="dialog" aria-label={`Hunt ${bounty.item}`}>
        <div className={s.drawerHead}>
          <ProductTile item={bounty.item} size={48} />
          <div className={s.drawerTitle}>
            <h3>{bounty.item}</h3>
            <div className={s.cardSub}>
              Bounty #{bounty.id.toString()} · {timeLeft(bounty.expiry)}
            </div>
          </div>
          <button className={s.closeBtn} onClick={onClose} disabled={phase !== "idle"} aria-label="Close">
            ×
          </button>
        </div>

        <div className={s.goal}>
          Find it for less than <strong>{usd(bounty.refPriceCents)}</strong>. You earn{" "}
          <strong>{bounty.sharePct}% of the savings</strong>, paid from a {mon(bounty.escrow)} pool.
        </div>

        <div className={s.drawerSection}>
          <div className={s.approvedLabel}>Paste a product link</div>
          <div className={s.urlRow}>
            <input
              className={s.urlInput}
              placeholder="https://store.com/product"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && urlInput.trim() && void quoteUrl(urlInput.trim(), setCustom)}
            />
            <button
              className={s.ghostBtn}
              disabled={custom.loading || !urlInput.trim()}
              onClick={() => void quoteUrl(urlInput.trim(), setCustom)}
            >
              {custom.loading ? "Checking…" : "Check price"}
            </button>
          </div>
          {(custom.quote || custom.error) && <QuoteLine st={custom} label="Your link" />}
        </div>

        <div className={s.drawerSection}>
          <div className={s.approvedLabel}>Or try a demo store</div>
          {demoRows.length === 0 && (
            <span className={s.muted}>No demo store sells this item. Paste a real product link above.</span>
          )}
          {demoRows.map(({ key, store, product }) => (
            <QuoteLine
              key={key}
              st={demo[key] ?? {}}
              label={demoProducts.length > 1 ? `${store.name} · ${product.name}` : store.name}
              onQuote={() =>
                void quoteUrl(`${window.location.origin}${storePath(store.slug, product.id)}`, (st) =>
                  setDemo((p) => ({ ...p, [key]: st })),
                )
              }
            />
          ))}
        </div>

        {txErr && <p className={s.error}>⚠ {txErr}</p>}
        {phase === "confirming" && pendingHash && (
          <p className={s.muted}>
            Waiting for Monad to confirm…{" "}
            <a href={explorerTx(pendingHash)} target="_blank" rel="noreferrer">
              view tx ↗
            </a>
          </p>
        )}
      </aside>
    </>
  );
}

function SuccessModal({
  win,
  onClose,
  onViewProofs,
}: {
  win: Win;
  onClose: () => void;
  onViewProofs: () => void;
}) {
  const { bounty: b, quote, hash, payout } = win;
  const price = BigInt(quote.priceCents);
  const pct = discountPct(b.refPriceCents, price);
  return (
    <>
      <div className={s.overlay} onClick={onClose} />
      <div className={s.modal} role="dialog" aria-label="Deal claimed">
        <div className={s.confetti} aria-hidden="true">
          🎉 ✨ 🐾 ✨ 🎉
        </div>
        <h2 className={s.modalTitle}>Deal found and paid out</h2>
        <p className={s.muted}>Verified by the oracle and settled on Monad.</p>

        <div className={s.winCard}>
          <ProductTile item={b.item} size={64} />
          <div>
            <div className={s.winItem}>{b.item}</div>
            <div className={s.priceLine}>
              <span className={s.strike}>{usd(b.refPriceCents)}</span>
              <span className={s.foundPrice}>{usd(price)}</span>
              <DiscountBadge pct={pct} />
            </div>
          </div>
        </div>

        <div className={s.winStats}>
          <div>
            <div className={s.statLabel}>Buyer saves</div>
            <div className={s.statBig}>{usd(savingsCents(b.refPriceCents, price))}</div>
          </div>
          <div>
            <div className={s.statLabel}>You earned</div>
            <div className={s.statBig}>{mon(payout)}</div>
          </div>
          <div>
            <div className={s.statLabel}>Minted</div>
            <div className={s.statBig}>Deal Proof #{b.id.toString()}</div>
          </div>
        </div>

        <div className={s.modalActions}>
          <button className={s.primaryBtn} onClick={onViewProofs}>
            See your Deal Proof NFT
          </button>
          <a className={s.ghostBtn} href={explorerTx(hash)} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </div>
      </div>
    </>
  );
}
