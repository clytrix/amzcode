-- 1) Storage bucket for task attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path convention = {task_id}/{user_id}/{filename}
CREATE POLICY "task owners upload own attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "task owners view own attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "task owners delete own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND t.user_id = auth.uid()
      AND t.status IN ('assigned'::task_status, 'in_progress'::task_status)
  )
);

CREATE POLICY "admins view all task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2) Attachments tracking table
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task owners view own attachments rows"
ON public.task_attachments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "admins view all attachment rows"
ON public.task_attachments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "task owners insert own attachment rows"
ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND t.user_id = auth.uid()
      AND t.status IN ('assigned'::task_status, 'in_progress'::task_status, 'submitted'::task_status)
  )
);

CREATE POLICY "task owners delete own attachment rows"
ON public.task_attachments FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND t.user_id = auth.uid()
      AND t.status IN ('assigned'::task_status, 'in_progress'::task_status)
  )
);

CREATE POLICY "admins manage all attachment rows"
ON public.task_attachments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Review fields on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);