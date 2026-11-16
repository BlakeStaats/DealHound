"use client";

import type { Hex } from "viem";
import { App, Avatar, Button, Tag } from "antd";
import {
  HeartOutlined,
  HomeOutlined,
  LaptopOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SkinOutlined,
  TagOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useWallet } from "./wallet";
import { QuoteError } from "@/lib/friendly";
import { classifyCategory } from "@/lib/categories";
import { productImageForItem } from "@/lib/stores";

export function shortAddr(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/** Savings vs the reference price, e.g. "−24%". */
export function DiscountBadge({ pct }: { pct: number }) {
  if (pct <= 0) return null;
  return (
    <Tag color="green" style={{ marginInlineEnd: 0, fontWeight: 600 }}>
      −{pct}%
    </Tag>
  );
}

export function WalletButton({ block }: { block?: boolean }) {
  const { account, connect, connecting, hasWallet } = useWallet();
  const { message } = App.useApp();
  if (account) {
    return (
      <Button icon={<WalletOutlined />} block={block}>
        {shortAddr(account)}
      </Button>
    );
  }
  return (
    <Button
      type="primary"
      icon={<WalletOutlined />}
      loading={connecting}
      block={block}
      onClick={() => connect().catch((e) => message.error((e as Error).message))}
    >
      {hasWallet ? "Connect wallet" : "Install a wallet"}
    </Button>
  );
}

// ---------- agents vs humans ----------

// Wallets known to be bots, e.g. the hunter bot's address. Comma-separated, set on Vercel.
const AGENTS = (process.env.NEXT_PUBLIC_AGENT_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

export function isAgent(addr?: string): boolean {
  return !!addr && AGENTS.includes(addr.toLowerCase());
}

export function HunterBadge({ addr }: { addr: string }) {
  const agent = isAgent(addr);
  return (
    <Tag
      icon={agent ? <RobotOutlined /> : <UserOutlined />}
      color={agent ? "purple" : "blue"}
      title={addr}
      style={{ marginInlineEnd: 0 }}
    >
      {agent ? "Agent" : "Human"} {shortAddr(addr)}
    </Tag>
  );
}

// ---------- category icon, product tile, countdown ----------

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  tech: <LaptopOutlined />,
  apparel: <SkinOutlined />,
  home: <HomeOutlined />,
  gaming: <PlayCircleOutlined />,
  beauty: <HeartOutlined />,
  other: <TagOutlined />,
};

export function CategoryIcon({ id }: { id: string }) {
  return <>{CATEGORY_ICON[id] ?? CATEGORY_ICON.other}</>;
}

export function ProductTile({ item, size = 48 }: { item: string; size?: number }) {
  const cat = classifyCategory(item);
  const img = productImageForItem(item);
  return (
    <Avatar
      shape="square"
      size={size}
      src={img ?? undefined}
      // Falls back to the category icon if there's no photo or it fails to load.
      icon={<CategoryIcon id={cat.id} />}
      style={{
        background: img ? "#fff" : "#eef0f4",
        color: "#5b6270",
        border: "1px solid #eef0f4",
        flex: "none",
      }}
    />
  );
}

export function timeLeft(expiry: bigint): string {
  const secs = Number(expiry) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "expired";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ---------- oracle ----------

export type Quote = {
  bountyId: string;
  url: string;
  priceCents: number;
  sig: Hex;
  oracle: string;
  priceSource: string;
  productName?: string;
};

/** Ask the oracle to scrape a product URL and sign the price. Throws QuoteError. */
export async function scrapeQuote(bountyId: bigint, url: string): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bountyId: bountyId.toString(), url }),
    });
  } catch {
    throw new QuoteError("network", "Couldn't reach the price oracle.");
  }
  const data = await res.json();
  if (!res.ok) throw new QuoteError(data.error ?? "unknown", data.message ?? "quote failed");
  return data as Quote;
}
