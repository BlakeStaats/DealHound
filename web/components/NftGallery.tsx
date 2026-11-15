"use client";

import { formatEther } from "viem";
import {
  Bounty,
  BountyStatus,
  discountPct,
  finderEarnedUsd,
  savingsCents,
  usd,
} from "@/lib/contract";
import { DiscountBadge, shortAddr } from "./ui";
import s from "@/app/market.module.css";

export function NftGallery({ bounties }: { bounties: Bounty[] }) {
  const filled = bounties.filter((b) => b.status === BountyStatus.Filled);

  return (
    <section>
      <div className={s.sectionHead}>
        <h2>Deal Proof gallery</h2>
        <span className={s.muted}>{filled.length} minted</span>
      </div>

      {filled.length === 0 ? (
        <div className={s.empty}>No Deal Proofs yet — claim a bounty in Hunt deals to mint one.</div>
      ) : (
        <>
          <div className={s.grid}>
            {filled.map((b) => (
              <NftCard key={b.id.toString()} bounty={b} />
            ))}
          </div>
          <Leaderboard bounties={filled} />
        </>
      )}
    </section>
  );
}

function NftCard({ bounty: b }: { bounty: Bounty }) {
  const pct = discountPct(b.refPriceCents, b.foundPriceCents);
  const saved = savingsCents(b.refPriceCents, b.foundPriceCents);
  return (
    <article className={s.nft}>
      <div className={s.nftArt}>
        <DiscountBadge pct={pct} size="lg" />
        <div className={s.nftTokenId}>Deal Proof #{b.id.toString()}</div>
      </div>
      <div className={s.nftBody}>
        <h3>{b.item}</h3>
        <div className={s.priceLine}>
          <span className={s.strike}>{usd(b.refPriceCents)}</span>
          <span className={s.foundPrice}>{usd(b.foundPriceCents)}</span>
        </div>
        <div className={s.savingsLine}>
          Saved {usd(saved)} · Finder earned {finderEarnedUsd(b.refPriceCents, b.foundPriceCents, b.sharePct)}{" "}
          <span className={s.shareTag}>{b.sharePct}% share</span>
        </div>
        <div className={s.nftPayout}>Payout: {formatEther(b.payout)} MON → {shortAddr(b.finder)}</div>
      </div>
    </article>
  );
}

function Leaderboard({ bounties }: { bounties: Bounty[] }) {
  const byFinder = new Map<string, { earnedCents: number; deals: number }>();
  for (const b of bounties) {
    const cents = (Number(savingsCents(b.refPriceCents, b.foundPriceCents)) * b.sharePct) / 100;
    const cur = byFinder.get(b.finder) ?? { earnedCents: 0, deals: 0 };
    byFinder.set(b.finder, { earnedCents: cur.earnedCents + cents, deals: cur.deals + 1 });
  }
  const rows = [...byFinder.entries()].sort((a, c) => c[1].earnedCents - a[1].earnedCents);

  return (
    <div className={s.leaderboard}>
      <h3>🏆 Top finders</h3>
      <ol>
        {rows.map(([addr, v]) => (
          <li key={addr}>
            <span>{shortAddr(addr)}</span>
            <span className={s.lbEarned}>
              {usd(v.earnedCents)} · {v.deals} deal{v.deals === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
