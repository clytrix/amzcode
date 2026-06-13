-- Revoke broad EXECUTE from anon and authenticated on sensitive SECURITY DEFINER functions.
-- These are still callable internally by RLS policies (which run as the function owner)
-- and by trigger contexts. They were never intended to be exposed via PostgREST.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_approved_application(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollover_data_entry_pool() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accrue_daily_salary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_data_entry_reward() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_wallet_transaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_cap_8h() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_withdrawal_minimum() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_function_security() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_security_report() FROM PUBLIC, anon;