"use client";

import { useEffect, useState } from "react";
import { Tag, Tooltip } from "antd";
import { USD_PER_MON } from "@/lib/contract";

function fmtUsd(n: number): string {
  // MON trades in cents, so keep enough precision to be meaningful.
  const digits = n < 1 ? 4 : 2;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
}

/** Header ticker: live MON market price. Pools use the fixed demo rate (shown on hover). */
export function PriceTicker() {
  const [usd, setUsd] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/mon-price");
        const data = (await res.json()) as { usd?: number | null };
        if (alive && typeof data.usd === "number") setUsd(data.usd);
      } catch {
        /* keep last value */
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Tooltip title={`Live MON market price (CoinGecko). Demo pools use a fixed rate of 1 MON = $${USD_PER_MON}.`}>
      <Tag color="blue" style={{ marginInlineEnd: 0, fontVariantNumeric: "tabular-nums" }}>
        MON {usd === null ? "—" : fmtUsd(usd)}
      </Tag>
    </Tooltip>
  );
}
