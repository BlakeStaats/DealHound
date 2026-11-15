// Live MON/USD spot price for the header ticker. The marketplace pools still use the fixed
// demo rate (USD_PER_MON); this is shown only as real-world context.
const COINGECKO = "https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd";

export async function GET() {
  try {
    const res = await fetch(COINGECKO, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      // Cache at the edge/runtime for a minute so we don't hammer CoinGecko.
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`coingecko HTTP ${res.status}`);
    const data = (await res.json()) as { monad?: { usd?: number } };
    const usd = data.monad?.usd;
    if (typeof usd !== "number") throw new Error("no price in response");
    return Response.json({ usd, source: "coingecko", asOf: Date.now() });
  } catch {
    // Non-fatal: the ticker just renders a dash if this fails.
    return Response.json({ usd: null, error: "price_unavailable" });
  }
}
