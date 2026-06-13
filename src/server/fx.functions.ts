import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FALLBACK_RATE = 95;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchLiveRate(): Promise<number | null> {
  // Free endpoint, no API key required.
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const json: any = await r.json();
    const rate = Number(json?.rates?.INR);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Returns the current USD→INR rate, caching the result in `fx_rates` for 6h.
 * Falls back to a hardcoded constant if the upstream API is unreachable.
 */
export const getUsdInrRate = createServerFn({ method: "GET" }).handler(async () => {
  const { data: cached } = await supabaseAdmin
    .from("fx_rates")
    .select("rate, fetched_at")
    .eq("base", "USD")
    .eq("quote", "INR")
    .maybeSingle();

  const cachedAt = cached?.fetched_at ? new Date(cached.fetched_at).getTime() : 0;
  const isFresh = cached && Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh && cached) {
    return { rate: Number(cached.rate), fetchedAt: cached.fetched_at, source: "cache" as const };
  }

  const live = await fetchLiveRate();
  if (live) {
    await supabaseAdmin
      .from("fx_rates")
      .upsert({ base: "USD", quote: "INR", rate: live, fetched_at: new Date().toISOString() });
    return { rate: live, fetchedAt: new Date().toISOString(), source: "live" as const };
  }

  // Live fetch failed — return stale cache if we have it, otherwise fallback.
  if (cached) {
    return { rate: Number(cached.rate), fetchedAt: cached.fetched_at, source: "stale" as const };
  }
  return { rate: FALLBACK_RATE, fetchedAt: new Date().toISOString(), source: "fallback" as const };
});
