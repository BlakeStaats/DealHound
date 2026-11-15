import {
  OracleError,
  checkUrl,
  extractPrice,
  fetchPage,
  getConfig,
  parseBountyId,
  quoteHash,
} from "@/lib/oracle";

export async function POST(req: Request) {
  try {
    const { account, chainId, contract } = getConfig();

    let body: { bountyId?: unknown; url?: unknown };
    try {
      body = await req.json();
    } catch {
      throw new OracleError("bad_request", "body must be JSON: { bountyId, url }");
    }

    const bountyId = parseBountyId(body.bountyId);
    const target = checkUrl(body.url);
    const url = body.url as string; // sign the exact string the finder will submit on-chain

    const html = await fetchPage(target);
    const found = extractPrice(html);
    if (!found) {
      throw new OracleError("no_price", "no price found (JSON-LD offers.price, meta itemprop=price, og:price:amount)", 422);
    }
    if (found.currency && found.currency.toUpperCase() !== "USD") {
      throw new OracleError("bad_currency", `price is in ${found.currency}, only USD is supported`, 422);
    }

    const hash = quoteHash(bountyId, url, BigInt(found.cents), BigInt(chainId), contract);
    const sig = await account.signMessage({ message: { raw: hash } });

    return Response.json({
      bountyId: bountyId.toString(),
      url,
      priceCents: found.cents,
      sig,
      oracle: account.address,
      // extras for debugging
      hash,
      chainId,
      contract,
      priceSource: found.source,
    });
  } catch (e) {
    if (e instanceof OracleError) {
      return Response.json({ error: e.code, message: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "internal", message: "unexpected oracle error" }, { status: 500 });
  }
}
