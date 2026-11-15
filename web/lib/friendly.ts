// Human-readable versions of oracle and contract errors.
import { usd } from "./contract";

export class QuoteError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function friendlyQuoteError(e: unknown): string {
  if (!(e instanceof QuoteError)) return "Couldn't reach the price oracle. Try again.";
  const m = /page is for "(.+)" but bounty \d+ wants "(.+)"/.exec(e.message);
  switch (e.code) {
    case "product_mismatch":
      return m ? `That page sells “${m[1]}”, but this bounty wants “${m[2]}”.` : e.message;
    case "bad_host":
      return "We can only verify prices from approved stores right now. Try a demo store below.";
    case "bad_url":
      return "That doesn't look like a product link. Paste the full https:// URL.";
    case "no_price":
      return "Couldn't find a price on that page.";
    case "no_product":
      return "Couldn't tell what product that page is for.";
    case "fetch_failed":
      return "Couldn't load that page. Check the link and try again.";
    case "bad_currency":
      return "That price isn't in US dollars.";
    case "bounty_not_open":
      return "Someone already filled this bounty.";
    case "bounty_expired":
      return "This bounty has expired.";
    default:
      return e.message;
  }
}

/** Walks a viem error chain for the custom error name (e.g. PriceNotBelowRef). */
function revertName(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 8 && cur; i++) {
    const c = cur as { data?: { errorName?: string }; cause?: unknown };
    if (c.data?.errorName) return c.data.errorName;
    cur = c.cause;
  }
  return undefined;
}

export function friendlyTxError(e: unknown, refPriceCents?: bigint): string {
  const text = `${(e as { shortMessage?: string }).shortMessage ?? ""} ${(e as Error)?.message ?? ""}`;
  if (/user rejected|user denied|rejected the request/i.test(text)) return "You cancelled in your wallet.";
  if (/insufficient funds/i.test(text)) return "Your wallet needs a little testnet MON for gas.";
  switch (revertName(e)) {
    case "PriceNotBelowRef":
      return refPriceCents ? `That price isn't below the ${usd(refPriceCents)} target.` : "That price isn't below the target.";
    case "BountyNotOpen":
      return "Too slow! Someone just filled this bounty.";
    case "BountyExpired":
      return "This bounty has expired.";
    case "BadSignature":
      return "The price signature didn't verify. Get a fresh quote and try again.";
    case "InvalidSharePct":
      return "Finder share must be between 1% and 100%.";
    case "InvalidExpiry":
      return "Expiry must be in the future.";
    case "NoEscrow":
      return "Add some MON to escrow.";
    case "InvalidRefPrice":
      return "Reference price must be above $0.";
  }
  return (e as { shortMessage?: string }).shortMessage ?? (e as Error)?.message ?? "Transaction failed.";
}
