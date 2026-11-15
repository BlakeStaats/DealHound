"use client";

import { Card, Empty, Flex, Table, Tag, Typography } from "antd";
import { Bounty, BountyStatus, discountPct, mon, savingsCents, usd } from "@/lib/contract";
import { DiscountBadge, HunterBadge, ProductTile } from "./ui";
import s from "@/app/market.module.css";

const { Title, Text } = Typography;

export function NftGallery({ bounties }: { bounties: Bounty[] }) {
  const filled = bounties.filter((b) => b.status === BountyStatus.Filled).sort((a, b) => Number(b.id - a.id));

  return (
    <Flex vertical gap={24}>
      <Flex justify="space-between" align="center">
        <Title level={4} style={{ margin: 0 }}>
          Deal Proofs
        </Title>
        <Text type="secondary">{filled.length} minted</Text>
      </Flex>

      {filled.length === 0 ? (
        <Card>
          <Empty description="No Deal Proofs yet. Claim a bounty to mint one." />
        </Card>
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
    </Flex>
  );
}

function NftCard({ bounty: b }: { bounty: Bounty }) {
  return (
    <Card styles={{ body: { display: "flex", flexDirection: "column", gap: 12 } }}>
      <Flex justify="space-between" align="center">
        <Tag style={{ marginInlineEnd: 0 }}>Deal Proof #{b.id.toString()}</Tag>
        <DiscountBadge pct={discountPct(b.refPriceCents, b.foundPriceCents)} />
      </Flex>
      <Flex gap={12} align="center">
        <ProductTile item={b.item} />
        <Title level={5} style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
          {b.item}
        </Title>
      </Flex>
      <Flex align="baseline" gap={8}>
        <Text delete type="secondary">
          {usd(b.refPriceCents)}
        </Text>
        <Text strong style={{ fontSize: 22 }}>
          {usd(b.foundPriceCents)}
        </Text>
      </Flex>
      <Text type="secondary">
        Buyer saved {usd(savingsCents(b.refPriceCents, b.foundPriceCents))} · {b.sharePct}% finder share
      </Text>
      <Flex align="center" gap={8} wrap>
        <HunterBadge addr={b.finder} />
        <Text>earned {mon(b.payout)}</Text>
      </Flex>
    </Card>
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
  const rows = [...byFinder.entries()]
    .sort((a, c) => (c[1].earned > a[1].earned ? 1 : -1))
    .map(([addr, v], i) => ({ key: addr, rank: i + 1, addr, ...v }));

  return (
    <Card title="Top hunters" size="small">
      <Table
        size="small"
        pagination={false}
        dataSource={rows}
        scroll={{ x: true }}
        columns={[
          { title: "#", dataIndex: "rank", width: 48 },
          { title: "Hunter", dataIndex: "addr", render: (a: string) => <HunterBadge addr={a} /> },
          { title: "Earned", dataIndex: "earned", render: (v: bigint) => mon(v) },
          { title: "Saved buyers", dataIndex: "savedCents", render: (v: bigint) => usd(v) },
          { title: "Deals", dataIndex: "deals", width: 72 },
        ]}
      />
    </Card>
  );
}
