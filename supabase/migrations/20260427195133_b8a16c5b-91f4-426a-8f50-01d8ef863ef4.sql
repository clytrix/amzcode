-- Tighten RLS on data_entry_submissions to require pool membership for today's pool
DROP POLICY IF EXISTS "users insert own submissions" ON public.data_entry_submissions;

CREATE POLICY "users insert own submissions"
ON public.data_entry_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND reward_credited = false
  AND is_done = false
  AND pool_date = ((now() AT TIME ZONE 'Asia/Kolkata')::date)
  AND EXISTS (
    SELECT 1 FROM public.data_entry_daily_pool p
    WHERE p.id = data_entry_submissions.pool_id
      AND p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata')::date)
  )
);

-- Also tighten update policy so users can't change pool_id to a different pool
DROP POLICY IF EXISTS "users update own open submissions" ON public.data_entry_submissions;

CREATE POLICY "users update own open submissions"
ON public.data_entry_submissions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND reward_credited = false
  AND pool_date = ((now() AT TIME ZONE 'Asia/Kolkata')::date)
)
WITH CHECK (
  auth.uid() = user_id
  AND pool_date = ((now() AT TIME ZONE 'Asia/Kolkata')::date)
  AND EXISTS (
    SELECT 1 FROM public.data_entry_daily_pool p
    WHERE p.id = data_entry_submissions.pool_id
      AND p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata')::date)
  )
);