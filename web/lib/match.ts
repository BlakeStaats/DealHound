// Does a product page match what the bounty asked for?
// Used by the oracle (to refuse signing mismatched products) and by the UI / bot
// (to pick which demo products to try). Client-safe, no dependencies.

import { PRODUCTS, type Product } from "./stores";

const STOP = new Set([
  "the", "a", "an", "and", "or", "with", "for", "of", "in", "new", "by", "to", "on",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)); // airpods -> airpod
}

/** Fraction (0..1) of the bounty item's words that appear in the product name. */
export function matchScore(bountyItem: string, productName: string): number {
  const want = [...new Set(tokens(bountyItem))];
  if (want.length === 0) return 0;
  const have = new Set(tokens(productName));
  return want.filter((t) => have.has(t)).length / want.length;
}

export const MATCH_THRESHOLD = 0.6;

export function productMatches(bountyItem: string, productName: string): boolean {
  return matchScore(bountyItem, productName) >= MATCH_THRESHOLD;
}

/** Demo-catalog products that satisfy a bounty, best match first. */
export function matchingDemoProducts(bountyItem: string): Product[] {
  return PRODUCTS.map((p) => ({ p, score: matchScore(bountyItem, p.name) }))
    .filter((x) => x.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}
