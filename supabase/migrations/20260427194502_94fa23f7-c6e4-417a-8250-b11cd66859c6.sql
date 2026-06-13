
CREATE OR REPLACE FUNCTION public.has_approved_application(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN auth.uid() IS NULL OR auth.uid() <> _user_id THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.job_applications
        WHERE user_id = _user_id AND status = 'approved'
      )
    END
$function$;
