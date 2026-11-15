"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { CONTRACT_ADDRESS, explorerAddress } from "@/lib/contract";
import { WalletProvider, useBounties } from "@/components/wallet";
import { WalletButton, shortAddr } from "@/components/ui";
import { BuySection } from "@/components/BuySection";
import { SellSection } from "@/components/SellSection";
import { NftGallery } from "@/components/NftGallery";
import { Landing } from "@/components/Landing";
import s from "./market.module.css";

type Tab = "hunt" | "post" | "nfts";

function Market() {
  const [tab, setTab] = useState<Tab>("hunt");
  const [entered, setEntered] = useState(false);
  const bountiesHook = useBounties();

  return (
    <div className={s.app}>
      <header className={s.topbar}>
        <button
          className={s.brand}
          onClick={() => setEntered(false)}
          title="Back to home"
          aria-label="DealHound home"
        >
          <Image src="/bloodhound-logo-256.png" alt="" width={44} height={44} priority />
          <div>
            <div className={s.brandName}>DealHound</div>
            <div className={s.brandSub}>deal bounty marketplace</div>
          </div>
        </button>
        <div className={s.topbarRight}>
          <Link href="/agents" className={s.agentsLink}>
            Bot docs
          </Link>
          <WalletButton />
        </div>
      </header>

      {!entered ? (
        <Landing onEnter={() => setEntered(true)} />
      ) : (
        <>
          <nav className={s.tabs}>
            <button className={tab === "hunt" ? s.tabActive : s.tab} onClick={() => setTab("hunt")}>
              Hunt deals
            </button>
            <button className={tab === "post" ? s.tabActive : s.tab} onClick={() => setTab("post")}>
              Post a bounty
            </button>
            <button className={tab === "nfts" ? s.tabActive : s.tab} onClick={() => setTab("nfts")}>
              Deal Proofs
            </button>
          </nav>

          <main className={s.main}>
            {tab === "hunt" && <BuySection bountiesHook={bountiesHook} onViewProofs={() => setTab("nfts")} />}
            {tab === "post" && (
              <SellSection
                onPosted={() => {
                  bountiesHook.refresh();
                  setTab("hunt");
                }}
              />
            )}
            {tab === "nfts" && <NftGallery bounties={bountiesHook.bounties} />}
          </main>
        </>
      )}

      <footer className={s.footer}>
        Contract{" "}
        <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
          {shortAddr(CONTRACT_ADDRESS)}
        </a>{" "}
        · Monad Testnet (10143) ·{" "}
        <Link href="/agents">Agent / bot flow</Link>
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
