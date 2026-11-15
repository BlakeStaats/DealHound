"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { Alert, Button, Card, Col, Flex, Input, InputNumber, Row, Space, Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { USD_PER_MON, explorerTx, mon, payoutWei, poolWeiForMsrp, usd, usdMon } from "@/lib/contract";
import { friendlyTxError } from "@/lib/friendly";
import { useWallet, waitForTx } from "./wallet";
import { WalletButton } from "./ui";

const { Title, Text, Paragraph } = Typography;

/** Unix expiry `days` from now. Called from the submit handler, never during render. */
function expiryFromNow(days: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + Math.round(days * 86400));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex vertical gap={6}>
      <Text type="secondary">{label}</Text>
      {children}
    </Flex>
  );
}

export function SellSection({ onPosted }: { onPosted: () => void }) {
  const { account, createBounty } = useWallet();
  const [item, setItem] = useState("AirPods Pro 2 (USB-C)");
  const [msrp, setMsrp] = useState<number | null>(249);
  const [sharePct, setSharePct] = useState<number | null>(25);
  const [days, setDays] = useState<number | null>(7);
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "wallet" | "confirming">(false);
  const [err, setErr] = useState<string | null>(null);

  // The pool is always the reference price converted to MON, so the finder earns share% of the
  // dollar savings (the contract pays pool × share% × savings ÷ reference price).
  const msrpCents = msrp && msrp > 0 ? BigInt(Math.round(msrp * 100)) : null;
  const pool = msrpCents ? poolWeiForMsrp(msrpCents) : null;

  async function submit() {
    setErr(null);
    setTx(null);
    try {
      if (!item.trim()) throw new Error("Item name is required.");
      if (!msrpCents || !pool) throw new Error("Reference price must be above $0.");
      if (!sharePct || sharePct < 1 || sharePct > 100) throw new Error("Finder share must be 1–100%.");
      if (!days || days <= 0) throw new Error("Expiry must be at least a day.");
      const expiry = expiryFromNow(days);
      setBusy("wallet");
      const hash = await createBounty({
        item: item.trim(),
        refPriceCents: msrpCents,
        sharePct,
        expiry,
        escrowMon: formatEther(pool),
      });
      setTx(hash);
      setBusy("confirming");
      await waitForTx(hash);
      onPosted();
    } catch (e) {
      setErr(e instanceof Error && !("shortMessage" in e) ? e.message : friendlyTxError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row justify="center">
      <Col xs={24} md={18} lg={14}>
        <Flex vertical gap={16}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Post a bounty
            </Title>
            <Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
              Lock the reference price of something you want in MON. The first hunter to verify a lower
              price earns their share of every dollar saved, and the rest of the pool comes back to you. No
              deal before expiry means a full refund.
            </Paragraph>
          </div>

          <Card>
            <Flex vertical gap={16}>
              <Field label="Item">
                <Input size="large" value={item} onChange={(e) => setItem(e.target.value)} />
              </Field>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Field label="Reference price">
                    <Space.Compact style={{ width: "100%" }}>
                      <Space.Addon>$</Space.Addon>
                      <InputNumber style={{ width: "100%" }} min={0.01} step={1} value={msrp} onChange={setMsrp} />
                    </Space.Compact>
                  </Field>
                </Col>
                <Col xs={24} sm={12}>
                  <Field label="Finder share">
                    <Space.Compact style={{ width: "100%" }}>
                      <InputNumber style={{ width: "100%" }} min={1} max={100} value={sharePct} onChange={setSharePct} />
                      <Space.Addon>%</Space.Addon>
                    </Space.Compact>
                  </Field>
                </Col>
                <Col xs={24} sm={12}>
                  <Field label="Pool (reference price in MON)">
                    <Input value={pool ? mon(pool) : "—"} readOnly aria-readonly="true" />
                  </Field>
                </Col>
                <Col xs={24} sm={12}>
                  <Field label="Expires in">
                    <Space.Compact style={{ width: "100%" }}>
                      <InputNumber style={{ width: "100%" }} min={1} value={days} onChange={setDays} />
                      <Space.Addon>days</Space.Addon>
                    </Space.Compact>
                  </Field>
                </Col>
              </Row>

              <ExamplePayout msrpCents={msrpCents} sharePct={sharePct} pool={pool} />

              {account ? (
                <Button type="primary" size="large" block loading={!!busy} onClick={() => void submit()}>
                  {busy === "wallet" ? "Confirm in your wallet" : busy === "confirming" ? "Posting on Monad" : "Post bounty"}
                </Button>
              ) : (
                <WalletButton block />
              )}

              {err && <Alert type="error" showIcon title={err} />}
              {tx && !busy && !err && (
                <Alert
                  type="success"
                  showIcon
                  title={
                    <>
                      Bounty posted.{" "}
                      <a href={explorerTx(tx)} target="_blank" rel="noreferrer">
                        View transaction <ExportOutlined />
                      </a>
                    </>
                  }
                />
              )}
            </Flex>
          </Card>
        </Flex>
      </Col>
    </Row>
  );
}

/** "If a hunter finds it for $199.20 ($49.80 saved), they earn $12.45 (0.12 MON)…" */
function ExamplePayout({
  msrpCents,
  sharePct,
  pool,
}: {
  msrpCents: bigint | null;
  sharePct: number | null;
  pool: bigint | null;
}) {
  if (!msrpCents || !pool || !sharePct || sharePct < 1 || sharePct > 100) return null;
  const found = (msrpCents * BigInt(80)) / BigInt(100);
  const paid = payoutWei(pool, sharePct, msrpCents, found);
  return (
    <Alert
      type="info"
      title={`If a hunter finds it for ${usd(found)} (${usd(msrpCents - found)} saved), they earn ${usdMon(paid)} and ${mon(pool - paid)} comes back to you. Demo rate: 1 MON = $${USD_PER_MON}.`}
    />
  );
}
