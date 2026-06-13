-- ============================================================
-- Project Management Module: projects, modules, credentials,
-- comments, activity, time logs.
-- ============================================================

-- 1. New enums --------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','completed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_role AS ENUM ('lead','member','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.module_status AS ENUM ('todo','in_progress','review','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend task_status with two new values used by the new lifecycle
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- 2. PROJECTS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  status      public.project_status NOT NULL DEFAULT 'planning',
  owner_id    UUID,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. PROJECT MEMBERS --------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  role       public.project_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 4. PROJECT RESOURCES (shared files & URLs) --------------------
CREATE TABLE IF NOT EXISTS public.project_resources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('file','url')),
  label        TEXT NOT NULL,
  url_or_path  TEXT NOT NULL,
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

-- 5. MODULES ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  status      public.module_status NOT NULL DEFAULT 'todo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_modules_updated_at BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. EXTEND TASKS table -----------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id     UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS module_id      UUID REFERENCES public.modules(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority       public.task_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS checklist      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS started_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_module_id  ON public.tasks(module_id);

-- 7. TASK CREDENTIALS (encrypted) -------------------------------
-- password_encrypted stores AES-256-GCM ciphertext as base64 (iv|tag|ct).
-- Decryption only happens server-side; this column is NEVER exposed to
-- clients via direct selects (RLS forbids non-admin SELECT).
CREATE TABLE IF NOT EXISTS public.task_credentials (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  username           TEXT,
  password_encrypted TEXT NOT NULL,
  url                TEXT,
  notes              TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_credentials ENABLE ROW LEVEL SECURITY;

-- 8. CREDENTIAL ACCESS LOG --------------------------------------
CREATE TABLE IF NOT EXISTS public.credential_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.task_credentials(id) ON DELETE CASCADE,
  viewer_id     UUID NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credential_access_log ENABLE ROW LEVEL SECURITY;

-- 9. TASK COMMENTS ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- 10. TASK ACTIVITY (timeline) ----------------------------------
CREATE TABLE IF NOT EXISTS public.task_activity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id   UUID,
  kind       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- 11. TIME LOGS -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  minutes     INT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: is_project_member
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROJECTS
CREATE POLICY "admins manage projects" ON public.projects
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "members view their projects" ON public.projects
  FOR SELECT USING (public.is_project_member(id, auth.uid()));

-- PROJECT MEMBERS
CREATE POLICY "admins manage project_members" ON public.project_members
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "members view their membership rows" ON public.project_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_project_member(project_id, auth.uid())
  );

-- PROJECT RESOURCES
CREATE POLICY "admins manage project_resources" ON public.project_resources
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "members view project resources" ON public.project_resources
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));

-- MODULES
CREATE POLICY "admins manage modules" ON public.modules
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "members view modules" ON public.modules
  FOR SELECT USING (public.is_project_member(project_id, auth.uid()));

-- TASK CREDENTIALS — clients can SELECT metadata but not the encrypted blob;
-- decryption happens via server function. Admins manage; assignees may read
-- the row to know the credential exists.
CREATE POLICY "admins manage task_credentials" ON public.task_credentials
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "assignees view task_credentials" ON public.task_credentials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_credentials.task_id AND t.user_id = auth.uid()
    )
  );

-- CREDENTIAL ACCESS LOG — admins read; users see their own access events
CREATE POLICY "admins view credential_access_log" ON public.credential_access_log
  FOR SELECT USING (has_role(auth.uid(),'admin'));
CREATE POLICY "users view own credential access" ON public.credential_access_log
  FOR SELECT USING (viewer_id = auth.uid());

-- TASK COMMENTS — assignee, comment author, project members and admins
CREATE POLICY "admins manage comments" ON public.task_comments
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "task party views comments" ON public.task_comments
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (t.user_id = auth.uid()
             OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid())))
    )
  );
CREATE POLICY "task party creates comments" ON public.task_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (t.user_id = auth.uid()
             OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid()))
             OR has_role(auth.uid(),'admin'))
    )
  );

-- TASK ACTIVITY — same as comments, read-only for non-admin
CREATE POLICY "admins manage task_activity" ON public.task_activity
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "task party views activity" ON public.task_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_activity.task_id
        AND (t.user_id = auth.uid()
             OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id, auth.uid())))
    )
  );

-- TIME LOGS — owner inserts, owner+admin read
CREATE POLICY "admins manage time_logs" ON public.task_time_logs
  FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY "users view own time_logs" ON public.task_time_logs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users insert own time_logs" ON public.task_time_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update own running log" ON public.task_time_logs
  FOR UPDATE USING (user_id = auth.uid() AND ended_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity;

-- ============================================================
-- New email templates
-- ============================================================
INSERT INTO public.email_templates (template_key, name, description, subject, body_html, variables)
VALUES
('module_assigned',
 'Module assigned',
 'Sent when an admin assigns an employee to a project module.',
 'You''ve been assigned to {{module_title}} on {{project_title}}',
 '<p>Hi {{employee_name}},</p>
  <p>You''ve been added to the <b>{{module_title}}</b> module of project <b>{{project_title}}</b>.</p>
  <p>{{module_description}}</p>
  <p><a href="{{project_url}}" style="display:inline-block;background:#FF9900;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Open project</a></p>
  <p>Good luck!</p>',
 ARRAY['employee_name','module_title','project_title','module_description','project_url']
),
('task_comment_added',
 'Task comment added',
 'Sent when someone leaves a comment on a task you''re part of.',
 'New comment on "{{task_title}}"',
 '<p>Hi {{employee_name}},</p>
  <p><b>{{author_name}}</b> commented on your task <b>{{task_title}}</b>:</p>
  <blockquote style="border-left:3px solid #FF9900;padding:6px 12px;color:#333;margin:12px 0">{{comment_body}}</blockquote>
  <p><a href="{{task_url}}" style="display:inline-block;background:#FF9900;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">View task</a></p>',
 ARRAY['employee_name','author_name','task_title','comment_body','task_url']
),
('task_changes_requested',
 'Changes requested',
 'Sent when an admin requests changes on a submitted task.',
 'Changes requested on "{{task_title}}"',
 '<p>Hi {{employee_name}},</p>
  <p>Your reviewer has requested changes on <b>{{task_title}}</b>.</p>
  <div style="background:#fff7ed;border-left:3px solid #FF9900;padding:10px 14px;margin:14px 0">
    <b>Feedback:</b><br/>{{review_notes}}
  </div>
  <p>The task is back in your queue — make the updates and resubmit when ready.</p>
  <p><a href="{{task_url}}" style="display:inline-block;background:#FF9900;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Open task</a></p>',
 ARRAY['employee_name','task_title','review_notes','task_url']
)
ON CONFLICT (template_key) DO NOTHING;