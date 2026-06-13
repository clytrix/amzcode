
-- 1) Lock down public.has_role so it only ever answers about the calling user.
-- All existing RLS policies and call sites pass auth.uid() as _user_id, so this
-- is a safe tightening: it removes the ability for an authenticated user to
-- enumerate other users' role assignments via this SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- Only allow the caller to ask about themselves. Returning false for any
      -- other input prevents role enumeration of admins or other users.
      WHEN auth.uid() IS NULL OR auth.uid() <> _user_id THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      )
    END
$$;

-- 2) Stop broadcasting tasks / task_comments / task_activity over Realtime.
-- The application does not subscribe to these channels, and leaving them in
-- the supabase_realtime publication lets any authenticated client subscribe
-- and receive row-change events for other users' data.
ALTER PUBLICATION supabase_realtime DROP TABLE public.tasks;
ALTER PUBLICATION supabase_realtime DROP TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime DROP TABLE public.task_activity;
