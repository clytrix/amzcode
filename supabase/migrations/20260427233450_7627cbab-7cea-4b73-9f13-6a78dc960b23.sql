-- Tighten SELECT policies on data_entry_* tables to authenticated + role checks

-- data_entry_invoices: replace public SELECT policy
DROP POLICY IF EXISTS "employees view active invoices in todays pool" ON public.data_entry_invoices;
CREATE POLICY "employees view active invoices in todays pool"
ON public.data_entry_invoices
FOR SELECT
TO authenticated
USING (
  (is_active = true)
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'employee'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.data_entry_daily_pool p
    WHERE p.invoice_id = data_entry_invoices.id
      AND p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date
  )
);

-- data_entry_submissions: restrict SELECT to authenticated owner
DROP POLICY IF EXISTS "users view own submissions" ON public.data_entry_submissions;
CREATE POLICY "users view own submissions"
ON public.data_entry_submissions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- data_entry_daily_pool already restricted to authenticated; no change needed
