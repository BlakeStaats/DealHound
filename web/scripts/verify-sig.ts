// Usage: npm run verify [-- <storeSlug>]   (BASE_URL defaults to http://localhost:3000)
// Recomputes the hash locally (independently of the server code) and recovers the signer.
import { encodePacked, isAddressEqual, keccak256, recoverMessageAddress, type Address, type Hex } from "viem";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const slug = process.argv[2] ?? "dealdepot";
const expected = process.env.ORACLE_ADDRESS as Address | undefined;
const chainId = BigInt(process.env.CHAIN_ID ?? "10143");
const contract = (process.env.CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;

async function main() {
  if (!expected) throw new Error("ORACLE_ADDRESS not set (run via `npm run verify`, which loads .env.local)");

  const cfg = await (await fetch(`${BASE}/api/oracle`)).json();
  console.log("GET /api/oracle →", cfg);

  const bountyId = "42";
  const url = `${BASE}/stores/${slug}`;
  const res = await fetch(`${BASE}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bountyId, url }),
  });
  const q = await res.json();
  console.log(`POST /api/quote (${res.status}) →`, q);
  if (!res.ok) throw new Error(`quote failed: ${q.error}`);

  const hash = keccak256(
    encodePacked(
      ["uint256", "string", "uint256", "uint256", "address"],
      [BigInt(q.bountyId), q.url, BigInt(q.priceCents), chainId, contract],
    ),
  );
  const signer = await recoverMessageAddress({ message: { raw: hash }, signature: q.sig as Hex });

  console.log("local hash   ", hash, hash === q.hash ? "(matches server)" : "(DIFFERS from server!)");
  console.log("recovered    ", signer);
  console.log("ORACLE_ADDRESS", expected);

  const ok = isAddressEqual(signer, expected) && isAddressEqual(cfg.oracle, expected);
  console.log(ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
