import {
  OracleError,
  checkUrl,
  extractPrice,
  extractProductName,
  fetchPage,
  getConfig,
  parseBountyId,
  quoteHash,
  readOpenBounty,
} from "@/lib/oracle";
import { matchScore, MATCH_THRESHOLD } from "@/lib/match";

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

    // The bounty must exist on the contract we sign for, and still be open.
    const bounty = await readOpenBounty(bountyId, contract);

    const html = await fetchPage(target);
    const found = extractPrice(html);
    if (!found) {
      throw new OracleError("no_price", "no price found (JSON-LD offers.price, meta itemprop=price, og:price:amount)", 422);
    }
    if (found.currency && found.currency.toUpperCase() !== "USD") {
      throw new OracleError("bad_currency", `price is in ${found.currency}, only USD is supported`, 422);
    }

    // Refuse to sign a page for a different product than the bounty asked for.
    const productName = extractProductName(html);
    if (!productName) {
      throw new OracleError("no_product", "no product name found on the page (JSON-LD Product.name, og:title, <title>)", 422);
    }
    const score = matchScore(bounty.item, productName);
    if (score < MATCH_THRESHOLD) {
      throw new OracleError(
        "product_mismatch",
        `page is for "${productName}" but bounty ${bountyId} wants "${bounty.item}"`,
        422,
      );
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
      productName,
      bountyItem: bounty.item,
      matchScore: Number(score.toFixed(2)),
      beatsReference: BigInt(found.cents) < bounty.refPriceCents,
    });
  } catch (e) {
    if (e instanceof OracleError) {
      return Response.json({ error: e.code, message: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "internal", message: "unexpected oracle error" }, { status: 500 });
  }
}
