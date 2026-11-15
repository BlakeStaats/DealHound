"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Divider, Flex, Typography } from "antd";
import { CheckCircleFilled, PushpinOutlined } from "@ant-design/icons";
import { discountPct, mon, usd } from "@/lib/contract";
import type { Activity } from "./wallet";
import { DiscountBadge, HunterBadge, shortAddr } from "./ui";
import s from "@/app/market.module.css";

const { Text } = Typography;

function ago(at: number | null, now: number): string {
  if (at === null) return "earlier";
  const secs = Math.max(0, Math.round((now - at) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

/** Bounties posted and deals claimed, newest first. */
export function ActivityFeed({ activity }: { activity: Activity[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (activity.length === 0) return null;
  const rows = activity.slice(0, 6);

  return (
    <Card
      size="small"
      title="Live activity"
      extra={<Badge status="success" text={<Text type="secondary">Updates every few seconds</Text>} />}
      styles={{ body: { maxHeight: 224, overflowY: "auto", padding: "4px 12px" } }}
    >
      {rows.map((a, i) => {
        const b = a.bounty;
        const fresh = a.at !== null && now - a.at < 15000;
        return (
          <div key={a.key}>
            <div className={`${s.feedRow} ${fresh ? s.feedFresh : ""}`} style={{ padding: "8px 4px" }}>
              {a.kind === "filled" ? (
                <>
                  <CheckCircleFilled style={{ color: "#389e0d" }} />
                  <HunterBadge addr={b.finder} />
                  <Text>
                    found <Text strong>{b.item}</Text> for <Text strong>{usd(b.foundPriceCents)}</Text>
                  </Text>
                  <DiscountBadge pct={discountPct(b.refPriceCents, b.foundPriceCents)} />
                  <Text type="secondary">earned {mon(b.payout)}</Text>
                </>
              ) : (
                <>
                  <PushpinOutlined style={{ color: "#8c8c8c" }} />
                  <Text>
                    {shortAddr(b.poster)} posted <Text strong>{b.item}</Text> under {usd(b.refPriceCents)}
                  </Text>
                  <Text type="secondary">{mon(b.escrow)} pool</Text>
                </>
              )}
              <Text type="secondary" className={s.feedTime} style={{ fontSize: 12 }}>
                {ago(a.at, now)}
              </Text>
            </div>
            {i < rows.length - 1 && <Divider style={{ margin: 0 }} />}
          </div>
        );
      })}
    </Card>
  );
}
