import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Daily cron at 00:05 IST: refresh the data-entry pool and accrue daily salary.
 * Called by pg_cron via /api/public/* (no auth required by platform).
 */
export const Route = createFileRoute("/api/public/hooks/daily-rollover")({
  server: {
    handlers: {
      POST: async () => {
        const [pool, salary] = await Promise.all([
          supabaseAdmin.rpc("rollover_data_entry_pool" as any),
          supabaseAdmin.rpc("accrue_daily_salary" as any),
        ]);
        return Response.json({
          ok: true,
          pool: pool.data || pool.error?.message,
          salary: salary.data || salary.error?.message,
        });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run rollover" }),
    },
  },
});
