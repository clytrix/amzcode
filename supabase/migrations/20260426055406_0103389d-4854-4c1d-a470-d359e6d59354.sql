-- 1) Ticket messages: prevent users from spoofing admin replies
DROP POLICY IF EXISTS "users create own ticket msgs" ON public.ticket_messages;

CREATE POLICY "users create own ticket msgs"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_admin_reply = false
  AND EXISTS (
    SELECT 1 FROM public.tickets
    WHERE tickets.id = ticket_messages.ticket_id
      AND tickets.user_id = auth.uid()
  )
);

-- Add restrictive policy as defence-in-depth: nobody non-admin can ever set is_admin_reply = true
CREATE POLICY "restrictive only admins set admin reply flag"
ON public.ticket_messages
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
  is_admin_reply = false
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2) user_roles: add an explicit restrictive policy ensuring ONLY admins can insert any role row
-- (closes any race / permissive-policy gap where a self-grant could slip in)
CREATE POLICY "restrictive only admins insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "restrictive only admins update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO public
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "restrictive only admins delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO public
USING (public.has_role(auth.uid(), 'admin'::public.app_role));