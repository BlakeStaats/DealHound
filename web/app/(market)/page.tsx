"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { Button, Tabs, Typography } from "antd";
import { CONTRACT_ADDRESS, explorerAddress } from "@/lib/contract";
import { WalletProvider, useBounties } from "@/components/wallet";
import { WalletButton, shortAddr } from "@/components/ui";
import { BuySection } from "@/components/BuySection";
import { SellSection } from "@/components/SellSection";
import { NftGallery } from "@/components/NftGallery";
import { Landing } from "@/components/Landing";
import s from "@/app/market.module.css";

type Tab = "hunt" | "post" | "nfts";

function Market() {
  const [tab, setTab] = useState<Tab>("hunt");
  const [entered, setEntered] = useState(false);
  const bountiesHook = useBounties();

  return (
    <div className={s.app}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <button className={s.brand} onClick={() => setEntered(false)} aria-label="DealHound home">
            <Image src="/bloodhound-logo-256.png" alt="" width={32} height={32} priority />
            <span className={s.brandName}>DealHound</span>
          </button>
          <div className={s.headerRight}>
            <Link href="/agents">
              <Button type="text">Bot docs</Button>
            </Link>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className={s.container}>
        {!entered ? (
          <Landing onEnter={() => setEntered(true)} />
        ) : (
          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as Tab)}
            size="large"
            items={[
              {
                key: "hunt",
                label: "Hunt deals",
                children: <BuySection bountiesHook={bountiesHook} onViewProofs={() => setTab("nfts")} />,
              },
              {
                key: "post",
                label: "Post a bounty",
                children: (
                  <SellSection
                    onPosted={() => {
                      void bountiesHook.refresh();
                      setTab("hunt");
                    }}
                  />
                ),
              },
              { key: "nfts", label: "Deal Proofs", children: <NftGallery bounties={bountiesHook.bounties} /> },
            ]}
          />
        )}
      </main>

      <footer className={s.footer}>
        <Typography.Text type="secondary">
          Contract{" "}
          <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
            {shortAddr(CONTRACT_ADDRESS)}
          </a>{" "}
          · Monad Testnet (10143) · <Link href="/agents">Agent / bot flow</Link>
        </Typography.Text>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <WalletProvider>
      <Market />
    </WalletProvider>
  );
}
