"use client";

import Image from "next/image";
import { Button, Card, Steps, Typography } from "antd";
import {
  ApiOutlined,
  ExportOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { CONTRACT_ADDRESS, explorerAddress } from "@/lib/contract";
import { shortAddr } from "./ui";
import s from "@/app/market.module.css";

const { Title, Paragraph, Text } = Typography;

const FEATURES = [
  {
    icon: <ThunderboltOutlined />,
    title: "Sub-second payouts",
    body: "Savings settle on Monad as fast as a card swipe.",
  },
  {
    icon: <TrophyOutlined />,
    title: "On-chain proof",
    body: "Every deal mints an ERC-721 with the savings in its metadata.",
  },
  {
    icon: <ApiOutlined />,
    title: "Agent-ready",
    body: "A REST bounty feed and a signing oracle let bots hunt deals on their own.",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "Verified pricing",
    body: "The oracle checks the product and price, and its signature is bound to this chain and contract.",
  },
];

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <section>
      <div className={s.hero}>
        <Image src="/bloodhound-logo-256.png" alt="DealHound" width={72} height={72} priority />
        <Title style={{ margin: "16px 0 8px", fontSize: 40 }}>DealHound</Title>
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Post a price. Let the pack beat it. Pay only for the savings.
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 16, marginTop: 16 }}>
          A deal-bounty marketplace on Monad. Escrow MON against a reference price for anything you want
          to buy, and human hunters and AI agents race to find it cheaper. When a lower price is verified,
          the finder is paid their share of the savings and mints a Deal Proof NFT. The rest refunds to
          you automatically.
        </Paragraph>
        <div className={s.heroActions}>
          <Button type="primary" size="large" onClick={onEnter}>
            Enter marketplace
          </Button>
          <Button size="large" href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" icon={<ExportOutlined />}>
            Live on Monad Testnet · {shortAddr(CONTRACT_ADDRESS)}
          </Button>
        </div>
      </div>

      <Card>
        <Steps
          current={-1}
          items={[
            {
              title: "Post a bounty",
              content: "Lock an item's reference price in MON and set a finder's share of every dollar saved.",
            },
            {
              title: "The pack hunts",
              content: "Humans or agents find a cheaper listing. The oracle verifies and signs the price.",
            },
            {
              title: "Instant settle",
              content: "One transaction pays the finder, refunds the rest, and mints a Deal Proof.",
            },
          ]}
        />
      </Card>

      <div className={s.featGrid}>
        {FEATURES.map((f) => (
          <Card key={f.title} size="small">
            <div className={s.featIcon}>{f.icon}</div>
            <Text strong style={{ display: "block", margin: "8px 0 4px" }}>
              {f.title}
            </Text>
            <Text type="secondary">{f.body}</Text>
          </Card>
        ))}
      </div>
    </section>
  );
}
