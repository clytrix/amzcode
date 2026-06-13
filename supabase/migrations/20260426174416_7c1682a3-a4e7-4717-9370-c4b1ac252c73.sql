-- 1. Lock down storage UPDATE on the private 'task-attachments' bucket.
--    Task owners can SELECT/INSERT/DELETE their own files but must never
--    overwrite an existing object. Add an explicit restrictive policy that
--    denies all UPDATE attempts on this bucket (admins included — uploads
--    should always be insert-then-delete to keep an audit trail).
CREATE POLICY "deny update on task-attachments"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO public
USING (bucket_id <> 'task-attachments')
WITH CHECK (bucket_id <> 'task-attachments');

-- 2. Harden public.user_roles against privilege escalation.
--    Replace the broad PERMISSIVE "admins manage roles" ALL policy with
--    explicit per-command PERMISSIVE policies scoped to admins only, so the
--    permissive layer can never grant write access to non-admins regardless
--    of how PostgREST evaluates the policy stack.
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

CREATE POLICY "admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- The existing restrictive policies ("restrictive only admins insert/update/delete roles"
-- and "deny non-admin role insert/update/delete") remain in place as a defence-in-depth
-- second layer. The existing permissive SELECT policies ("admins view all roles" and
-- "users view own roles") are unchanged so users keep being able to read their own role.