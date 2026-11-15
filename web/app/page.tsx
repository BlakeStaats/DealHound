"use client";
import Image from "next/image";
import { useState } from "react";
import { CONTRACT_ADDRESS, explorerAddress } from "@/lib/contract";
import { WalletProvider, useBounties } from "@/components/wallet";
import { WalletButton, shortAddr } from "@/components/ui";
import { BuySection } from "@/components/BuySection";
import { SellSection } from "@/components/SellSection";
import { NftGallery } from "@/components/NftGallery";
import s from "./market.module.css";

type Tab = "buy" | "sell" | "nfts";

function Market() {
  const [tab, setTab] = useState<Tab>("buy");
  const bountiesHook = useBounties();

  return (
    <div className={s.app}>
      <header className={s.topbar}>
        <div className={s.brand}>
          <Image src="/bloodhound-logo-256.png" alt="" width={44} height={44} priority />
          <div>
            <div className={s.brandName}>DealHound</div>
            <div className={s.brandSub}>deal bounty marketplace</div>
          </div>
        </div>
        <WalletButton />
      </header>

      <nav className={s.tabs}>
        <button className={tab === "buy" ? s.tabActive : s.tab} onClick={() => setTab("buy")}>
          Buy · find deals
        </button>
        <button className={tab === "sell" ? s.tabActive : s.tab} onClick={() => setTab("sell")}>
          Sell · post bounty
        </button>
        <button className={tab === "nfts" ? s.tabActive : s.tab} onClick={() => setTab("nfts")}>
          Deal Proofs
        </button>
      </nav>

      <main className={s.main}>
        {tab === "buy" && <BuySection bountiesHook={bountiesHook} />}
        {tab === "sell" && (
          <SellSection
            onPosted={() => {
              bountiesHook.refresh();
              setTab("buy");
            }}
          />
        )}
        {tab === "nfts" && <NftGallery bounties={bountiesHook.bounties} />}
      </main>

      <footer className={s.footer}>
        Contract{" "}
        <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
          {shortAddr(CONTRACT_ADDRESS)}
        </a>{" "}
        · Monad Testnet (10143)
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
