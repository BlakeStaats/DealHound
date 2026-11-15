import { OracleError, allowedHosts, getConfig } from "@/lib/oracle";

export async function GET() {
  try {
    const { account, chainId, contract, contractIsPlaceholder } = getConfig();
    return Response.json({
      oracle: account.address,
      chainId,
      contract,
      contractIsPlaceholder,
      allowedHosts: allowedHosts(),
    });
  } catch (e) {
    const err = e instanceof OracleError ? e : new OracleError("internal", "unexpected error", 500);
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
}
