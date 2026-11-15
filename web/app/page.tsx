import Link from "next/link";
import { STORES } from "@/lib/stores";

export default function Home() {
  return (
    <main style={{ padding: 24, maxWidth: 720, fontFamily: "system-ui, sans-serif" }}>
      <h1>MonadFLIP</h1>
      <p>Deal bounties on Monad Testnet. Frontend coming soon; the oracle is live.</p>
      <h2>Demo stores</h2>
      <ul>
        {STORES.map((s) => (
          <li key={s.slug}>
            <Link href={`/stores/${s.slug}`}>{s.name}</Link> — ${s.price.toFixed(2)}
          </li>
        ))}
      </ul>
      <h2>Oracle</h2>
      <ul>
        <li>
          <Link href="/api/oracle">GET /api/oracle</Link>
        </li>
        <li>POST /api/quote {"{ bountyId, url }"}</li>
      </ul>
    </main>
  );
}
