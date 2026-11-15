import { connection } from "next/server";
import { readOpenUnexpiredBounties, toOpenBountyJson, CONTRACT_ADDRESS, getRpcUrl } from "@/lib/contract";

/**
 * GET /api/bounties
 *
 * Reads `nextId` and `bounties(i)` from DealBounty via lib/contract.ts.
 * Returns open, unexpired bounties as JSON.
 *
 * Env: CONTRACT_ADDRESS (or NEXT_PUBLIC_CONTRACT_ADDRESS), RPC_URL / MONAD_RPC_URL
 * (or NEXT_PUBLIC_MONAD_RPC_URL). Defaults to the deployed Monad testnet contract + public RPC.
 */
export async function GET() {
  await connection(); // always read the chain at request time, never at build
  try {
    const open = await readOpenUnexpiredBounties();
    return Response.json({
      contract: CONTRACT_ADDRESS,
      rpc: getRpcUrl(),
      bounties: open.map(toOpenBountyJson),
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      {
        error: "rpc_failed",
        message: (e as Error).message ?? "failed to read bounties from chain",
        contract: CONTRACT_ADDRESS,
      },
      { status: 502 },
    );
  }
}
