"use client";

import { useState } from "react";
import type { Hex } from "viem";
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  Flex,
  Input,
  Modal,
  Result,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, ExportOutlined } from "@ant-design/icons";
import {
  Bounty,
  BountyStatus,
  USD_PER_MON,
  discountPct,
  explorerTx,
  isFullPool,
  mon,
  payoutWei,
  savingsCents,
  usd,
  usdMon,
  weiToUsdCents,
} from "@/lib/contract";
import { STORES, storePath } from "@/lib/stores";
import { matchingDemoProducts } from "@/lib/match";
import { SECTORS, classifyCategory } from "@/lib/categories";
import { friendlyQuoteError, friendlyTxError } from "@/lib/friendly";
import { useBounties, useWallet, waitForTx } from "./wallet";
import { ActivityFeed } from "./ActivityFeed";
import {
  CategoryIcon,
  DiscountBadge,
  ProductTile,
  Quote,
  WalletButton,
  scrapeQuote,
  shortAddr,
  timeLeft,
} from "./ui";
import s from "@/app/market.module.css";

const { Title, Text } = Typography;

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
    <Flex vertical gap={24}>
      <ActivityFeed activity={activity} />

      <Flex vertical gap={12}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Title level={4} style={{ margin: 0 }}>
            Open bounties
          </Title>
          <Badge status="success" text={<Text type="secondary">Live</Text>} />
        </Flex>

        <Flex wrap gap={8}>
          <Tag.CheckableTag checked={category === "all"} onChange={() => setCategory("all")}>
            All ({open.length})
          </Tag.CheckableTag>
          {SECTORS.filter((sec) => counts.get(sec.id)).map((sec) => (
            <Tag.CheckableTag key={sec.id} checked={category === sec.id} onChange={() => setCategory(sec.id)}>
              <CategoryIcon id={sec.id} /> {sec.label} ({counts.get(sec.id)})
            </Tag.CheckableTag>
          ))}
        </Flex>
      </Flex>

      {error && <Alert type="error" showIcon title="Couldn't reach Monad" description={error} />}
      {loading ? (
        <div className={s.grid}>
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton active />
            </Card>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <Empty
            description={
              open.length === 0 ? "No open bounties yet. Post one to get started." : "No open bounties in this category."
            }
          />
        </Card>
      ) : (
        <div className={s.grid}>
          {shown.map((b) => (
            <BountyCard key={b.id.toString()} bounty={b} onHunt={() => setHuntingId(b.id)} />
          ))}
        </div>
      )}

      {hunting && (
        <HuntDrawer
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
      <SuccessModal
        win={win}
        onClose={() => setWin(null)}
        onViewProofs={() => {
          setWin(null);
          onViewProofs();
        }}
      />
    </Flex>
  );
}

function BountyCard({ bounty: b, onHunt }: { bounty: Bounty; onHunt: () => void }) {
  const cat = classifyCategory(b.item);
  return (
    <Card styles={{ body: { display: "flex", flexDirection: "column", gap: 16, height: "100%" } }}>
      <Flex justify="space-between" align="center">
        <Tag icon={<CategoryIcon id={cat.id} />} style={{ marginInlineEnd: 0 }}>
          {cat.label}
        </Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined /> {timeLeft(b.expiry)}
        </Text>
      </Flex>

      <Flex gap={12} align="center">
        <ProductTile item={b.item} />
        <div style={{ minWidth: 0 }}>
          <Title level={5} style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
            {b.item}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            #{b.id.toString()} · posted by {shortAddr(b.poster)}
          </Text>
        </div>
      </Flex>

      <Flex justify="space-between" gap={8}>
        <Statistic title="Find it under" value={usd(b.refPriceCents)} />
        <Statistic title="Reward pool" value={mon(b.escrow)} styles={{ content: { fontSize: 16 } }} />
        <Statistic
          title="Finder gets"
          value={
            isFullPool(b.escrow, b.refPriceCents)
              ? `${b.sharePct}% of savings`
              : `up to ${usd(weiToUsdCents(payoutWei(b.escrow, b.sharePct, b.refPriceCents, BigInt(0))))}`
          }
          styles={{ content: { fontSize: 16 } }}
        />
      </Flex>

      <Button type="primary" block onClick={onHunt} style={{ marginTop: "auto" }}>
        Hunt this deal
      </Button>
    </Card>
  );
}

type QuoteState = { quote?: Quote; loading?: boolean; error?: string };
type TxPhase = "idle" | "wallet" | "confirming";

function HuntDrawer({
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

  function QuoteRow({ st, label, onQuote }: { st: QuoteState; label: string; onQuote?: () => void }) {
    const q = st.quote;
    const price = q ? BigInt(q.priceCents) : null;
    const beats = price !== null && price < bounty.refPriceCents;
    const busy = phase !== "idle" && q?.url === activeUrl;
    return (
      <Card size="small">
        <Flex vertical gap={8}>
          <Flex justify="space-between" align="center" gap={8}>
            <Text strong>{label}</Text>
            {!q && onQuote && (
              <Button size="small" loading={st.loading} onClick={onQuote}>
                Check price
              </Button>
            )}
            {q && price !== null && (
              <Space size={8}>
                <Text strong>{usd(price)}</Text>
                {beats && <DiscountBadge pct={discountPct(bounty.refPriceCents, price)} />}
              </Space>
            )}
          </Flex>
          {st.error && <Alert type="error" showIcon title={st.error} />}
          {q && price !== null && !beats && (
            <Alert
              type="warning"
              showIcon
              title={`${usd(price)} isn't below the ${usd(bounty.refPriceCents)} target.`}
            />
          )}
          {q && price !== null && beats && (
            <>
              <Text type="success" style={{ fontSize: 12 }}>
                <CheckCircleOutlined /> Price verified and signed by the oracle
              </Text>
              {account ? (
                <Button
                  type="primary"
                  block
                  loading={busy}
                  disabled={phase !== "idle" && !busy}
                  onClick={() => void submit(q)}
                >
                  {busy && phase === "wallet"
                    ? "Confirm in your wallet"
                    : busy && phase === "confirming"
                      ? "Settling on Monad"
                      : `Claim and earn ${usdMon(payoutWei(bounty.escrow, bounty.sharePct, bounty.refPriceCents, price))}`}
                </Button>
              ) : (
                <WalletButton block />
              )}
            </>
          )}
        </Flex>
      </Card>
    );
  }

  const idle = phase === "idle";

  return (
    <Drawer
      open
      size={440}
      onClose={onClose}
      closable={idle}
      keyboard={idle}
      mask={{ closable: idle, blur: false }}
      destroyOnHidden
      title={
        <Flex gap={12} align="center">
          <ProductTile item={bounty.item} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15 }}>{bounty.item}</div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              Bounty #{bounty.id.toString()} · {timeLeft(bounty.expiry)}
            </Text>
          </div>
        </Flex>
      }
    >
      <Flex vertical gap={24}>
        <Alert
          type="info"
          title={
            <>
              Find it for less than <strong>{usd(bounty.refPriceCents)}</strong>.{" "}
              {isFullPool(bounty.escrow, bounty.refPriceCents) ? (
                <>
                  You earn <strong>{bounty.sharePct}% of every dollar you save</strong>, paid in MON from a{" "}
                  {mon(bounty.escrow)} pool (demo rate: 1 MON = ${USD_PER_MON}).
                </>
              ) : (
                <>
                  This bounty&apos;s pool is smaller than its reference price, so you earn less: up to{" "}
                  <strong>{usdMon(payoutWei(bounty.escrow, bounty.sharePct, bounty.refPriceCents, BigInt(0)))}</strong>,
                  more the bigger the discount.
                </>
              )}
            </>
          }
        />

        <Flex vertical gap={8}>
          <Text type="secondary">Paste a product link</Text>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="https://store.com/product"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onPressEnter={() => urlInput.trim() && void quoteUrl(urlInput.trim(), setCustom)}
            />
            <Button
              loading={custom.loading}
              disabled={!urlInput.trim()}
              onClick={() => void quoteUrl(urlInput.trim(), setCustom)}
            >
              Check price
            </Button>
          </Space.Compact>
          {(custom.quote || custom.error) && <QuoteRow st={custom} label="Your link" />}
        </Flex>

        <Flex vertical gap={8}>
          <Text type="secondary">Or try a demo store</Text>
          {demoRows.length === 0 && (
            <Text type="secondary">No demo store sells this item. Paste a real product link above.</Text>
          )}
          {demoRows.map(({ key, store, product }) => (
            <QuoteRow
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
        </Flex>

        {txErr && <Alert type="error" showIcon title={txErr} />}
        {phase === "confirming" && pendingHash && (
          <Text type="secondary">
            Waiting for Monad to confirm.{" "}
            <a href={explorerTx(pendingHash)} target="_blank" rel="noreferrer">
              View transaction <ExportOutlined />
            </a>
          </Text>
        )}
      </Flex>
    </Drawer>
  );
}

function SuccessModal({
  win,
  onClose,
  onViewProofs,
}: {
  win: Win | null;
  onClose: () => void;
  onViewProofs: () => void;
}) {
  return (
    <Modal open={!!win} onCancel={onClose} footer={null} width={480} centered destroyOnHidden>
      {win && <SuccessBody win={win} onViewProofs={onViewProofs} />}
    </Modal>
  );
}

function SuccessBody({ win, onViewProofs }: { win: Win; onViewProofs: () => void }) {
  const { bounty: b, quote, hash, payout } = win;
  const price = BigInt(quote.priceCents);
  return (
    <Result
      status="success"
      title="Deal found and paid out"
      subTitle={`${b.item} for ${usd(price)} instead of ${usd(b.refPriceCents)}. Verified by the oracle and settled on Monad.`}
      extra={[
        <Button type="primary" key="nft" onClick={onViewProofs}>
          See your Deal Proof
        </Button>,
        <Button key="tx" href={explorerTx(hash)} target="_blank" icon={<ExportOutlined />}>
          View transaction
        </Button>,
      ]}
    >
      <Flex justify="space-around" gap={16} wrap>
        <Statistic title="Buyer saves" value={usd(savingsCents(b.refPriceCents, price))} />
        <Statistic title="You earned" value={usd(weiToUsdCents(payout))} suffix={<Text type="secondary">{mon(payout)}</Text>} />
        <Statistic title="Minted" value={`Deal Proof #${b.id.toString()}`} />
      </Flex>
    </Result>
  );
}
