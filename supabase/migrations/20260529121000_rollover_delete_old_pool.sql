-- Replace rollover function to delete old pool entries before creating new ones
CREATE OR REPLACE FUNCTION public.rollover_data_entry_pool()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE today date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date; inserted int := 0;
BEGIN
  -- Delete old pool entries from previous days (submissions cascade via FK)
  DELETE FROM public.data_entry_daily_pool WHERE pool_date < today;
  
  -- Skip if today's pool already exists
  IF EXISTS (SELECT 1 FROM public.data_entry_daily_pool WHERE pool_date = today) THEN
    RETURN jsonb_build_object('date', today, 'inserted', 0, 'skipped', true);
  END IF;
  
  INSERT INTO public.data_entry_daily_pool (pool_date, invoice_id, position)
  SELECT today, id, ROW_NUMBER() OVER (ORDER BY random()) - 1
  FROM public.data_entry_invoices WHERE is_active = true
  ORDER BY random() LIMIT 30;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN jsonb_build_object('date', today, 'inserted', inserted);
END; $$;

-- Enable pg_cron for automated daily tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule automated daily data entry pool refresh (00:05 AM IST)
SELECT cron.schedule('daily-data-entry-rollover', '35 18 * * *', 'SELECT public.rollover_data_entry_pool()');

-- Schedule automated daily salary accrual (00:10 AM IST)
SELECT cron.schedule('daily-salary-accrual', '40 18 * * *', 'SELECT public.accrue_daily_salary()');
