"use client";

import {
  createWalletClient,
  custom,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Bounty,
  BountyStatus,
  CONTRACT_ADDRESS,
  DEAL_BOUNTY_ABI,
  createDealPublicClient,
  monadTestnet,
  readAllBounties,
} from "@/lib/contract";

export const publicClient = createDealPublicClient();

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
  return readAllBounties();
}

export type Activity = {
  key: string;
  kind: "posted" | "filled";
  bounty: Bounty;
  at: number | null; // ms timestamp when we saw it happen; null = before this page loaded
};

const POLL_MS = 4000;

/**
 * Loads bounties from chain and keeps them fresh (polls every 4s, no loading flash).
 * Diffs each poll against the last one to build a live activity feed, so claims made by
 * anyone (humans in other browsers, bots) show up within a few seconds.
 */
export function useBounties() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const prev = useRef<Map<string, Bounty> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await readBounties();
      setError(null);
      setBounties(next);

      const now = Date.now();
      const events: Activity[] = [];
      if (prev.current === null) {
        // First load: seed the feed with history (no timestamps on-chain without logs).
        for (const b of next) {
          events.push({ key: `p${b.id}`, kind: "posted", bounty: b, at: null });
          if (b.status === BountyStatus.Filled) events.push({ key: `f${b.id}`, kind: "filled", bounty: b, at: null });
        }
      } else {
        for (const b of next) {
          const old = prev.current.get(b.id.toString());
          if (!old) events.push({ key: `p${b.id}`, kind: "posted", bounty: b, at: now });
          if (b.status === BountyStatus.Filled && old?.status !== BountyStatus.Filled) {
            events.push({ key: `f${b.id}`, kind: "filled", bounty: b, at: now });
          }
        }
      }
      prev.current = new Map(next.map((b) => [b.id.toString(), b]));
      if (events.length) {
        setActivity((cur) => {
          const seen = new Set(cur.map((a) => a.key));
          const fresh = events.filter((e) => !seen.has(e.key));
          // Live events: newest bounty first. History (no timestamps): claims first, then posts.
          const sorted = [...fresh].sort(
            (a, b) =>
              (a.at === null && a.kind !== b.kind ? (a.kind === "filled" ? -1 : 1) : 0) ||
              Number(b.bounty.id - a.bounty.id),
          );
          return [...sorted, ...cur].slice(0, 30);
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  return { bounties, loading, error, refresh, activity };
}

/** Waits for a tx to be mined; throws if it reverted. */
export async function waitForTx(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
  return receipt;
}
