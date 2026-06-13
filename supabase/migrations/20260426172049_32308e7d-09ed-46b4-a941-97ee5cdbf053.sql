-- Live security inspection helpers used by the admin Security page.
-- Both functions are SECURITY DEFINER and gated by has_role(auth.uid(),'admin')
-- so non-admin callers receive an empty result set.

CREATE OR REPLACE FUNCTION public.get_security_report()
RETURNS TABLE (
  table_name        text,
  rls_enabled       boolean,
  policy_count      int,
  has_select_policy boolean,
  has_modify_policy boolean,
  anon_readable     boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.relname::text                                                    AS table_name,
    c.relrowsecurity                                                   AS rls_enabled,
    COALESCE(p.cnt, 0)::int                                            AS policy_count,
    COALESCE(p.has_select, false)                                      AS has_select_policy,
    COALESCE(p.has_modify, false)                                      AS has_modify_policy,
    COALESCE(p.anon_readable, false)                                   AS anon_readable
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN LATERAL (
    SELECT
      count(*)                                              AS cnt,
      bool_or(pol.cmd IN ('r','*'))                         AS has_select,
      bool_or(pol.cmd IN ('a','w','d','*'))                 AS has_modify,
      bool_or(
        pol.cmd IN ('r','*') AND (
          pol.polroles = '{0}'::oid[] OR 'anon' = ANY (
            SELECT rolname FROM pg_roles WHERE oid = ANY (pol.polroles)
          )
        )
      )                                                     AS anon_readable
    FROM pg_policy pol
    WHERE pol.polrelid = c.oid
  ) p ON true
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_function_security()
RETURNS TABLE (
  function_name        text,
  has_search_path      boolean,
  is_security_definer  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.proname::text                                       AS function_name,
    EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
    )                                                     AS has_search_path,
    p.prosecdef                                           AS is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
  ORDER BY p.proname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_security_report()  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_function_security() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_security_report()  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_function_security() TO authenticated;
