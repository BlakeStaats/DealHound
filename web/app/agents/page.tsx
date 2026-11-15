import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent / bot flow · MonadFLIP",
  description: "How bots hunt MonadFLIP bounties: list, quote, submitDeal",
};

const pre: CSSProperties = {
  background: "#141825",
  border: "1px solid #262c40",
  borderRadius: 10,
  padding: 14,
  overflow: "auto",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#e7e9f2",
};

const warn: CSSProperties = {
  background: "rgba(251, 191, 36, 0.1)",
  border: "1px solid rgba(251, 191, 36, 0.35)",
  borderRadius: 10,
  padding: "12px 14px",
  color: "#fbbf24",
  lineHeight: 1.5,
};

export default function AgentsPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 20px 64px",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#e7e9f2",
        background: "radial-gradient(1000px 500px at 80% -20%, #1a1340 0%, #0b0d14 55%)",
        minHeight: "100vh",
      }}
    >
      <p style={{ margin: "0 0 8px" }}>
        <Link href="/" style={{ color: "#a78bfa" }}>
          ← Marketplace
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>Bot / agent hunter flow</h1>
      <p style={{ color: "#8b90a6", lineHeight: 1.6 }}>
        Humans and bots fill bounties the same way: discover open bounties, ask the oracle for a
        signed price on a product URL, then call <code>submitDeal</code> from a wallet. Use the
        demo hunter script (<code>npm run hunter</code>) for a live poll loop.
      </p>

      <h2>1. List open bounties</h2>
      <pre style={pre}>{`GET /api/bounties

→ {
  "bounties": [
    {
      "id": "0",
      "item": "AirPods Pro 2",
      "refPriceCents": "24900",
      "sharePct": 20,
      "escrow": "100000000000000000",
      "expiry": "1730000000"
    }
  ]
}`}</pre>

      <h2>2. Quote a product URL</h2>
      <pre style={pre}>{`POST /api/quote
Content-Type: application/json

{ "bountyId": "0", "url": "https://your-app/stores/dealdepot" }

→ {
  "bountyId": "0",
  "url": "https://your-app/stores/dealdepot",
  "priceCents": 18900,
  "sig": "0x…"
}`}</pre>

      <div style={warn}>
        <strong>Critical:</strong> the oracle signs the exact <code>url</code> string. On-chain{" "}
        <code>submitDeal</code> must use the <em>exact</em> <code>url</code> returned by{" "}
        <code>/api/quote</code> — do not normalize, trim, or rebuild it, or the signature check
        fails.
      </div>

      <h2>3. Submit on-chain</h2>
      <p style={{ color: "#8b90a6", lineHeight: 1.6 }}>
        From the hunter wallet (browser or <code>HUNTER_PRIVATE_KEY</code>):
      </p>
      <pre style={pre}>{`submitDeal(
  id,          // bounty id (uint256)
  url,         // EXACT quote.url from step 2
  priceCents,  // quote.priceCents
  oracleSig    // quote.sig
)`}</pre>
      <p style={{ color: "#8b90a6", lineHeight: 1.6 }}>
        Only prices strictly below <code>refPriceCents</code> succeed. The contract pays the finder
        their share of savings, refunds the poster, and mints a Deal Proof NFT to{" "}
        <code>msg.sender</code>.
      </p>

      <h2>Demo bot</h2>
      <pre style={pre}>{`# web/.env.local
HUNTER_PRIVATE_KEY=0x…   # funded Monad testnet key
HUNTER_BASE_URL=http://localhost:3000
CONTRACT_ADDRESS=0x629751D83702E11FFbB84a44fE9990a5E36B4501

cd web && npm run hunter`}</pre>
      <p style={{ color: "#8b90a6", lineHeight: 1.6 }}>
        The bot polls <code>/api/bounties</code> every 3s, quotes all <code>/stores/*</code> demo
        pages for each new open bounty, picks the lowest price below the reference, and submits
        with the hunter key.
      </p>
    </main>
  );
}
