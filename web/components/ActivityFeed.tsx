"use client";

import { useEffect, useState } from "react";
import { discountPct, mon, usd } from "@/lib/contract";
import type { Activity } from "./wallet";
import { HunterBadge, shortAddr } from "./ui";
import s from "@/app/market.module.css";

function ago(at: number | null, now: number): string {
  if (at === null) return "earlier";
  const secs = Math.max(0, Math.round((now - at) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

/** Live strip of bounties posted and deals claimed, newest first. */
export function ActivityFeed({ activity }: { activity: Activity[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (activity.length === 0) return null;

  return (
    <div className={s.feed}>
      <div className={s.feedHead}>
        <span className={s.liveDot}>Live activity</span>
      </div>
      <ul className={s.feedList}>
        {activity.slice(0, 8).map((a) => {
          const b = a.bounty;
          const fresh = a.at !== null && now - a.at < 15000;
          return (
            <li key={a.key} className={fresh ? s.feedItemFresh : s.feedItem}>
              {a.kind === "filled" ? (
                <>
                  <span className={s.feedIcon}>⚡</span>
                  <span>
                    <HunterBadge addr={b.finder} /> found <strong>{b.item}</strong> for{" "}
                    <strong>{usd(b.foundPriceCents)}</strong>{" "}
                    <span className={s.feedSave}>−{discountPct(b.refPriceCents, b.foundPriceCents)}%</span> · earned{" "}
                    {mon(b.payout)}
                  </span>
                </>
              ) : (
                <>
                  <span className={s.feedIcon}>📌</span>
                  <span>
                    {shortAddr(b.poster)} posted <strong>{b.item}</strong> under {usd(b.refPriceCents)} ·{" "}
                    {mon(b.escrow)} pool
                  </span>
                </>
              )}
              <span className={s.feedTime}>{ago(a.at, now)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
