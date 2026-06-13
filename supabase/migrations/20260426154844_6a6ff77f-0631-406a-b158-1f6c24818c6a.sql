-- Allow multiple attendance sessions per day for the same user
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_work_date_key;

-- Helper to check if a user has at least one approved job application.
-- Used by RLS and the dashboard gating UI.
CREATE OR REPLACE FUNCTION public.has_approved_application(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_applications
    WHERE user_id = _user_id AND status = 'approved'
  )
$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_status ON public.job_applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline ON public.tasks(status, deadline);