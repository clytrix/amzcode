ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restrictive only admins access email_templates" ON public.email_templates;
CREATE POLICY "restrictive only admins access email_templates"
ON public.email_templates
AS RESTRICTIVE
FOR ALL
TO public
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));