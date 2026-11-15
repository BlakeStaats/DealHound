"use client";

import {
  Bounty,
  BountyStatus,
  discountPct,
  savingsCents,
  usd,
} from "@/lib/contract";
import { DiscountBadge, HunterBadge, ProductTile } from "./ui";
import { mon } from "@/lib/contract";
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
        <ProductTile item={b.item} size={72} />
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
          Buyer saved {usd(saved)} <span className={s.shareTag}>{b.sharePct}% share</span>
        </div>
        <div className={s.nftPayout}>
          <HunterBadge addr={b.finder} /> earned {mon(b.payout)}
        </div>
      </div>
    </article>
  );
}

function Leaderboard({ bounties }: { bounties: Bounty[] }) {
  // Ranked by MON actually paid out by the contract.
  const byFinder = new Map<string, { earned: bigint; savedCents: bigint; deals: number }>();
  for (const b of bounties) {
    const cur = byFinder.get(b.finder) ?? { earned: BigInt(0), savedCents: BigInt(0), deals: 0 };
    byFinder.set(b.finder, {
      earned: cur.earned + b.payout,
      savedCents: cur.savedCents + savingsCents(b.refPriceCents, b.foundPriceCents),
      deals: cur.deals + 1,
    });
  }
  const rows = [...byFinder.entries()].sort((a, c) => (c[1].earned > a[1].earned ? 1 : -1));

  return (
    <div className={s.leaderboard}>
      <h3>🏆 Top finders</h3>
      <ol>
        {rows.map(([addr, v]) => (
          <li key={addr}>
            <HunterBadge addr={addr} />
            <span className={s.lbEarned}>
              {mon(v.earned)} · saved buyers {usd(v.savedCents)} · {v.deals} deal{v.deals === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
