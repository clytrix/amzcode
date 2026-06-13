-- Schedule daily background jobs for data-entry rotation, salary accrual, and slip purge
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing schedules with same names if present (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('rollover-data-entry-pool');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('accrue-daily-salary');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-salary-slips');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 00:05 IST = 18:35 UTC — rotate data entry pool
SELECT cron.schedule(
  'rollover-data-entry-pool',
  '35 18 * * *',
  $$ SELECT public.rollover_data_entry_pool(); $$
);

-- 00:10 IST = 18:40 UTC — accrue daily salary
SELECT cron.schedule(
  'accrue-daily-salary',
  '40 18 * * *',
  $$ SELECT public.accrue_daily_salary(); $$
);

-- 03:00 IST = 21:30 UTC — purge salary slips older than 60 days
SELECT cron.schedule(
  'purge-old-salary-slips',
  '30 21 * * *',
  $$ SELECT public.purge_old_salary_slips(); $$
);