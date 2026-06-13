-- Harden login_ips: explicitly deny client writes (writes only via service role server-side)
CREATE POLICY "restrictive deny client insert on login_ips"
ON public.login_ips AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (false);

CREATE POLICY "restrictive deny client update on login_ips"
ON public.login_ips AS RESTRICTIVE FOR UPDATE TO public
USING (false) WITH CHECK (false);

CREATE POLICY "restrictive deny client delete on login_ips"
ON public.login_ips AS RESTRICTIVE FOR DELETE TO public
USING (false);

-- Harden user_roles: ensure restrictive policies also block anon (public) role,
-- not only authenticated, so anonymous users cannot bypass write restrictions.
DROP POLICY IF EXISTS "deny non-admin role insert" ON public.user_roles;
DROP POLICY IF EXISTS "deny non-admin role update" ON public.user_roles;
DROP POLICY IF EXISTS "deny non-admin role delete" ON public.user_roles;

CREATE POLICY "deny non-admin role insert"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny non-admin role update"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO public
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny non-admin role delete"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO public
USING (public.has_role(auth.uid(), 'admin'::app_role));