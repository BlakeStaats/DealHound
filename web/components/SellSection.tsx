"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { Alert, Button, Card, Col, Flex, Input, InputNumber, Row, Space, Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { explorerTx, mon, payoutWei } from "@/lib/contract";
import { friendlyTxError } from "@/lib/friendly";
import { useWallet, waitForTx } from "./wallet";
import { WalletButton } from "./ui";

const { Title, Text, Paragraph } = Typography;

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
  const [sharePct, setSharePct] = useState<number | null>(20);
  const [escrow, setEscrow] = useState<number | null>(1);
  const [days, setDays] = useState<number | null>(7);
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "wallet" | "confirming">(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setTx(null);
    try {
      if (!item.trim()) throw new Error("Item name is required.");
      if (!msrp || msrp <= 0) throw new Error("Reference price must be above $0.");
      if (!sharePct || sharePct < 1 || sharePct > 100) throw new Error("Finder share must be 1–100%.");
      if (!escrow || escrow <= 0) throw new Error("Add some MON to escrow.");
      if (!days || days <= 0) throw new Error("Expiry must be at least a day.");
      const refPriceCents = BigInt(Math.round(msrp * 100));
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.round(days * 86400));
      setBusy("wallet");
      const hash = await createBounty({
        item: item.trim(),
        refPriceCents,
        sharePct,
        expiry,
        escrowMon: String(escrow),
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
              Escrow MON against the reference price of something you want. The first hunter to verify a
              lower price earns their share of the savings, and the rest comes back to you. No deal before
              expiry means a full refund.
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
                  <Field label="Escrow">
                    <Space.Compact style={{ width: "100%" }}>
                      <InputNumber style={{ width: "100%" }} min={0.001} step={0.1} value={escrow} onChange={setEscrow} />
                      <Space.Addon>MON</Space.Addon>
                    </Space.Compact>
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

              <ExamplePayout msrp={msrp} sharePct={sharePct} escrow={escrow} />

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

/** "If a hunter finds it 20% cheaper, they earn X MON and you get Y back." */
function ExamplePayout({
  msrp,
  sharePct,
  escrow,
}: {
  msrp: number | null;
  sharePct: number | null;
  escrow: number | null;
}) {
  if (!msrp || !sharePct || !escrow || msrp <= 0 || sharePct < 1 || sharePct > 100 || escrow <= 0) return null;
  try {
    const ref = BigInt(Math.round(msrp * 100));
    const esc = parseEther(String(escrow));
    const paid = payoutWei(esc, sharePct, ref, (ref * BigInt(80)) / BigInt(100));
    return (
      <Alert
        type="info"
        title={`If a hunter finds it 20% cheaper, they earn ${mon(paid)} and ${mon(esc - paid)} comes back to you.`}
      />
    );
  } catch {
    return null;
  }
}
