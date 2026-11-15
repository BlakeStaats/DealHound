"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Bounty,
  BountyStatus,
  CONTRACT_ADDRESS,
  DEAL_BOUNTY_ABI,
  monadTestnet,
} from "@/lib/contract";

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function getEthereum(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

async function ensureChain(eth: Eip1193) {
  const hexId = `0x${monadTestnet.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch {
    // Chain not added yet — add it, then it becomes active.
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: monadTestnet.name,
          nativeCurrency: monadTestnet.nativeCurrency,
          rpcUrls: monadTestnet.rpcUrls.default.http,
          blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}

function walletClient(eth: Eip1193, account: Address) {
  return createWalletClient({ account, chain: monadTestnet, transport: custom(eth) });
}

// ---------- wallet context ----------

type WalletCtx = {
  account: Address | null;
  connecting: boolean;
  hasWallet: boolean;
  connect: () => Promise<void>;
  createBounty: (args: {
    item: string;
    refPriceCents: bigint;
    sharePct: number;
    expiry: bigint;
    escrowMon: string;
  }) => Promise<Hex>;
  submitDeal: (args: {
    id: bigint;
    url: string;
    priceCents: bigint;
    oracleSig: Hex;
  }) => Promise<Hex>;
};

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(!!getEthereum());
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) throw new Error("No wallet detected. Install MetaMask (or a Monad-compatible wallet).");
    setConnecting(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
      await ensureChain(eth);
      setAccount(accounts[0] ?? null);
    } finally {
      setConnecting(false);
    }
  }, []);

  const createBounty = useCallback<WalletCtx["createBounty"]>(
    async ({ item, refPriceCents, sharePct, expiry, escrowMon }) => {
      const eth = getEthereum();
      if (!eth || !account) throw new Error("Connect a wallet first.");
      return walletClient(eth, account).writeContract({
        address: CONTRACT_ADDRESS,
        abi: DEAL_BOUNTY_ABI,
        functionName: "createBounty",
        args: [item, refPriceCents, sharePct, expiry],
        value: parseEther(escrowMon),
      });
    },
    [account],
  );

  const submitDeal = useCallback<WalletCtx["submitDeal"]>(
    async ({ id, url, priceCents, oracleSig }) => {
      const eth = getEthereum();
      if (!eth || !account) throw new Error("Connect a wallet first.");
      return walletClient(eth, account).writeContract({
        address: CONTRACT_ADDRESS,
        abi: DEAL_BOUNTY_ABI,
        functionName: "submitDeal",
        args: [id, url, priceCents, oracleSig],
      });
    },
    [account],
  );

  return (
    <Ctx.Provider value={{ account, connecting, hasWallet, connect, createBounty, submitDeal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

// ---------- on-chain reads ----------

export async function readBounties(): Promise<Bounty[]> {
  const count = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: DEAL_BOUNTY_ABI,
    functionName: "nextId",
  })) as bigint;

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const results = await Promise.all(
    ids.map((id) =>
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: DEAL_BOUNTY_ABI,
        functionName: "bounties",
        args: [id],
      }),
    ),
  );

  return results.map((r, i) => {
    const b = r as readonly [
      Address, bigint, number, number, bigint, bigint, Address, bigint, bigint, string, string,
    ];
    return {
      id: ids[i],
      poster: b[0],
      expiry: b[1],
      sharePct: Number(b[2]),
      status: b[3] as BountyStatus,
      refPriceCents: b[4],
      escrow: b[5],
      finder: b[6],
      foundPriceCents: b[7],
      payout: b[8],
      item: b[9],
      url: b[10],
    } satisfies Bounty;
  });
}

/** Hook that loads bounties from chain, with a manual refresh. */
export function useBounties() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBounties(await readBounties());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bounties, loading, error, refresh };
}
