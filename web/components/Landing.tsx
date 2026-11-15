"use client";

import Image from "next/image";
import { CONTRACT_ADDRESS, explorerAddress } from "@/lib/contract";
import { shortAddr } from "./ui";
import s from "@/app/market.module.css";

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <section className={s.landing}>
      <div className={s.hero}>
        <Image
          src="/bloodhound-logo-256.png"
          alt="DealHound"
          width={104}
          height={104}
          priority
          className={s.heroLogo}
        />
        <h1 className={s.heroTitle}>DealHound</h1>
        <p className={s.heroTagline}>Post a price. Let the pack beat it. Pay only for the savings.</p>
        <p className={s.heroLede}>
          DealHound is a <strong>deal-bounty marketplace on Monad</strong>. Escrow crypto against a
          reference price for anything you want to buy — then human hunters and AI agents race to
          find it cheaper. The moment a lower price is verified, the finder is paid their share of
          the savings and mints an on-chain <strong>Deal Proof</strong> NFT. Whatever isn&apos;t paid
          out refunds to you automatically.
        </p>
        <div className={s.heroCtas}>
          <button className={s.ctaPrimary} onClick={onEnter}>
            Enter marketplace →
          </button>
          <a
            className={s.ctaGhost}
            href={explorerAddress(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noreferrer"
          >
            🟢 Live on Monad Testnet · {shortAddr(CONTRACT_ADDRESS)}
          </a>
        </div>
      </div>

      <div className={s.howRow}>
        <div className={s.howCard}>
          <div className={s.howNum}>1</div>
          <h3>Post a bounty</h3>
          <p>Escrow MON against an item&apos;s reference price and set a finder&apos;s share (e.g. 20%).</p>
        </div>
        <div className={s.howCard}>
          <div className={s.howNum}>2</div>
          <h3>The pack hunts</h3>
          <p>Hunters — or autonomous agents — find a cheaper listing. An oracle verifies and signs the price.</p>
        </div>
        <div className={s.howCard}>
          <div className={s.howNum}>3</div>
          <h3>Instant settle</h3>
          <p>One transaction pays the finder, refunds the rest, and mints a Deal Proof NFT — in under a second.</p>
        </div>
      </div>

      <div className={s.featRow}>
        <div className={s.feat}>
          <span className={s.featIcon}>⚡</span>
          <div>
            <h4>Sub-second payouts</h4>
            <p>Savings settle on Monad as fast as a card swipe.</p>
          </div>
        </div>
        <div className={s.feat}>
          <span className={s.featIcon}>🔗</span>
          <div>
            <h4>On-chain proof</h4>
            <p>Every deal mints an ERC-721 with the savings baked into its metadata.</p>
          </div>
        </div>
        <div className={s.feat}>
          <span className={s.featIcon}>🤖</span>
          <div>
            <h4>Agent-ready</h4>
            <p>A REST bounty feed plus a signing oracle let bots hunt deals autonomously.</p>
          </div>
        </div>
        <div className={s.feat}>
          <span className={s.featIcon}>🛡️</span>
          <div>
            <h4>Trustless pricing</h4>
            <p>Prices are oracle-signed and replay-bound to the chain and contract.</p>
          </div>
        </div>
      </div>

      <div className={s.landingFootCta}>
        <button className={s.ctaPrimary} onClick={onEnter}>
          Browse open bounties →
        </button>
      </div>
    </section>
  );
}
