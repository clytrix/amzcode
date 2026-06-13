import { useEffect, useState } from "react";
import { getUsdInrRate } from "@/server/fx.functions";
import { USD_TO_INR_RATE } from "@/lib/currency";

let cached: { rate: number; at: number } | null = null;
const TTL = 30 * 60 * 1000; // 30min in-tab cache

/**
 * Returns the live USD→INR rate (server-cached for 6h, refreshed on demand).
 * Falls back to the static `USD_TO_INR_RATE` while loading or on error.
 */
export function useUsdInrRate() {
  const [rate, setRate] = useState<number>(cached?.rate ?? USD_TO_INR_RATE);
  const [source, setSource] = useState<string>(cached ? "cache" : "fallback");

  useEffect(() => {
    if (cached && Date.now() - cached.at < TTL) {
      setRate(cached.rate);
      return;
    }
    let alive = true;
    getUsdInrRate()
      .then((res) => {
        if (!alive) return;
        cached = { rate: res.rate, at: Date.now() };
        setRate(res.rate);
        setSource(res.source);
      })
      .catch(() => {
        setRate(USD_TO_INR_RATE);
        setSource("fallback");
      });
    return () => { alive = false; };
  }, []);

  return { rate, source };
}
