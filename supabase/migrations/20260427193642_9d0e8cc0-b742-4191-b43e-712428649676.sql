-- Schedule daily rollover at 00:05 IST (18:35 UTC) to refresh data-entry pool and accrue salary.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'awz-daily-rollover') THEN
    PERFORM cron.unschedule('awz-daily-rollover');
  END IF;
END $$;

SELECT cron.schedule(
  'awz-daily-rollover',
  '35 18 * * *',
  $$
  SELECT public.rollover_data_entry_pool();
  SELECT public.accrue_daily_salary();
  $$
);

-- Helpful indexes for new flows
CREATE INDEX IF NOT EXISTS idx_data_entry_submissions_user_pool ON public.data_entry_submissions (user_id, pool_date);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON public.wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_updated ON public.tickets (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_status_updated ON public.kyc_submissions (status, updated_at DESC);

-- Make sure unique constraint exists on wallet_transactions.reference for idempotent salary credits
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_tx_reference ON public.wallet_transactions (reference) WHERE reference IS NOT NULL;