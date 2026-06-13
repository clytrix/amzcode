--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM (
    'admin',
    'employee'
);


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.application_status CASCADE;
CREATE TYPE public.application_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: disbursement_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.disbursement_status CASCADE;
CREATE TYPE public.disbursement_status AS ENUM (
    'pending',
    'held',
    'paid',
    'cancelled'
);


--
-- Name: kyc_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.kyc_status CASCADE;
CREATE TYPE public.kyc_status AS ENUM (
    'not_started',
    'fee_pending',
    'fee_paid',
    'payment_submitted',
    'documents_submitted',
    'approved',
    'rejected'
);


--
-- Name: module_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.module_status CASCADE;
CREATE TYPE public.module_status AS ENUM (
    'todo',
    'in_progress',
    'review',
    'done'
);


--
-- Name: project_role; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.project_role CASCADE;
CREATE TYPE public.project_role AS ENUM (
    'lead',
    'member',
    'viewer'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.project_status CASCADE;
CREATE TYPE public.project_status AS ENUM (
    'planning',
    'active',
    'on_hold',
    'completed',
    'archived'
);


--
-- Name: task_priority; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.task_priority CASCADE;
CREATE TYPE public.task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.task_status CASCADE;
CREATE TYPE public.task_status AS ENUM (
    'assigned',
    'in_progress',
    'submitted',
    'approved',
    'rejected',
    'blocked',
    'changes_requested'
);


--
-- Name: ticket_category; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.ticket_category CASCADE;
CREATE TYPE public.ticket_category AS ENUM (
    'kyc',
    'payment',
    'task',
    'general'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.ticket_status CASCADE;
CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);


--
-- Name: withdrawal_status; Type: TYPE; Schema: public; Owner: -
--

DROP TYPE IF EXISTS public.withdrawal_status CASCADE;
CREATE TYPE public.withdrawal_status AS ENUM (
    'pending',
    'approved',
    'paid',
    'rejected'
);


--
-- Name: accrue_daily_salary(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.accrue_daily_salary();
CREATE FUNCTION public.accrue_daily_salary() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE today date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date;
        pkg record; daily numeric; ref text; credited int := 0; skipped int := 0;
BEGIN
  FOR pkg IN
    SELECT user_id, monthly_salary FROM public.employment_packages
    WHERE is_active = true AND starts_on <= today AND (ends_on IS NULL OR ends_on >= today)
  LOOP
    daily := ROUND(COALESCE(pkg.monthly_salary, 0) / 30.0, 2);
    IF daily <= 0 THEN CONTINUE; END IF;
    ref := 'salary:' || pkg.user_id::text || ':' || to_char(today, 'YYYY-MM-DD');
    INSERT INTO public.wallets (user_id) VALUES (pkg.user_id) ON CONFLICT (user_id) DO NOTHING;
    BEGIN
      INSERT INTO public.wallet_transactions (user_id, wallet, amount, type, reference, description)
      VALUES (pkg.user_id, 'salary', daily, 'credit', ref, 'Daily salary accrual ' || to_char(today,'YYYY-MM-DD'));
      credited := credited + 1;
    EXCEPTION WHEN unique_violation THEN skipped := skipped + 1; END;
  END LOOP;
  RETURN jsonb_build_object('date', today, 'credited', credited, 'skipped', skipped);
END; $$;


--
-- Name: apply_wallet_transaction(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.apply_wallet_transaction() CASCADE;
CREATE FUNCTION public.apply_wallet_transaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  delta numeric;
BEGIN
  -- Ensure wallet row exists
  INSERT INTO public.wallets (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.type IN ('credit','refund') THEN
    delta := NEW.amount;
  ELSIF NEW.type IN ('debit','withdrawal') THEN
    delta := -NEW.amount;
  ELSE -- adjustment can be signed
    delta := NEW.amount;
  END IF;

  IF NEW.wallet = 'salary' THEN
    UPDATE public.wallets SET salary_balance = salary_balance + delta, updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    UPDATE public.wallets SET incentive_balance = incentive_balance + delta, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: attendance_cap_8h(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.attendance_cap_8h() CASCADE;
CREATE FUNCTION public.attendance_cap_8h() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  max_end TIMESTAMPTZ;
  worked_hours NUMERIC;
  overtime_hours NUMERIC;
BEGIN
  IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NOT NULL THEN
    max_end := NEW.check_in_at + INTERVAL '8 hours';
    IF NEW.check_out_at > max_end THEN
      overtime_hours := EXTRACT(EPOCH FROM (NEW.check_out_at - max_end)) / 3600.0;
      NEW.check_out_at := max_end;
      INSERT INTO public.incentive_pocket (user_id, source, hours, reference_date, notes)
      VALUES (NEW.user_id, 'overtime', ROUND(overtime_hours::numeric, 2), NEW.work_date,
              'Auto-credited: session exceeded 8h cap');
    END IF;
    worked_hours := EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at)) / 3600.0;
    NEW.hours_worked := ROUND(worked_hours::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: credit_data_entry_reward(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.credit_data_entry_reward() CASCADE;
CREATE FUNCTION public.credit_data_entry_reward() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE reward numeric; ref text;
BEGIN
  IF NEW.is_done = true AND COALESCE(OLD.is_done, false) = false AND NEW.reward_credited = false THEN
    SELECT reward_amount INTO reward FROM public.data_entry_daily_pool WHERE id = NEW.pool_id;
    reward := COALESCE(reward, 150);
    ref := 'dataentry:' || NEW.id::text;
    INSERT INTO public.wallets (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
    BEGIN
      INSERT INTO public.wallet_transactions (user_id, wallet, amount, type, reference, description)
      VALUES (NEW.user_id, 'incentive', reward, 'credit', ref, 'Data-entry task reward');
    EXCEPTION WHEN unique_violation THEN NULL; END;
    NEW.reward_credited := true;
    NEW.done_at := COALESCE(NEW.done_at, now());
  END IF;
  RETURN NEW;
END; $$;


--
-- Name: enforce_single_primary_bank_account(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.enforce_single_primary_bank_account() CASCADE;
CREATE FUNCTION public.enforce_single_primary_bank_account() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.bank_accounts
       SET is_primary = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_function_security(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.get_function_security();
CREATE FUNCTION public.get_function_security() RETURNS TABLE(function_name text, has_search_path boolean, is_security_definer boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


--
-- Name: get_security_report(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.get_security_report();
CREATE FUNCTION public.get_security_report() RETURNS TABLE(table_name text, rls_enabled boolean, policy_count integer, has_select_policy boolean, has_modify_policy boolean, anon_readable boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  INSERT INTO public.kyc_submissions (user_id, status) VALUES (NEW.id, 'not_started');
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: has_approved_application(uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.has_approved_application(uuid);
CREATE FUNCTION public.has_approved_application(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL OR auth.uid() <> _user_id THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.job_applications
        WHERE user_id = _user_id AND status = 'approved'
      )
    END
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: invoke_cron_hook(text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.invoke_cron_hook(text);
CREATE FUNCTION public.invoke_cron_hook(_path text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' OR v_secret = 'REPLACE_ME' THEN
    RAISE NOTICE 'cron_secret is not configured in vault; skipping %', _path;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://project--14f6a58b-86a9-4e78-901f-97f36d5344e1.lovable.app' || _path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', v_secret
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;


--
-- Name: is_project_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid);
CREATE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL OR auth.uid() <> _user_id THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = _project_id AND user_id = _user_id
      )
    END
$$;


--
-- Name: purge_old_salary_slips(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.purge_old_salary_slips();
CREATE FUNCTION public.purge_old_salary_slips() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM public.salary_slips
  WHERE created_at < (now() - interval '60 days');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN jsonb_build_object('deleted', deleted, 'cutoff_days', 60);
END;
$$;


--
-- Name: rollover_data_entry_pool(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.rollover_data_entry_pool();
CREATE FUNCTION public.rollover_data_entry_pool() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE today date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date; inserted int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.data_entry_daily_pool WHERE pool_date = today) THEN
    RETURN jsonb_build_object('date', today, 'inserted', 0, 'skipped', true);
  END IF;
  INSERT INTO public.data_entry_daily_pool (pool_date, invoice_id, position)
  SELECT today, id, ROW_NUMBER() OVER (ORDER BY random()) - 1
  FROM public.data_entry_invoices WHERE is_active = true
  ORDER BY random() LIMIT 30;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN jsonb_build_object('date', today, 'inserted', inserted);
END; $$;


--
-- Name: seed_bank_account_from_kyc(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.seed_bank_account_from_kyc() CASCADE;
CREATE FUNCTION public.seed_bank_account_from_kyc() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.bank_account_number IS NOT NULL OR NEW.upi_id IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE user_id = NEW.user_id)
  THEN
    INSERT INTO public.bank_accounts
      (user_id, label, account_holder, account_number, bank_name, ifsc_swift, upi_id, is_primary, source)
    VALUES
      (NEW.user_id, 'Primary (from KYC)', NEW.bank_account_holder, NEW.bank_account_number,
       NEW.bank_name, NEW.bank_ifsc_swift, NEW.upi_id, true, 'kyc');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


--
-- Name: validate_job_application(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.validate_job_application() CASCADE;
CREATE FUNCTION public.validate_job_application() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.cv_path IS NULL OR length(NEW.cv_path) = 0 THEN
    RAISE EXCEPTION 'CV upload is required';
  END IF;
  IF NEW.expected_salary IS NULL OR NEW.expected_salary <= 0 THEN
    RAISE EXCEPTION 'Expected salary is required';
  END IF;
  IF (NEW.contact_email IS NULL OR length(NEW.contact_email) = 0)
     AND (NEW.contact_whatsapp IS NULL OR length(NEW.contact_whatsapp) = 0) THEN
    RAISE EXCEPTION 'Provide at least one contact: email or WhatsApp';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_withdrawal_minimum(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.validate_withdrawal_minimum() CASCADE;
CREATE FUNCTION public.validate_withdrawal_minimum() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.amount < 5000 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₹5,000';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    work_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    check_in_at timestamp with time zone DEFAULT now() NOT NULL,
    check_out_at timestamp with time zone,
    hours_worked numeric GENERATED ALWAYS AS (
CASE
    WHEN (check_out_at IS NULL) THEN NULL::numeric
    ELSE round((EXTRACT(epoch FROM (check_out_at - check_in_at)) / (3600)::numeric), 2)
END) STORED,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text,
    account_holder text,
    account_number text,
    bank_name text,
    ifsc_swift text,
    upi_id text,
    is_primary boolean DEFAULT false NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_accounts_has_destination CHECK ((((account_number IS NOT NULL) AND (length(account_number) > 0)) OR ((upi_id IS NOT NULL) AND (length(upi_id) > 0))))
);


--
-- Name: credential_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credential_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    credential_id uuid NOT NULL,
    viewer_id uuid NOT NULL,
    ip_address text,
    user_agent text,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_entry_daily_pool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_entry_daily_pool (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pool_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    invoice_id uuid NOT NULL,
    reward_amount numeric DEFAULT 150 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_entry_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_entry_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_name text NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date,
    amount numeric DEFAULT 0 NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    gst_number text,
    image_url text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_entry_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_entry_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pool_id uuid NOT NULL,
    pool_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    vendor_name text,
    invoice_number text,
    invoice_date date,
    amount numeric,
    tax_amount numeric,
    gst_number text,
    is_done boolean DEFAULT false NOT NULL,
    done_at timestamp with time zone,
    reward_credited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid,
    amount numeric(12,2) NOT NULL,
    source text DEFAULT 'task'::text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    description text,
    variables text[] DEFAULT '{}'::text[] NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employment_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid,
    application_id uuid,
    monthly_salary numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    perks jsonb DEFAULT '{}'::jsonb NOT NULL,
    starts_on date DEFAULT CURRENT_DATE NOT NULL,
    ends_on date,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fx_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fx_rates (
    base text NOT NULL,
    quote text NOT NULL,
    rate numeric NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: incentive_pocket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incentive_pocket (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source text DEFAULT 'overtime'::text NOT NULL,
    hours numeric DEFAULT 0 NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    reference_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cover_letter text,
    experience text,
    status public.application_status DEFAULT 'pending'::public.application_status NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_email text,
    contact_whatsapp text,
    expected_salary numeric(12,2),
    cv_path text,
    github_url text,
    linkedin_url text
);


--
-- Name: job_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category_id uuid,
    description text NOT NULL,
    requirements text,
    responsibilities text,
    location text DEFAULT 'Remote / Work From Home'::text NOT NULL,
    employment_type text DEFAULT 'Full-time'::text NOT NULL,
    salary_min numeric(12,2),
    salary_max numeric(12,2),
    salary_currency text DEFAULT 'INR'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kyc_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kyc_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status public.kyc_status DEFAULT 'not_started'::public.kyc_status NOT NULL,
    fee_amount numeric(12,2) DEFAULT 79 NOT NULL,
    fee_paid_at timestamp with time zone,
    fee_payment_reference text,
    full_name text,
    date_of_birth date,
    document_type text,
    document_number text,
    document_front_url text,
    document_back_url text,
    selfie_url text,
    bank_account_holder text,
    bank_account_number text,
    bank_name text,
    bank_ifsc_swift text,
    upi_id text,
    admin_notes text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address text,
    pan_number text,
    aadhaar_number text,
    triggered_by_withdrawal_id uuid,
    payment_utr text,
    payment_inr_amount numeric,
    payment_submitted_at timestamp with time zone,
    payment_screenshot_url text
);


--
-- Name: login_ips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_ips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_address text NOT NULL,
    user_agent text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    status public.module_status DEFAULT 'todo'::public.module_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    purpose text NOT NULL,
    ip_address text,
    user_agent text,
    attempts integer DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    address text,
    city text,
    country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp text
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.project_role DEFAULT 'member'::public.project_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    kind text NOT NULL,
    label text NOT NULL,
    url_or_path text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_resources_kind_check CHECK ((kind = ANY (ARRAY['file'::text, 'url'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status public.project_status DEFAULT 'planning'::public.project_status NOT NULL,
    owner_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salary_disbursements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_disbursements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    package_id uuid,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    basic_amount numeric DEFAULT 0 NOT NULL,
    overtime_amount numeric DEFAULT 0 NOT NULL,
    bonus numeric DEFAULT 0 NOT NULL,
    deductions numeric DEFAULT 0 NOT NULL,
    net_amount numeric DEFAULT 0 NOT NULL,
    status public.disbursement_status DEFAULT 'pending'::public.disbursement_status NOT NULL,
    hold_reason text,
    paid_at timestamp with time zone,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT salary_disbursements_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12)))
);


--
-- Name: salary_slips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_slips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    basic_salary numeric(12,2) DEFAULT 0 NOT NULL,
    bonus numeric(12,2) DEFAULT 0 NOT NULL,
    deductions numeric(12,2) DEFAULT 0 NOT NULL,
    net_amount numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    actor_id uuid,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    file_size_bytes bigint DEFAULT 0 NOT NULL,
    mime_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    label text NOT NULL,
    username text,
    password_encrypted text NOT NULL,
    url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_time_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_time_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    minutes integer,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    reward_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status public.task_status DEFAULT 'assigned'::public.task_status NOT NULL,
    submission_notes text,
    submission_url text,
    deadline timestamp with time zone,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_notes text,
    last_reminder_sent_at timestamp with time zone,
    project_id uuid,
    module_id uuid,
    priority public.task_priority DEFAULT 'medium'::public.task_priority NOT NULL,
    estimate_hours numeric(6,2),
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    blocked_reason text,
    started_at timestamp with time zone
);


--
-- Name: ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    is_admin_reply boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    category public.ticket_category DEFAULT 'general'::public.ticket_category NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    device_name text,
    user_agent text,
    last_ip text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    wallet text NOT NULL,
    amount numeric NOT NULL,
    type text NOT NULL,
    reference text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_transactions_type_check CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text, 'withdrawal'::text, 'refund'::text, 'adjustment'::text]))),
    CONSTRAINT wallet_transactions_wallet_check CHECK ((wallet = ANY (ARRAY['salary'::text, 'incentive'::text])))
);


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    user_id uuid NOT NULL,
    salary_balance numeric DEFAULT 0 NOT NULL,
    incentive_balance numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    status public.withdrawal_status DEFAULT 'pending'::public.withdrawal_status NOT NULL,
    payout_method text,
    payout_details text,
    admin_notes text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bank_account_id uuid
);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: credential_access_log credential_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_log
    ADD CONSTRAINT credential_access_log_pkey PRIMARY KEY (id);


--
-- Name: data_entry_daily_pool data_entry_daily_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_daily_pool
    ADD CONSTRAINT data_entry_daily_pool_pkey PRIMARY KEY (id);


--
-- Name: data_entry_daily_pool data_entry_daily_pool_pool_date_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_daily_pool
    ADD CONSTRAINT data_entry_daily_pool_pool_date_invoice_id_key UNIQUE (pool_date, invoice_id);


--
-- Name: data_entry_invoices data_entry_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_invoices
    ADD CONSTRAINT data_entry_invoices_pkey PRIMARY KEY (id);


--
-- Name: data_entry_submissions data_entry_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_submissions
    ADD CONSTRAINT data_entry_submissions_pkey PRIMARY KEY (id);


--
-- Name: data_entry_submissions data_entry_submissions_user_id_pool_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_submissions
    ADD CONSTRAINT data_entry_submissions_user_id_pool_id_key UNIQUE (user_id, pool_id);


--
-- Name: earnings earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings
    ADD CONSTRAINT earnings_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_template_key_key UNIQUE (template_key);


--
-- Name: employment_packages employment_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_packages
    ADD CONSTRAINT employment_packages_pkey PRIMARY KEY (id);


--
-- Name: fx_rates fx_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_pkey PRIMARY KEY (base, quote);


--
-- Name: incentive_pocket incentive_pocket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_pocket
    ADD CONSTRAINT incentive_pocket_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_job_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_user_id_key UNIQUE (job_id, user_id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (id);


--
-- Name: job_categories job_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_name_key UNIQUE (name);


--
-- Name: job_categories job_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_pkey PRIMARY KEY (id);


--
-- Name: job_categories job_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_slug_key UNIQUE (slug);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: kyc_submissions kyc_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_submissions
    ADD CONSTRAINT kyc_submissions_pkey PRIMARY KEY (id);


--
-- Name: kyc_submissions kyc_submissions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_submissions
    ADD CONSTRAINT kyc_submissions_user_id_key UNIQUE (user_id);


--
-- Name: login_ips login_ips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_ips
    ADD CONSTRAINT login_ips_pkey PRIMARY KEY (id);


--
-- Name: login_ips login_ips_user_id_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_ips
    ADD CONSTRAINT login_ips_user_id_ip_address_key UNIQUE (user_id, ip_address);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_resources project_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_resources
    ADD CONSTRAINT project_resources_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: salary_disbursements salary_disbursements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_disbursements
    ADD CONSTRAINT salary_disbursements_pkey PRIMARY KEY (id);


--
-- Name: salary_disbursements salary_disbursements_user_id_period_year_period_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_disbursements
    ADD CONSTRAINT salary_disbursements_user_id_period_year_period_month_key UNIQUE (user_id, period_year, period_month);


--
-- Name: salary_slips salary_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_pkey PRIMARY KEY (id);


--
-- Name: salary_slips salary_slips_user_id_period_month_period_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_user_id_period_month_period_year_key UNIQUE (user_id, period_month, period_year);


--
-- Name: task_activity task_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_activity
    ADD CONSTRAINT task_activity_pkey PRIMARY KEY (id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_credentials task_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_credentials
    ADD CONSTRAINT task_credentials_pkey PRIMARY KEY (id);


--
-- Name: task_time_logs task_time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_time_logs
    ADD CONSTRAINT task_time_logs_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: ticket_messages ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_user_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_device_id_key UNIQUE (user_id, device_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (user_id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: idx_attendance_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_user_date ON public.attendance USING btree (user_id, work_date DESC);


--
-- Name: idx_bank_accounts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_user ON public.bank_accounts USING btree (user_id);


--
-- Name: idx_data_entry_submissions_user_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_entry_submissions_user_pool ON public.data_entry_submissions USING btree (user_id, pool_date);


--
-- Name: idx_employment_packages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employment_packages_user ON public.employment_packages USING btree (user_id, is_active);


--
-- Name: idx_incentive_pocket_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incentive_pocket_user ON public.incentive_pocket USING btree (user_id, reference_date);


--
-- Name: idx_job_applications_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_applications_user_status ON public.job_applications USING btree (user_id, status);


--
-- Name: idx_kyc_status_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kyc_status_updated ON public.kyc_submissions USING btree (status, updated_at DESC);


--
-- Name: idx_otp_email_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_email_purpose ON public.otp_codes USING btree (email, purpose);


--
-- Name: idx_pool_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pool_date ON public.data_entry_daily_pool USING btree (pool_date);


--
-- Name: idx_salary_disbursements_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_disbursements_user ON public.salary_disbursements USING btree (user_id, period_year, period_month);


--
-- Name: idx_submissions_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_user_date ON public.data_entry_submissions USING btree (user_id, pool_date);


--
-- Name: idx_task_attachments_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments USING btree (task_id);


--
-- Name: idx_tasks_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_deadline ON public.tasks USING btree (deadline) WHERE (deadline IS NOT NULL);


--
-- Name: idx_tasks_deadline_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_deadline_status ON public.tasks USING btree (deadline, status) WHERE (status = ANY (ARRAY['assigned'::public.task_status, 'in_progress'::public.task_status]));


--
-- Name: idx_tasks_module_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_module_id ON public.tasks USING btree (module_id);


--
-- Name: idx_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_tasks_status_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status_deadline ON public.tasks USING btree (status, deadline);


--
-- Name: idx_tickets_status_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status_updated ON public.tickets USING btree (status, updated_at DESC);


--
-- Name: idx_wallet_transactions_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_user_created ON public.wallet_transactions USING btree (user_id, created_at DESC);


--
-- Name: trusted_devices_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trusted_devices_last_seen_idx ON public.trusted_devices USING btree (last_seen_at DESC);


--
-- Name: trusted_devices_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trusted_devices_user_id_idx ON public.trusted_devices USING btree (user_id);


--
-- Name: uniq_bank_accounts_primary_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_bank_accounts_primary_per_user ON public.bank_accounts USING btree (user_id) WHERE (is_primary = true);


--
-- Name: uniq_wallet_tx_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_wallet_tx_reference ON public.wallet_transactions USING btree (reference) WHERE (reference IS NOT NULL);


--
-- Name: ux_wallet_tx_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_wallet_tx_reference ON public.wallet_transactions USING btree (reference) WHERE (reference IS NOT NULL);


--
-- Name: wallet_tx_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wallet_tx_reference_unique ON public.wallet_transactions USING btree (reference) WHERE (reference IS NOT NULL);


--
-- Name: wallet_tx_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_tx_user_created_idx ON public.wallet_transactions USING btree (user_id, created_at DESC);


--
-- Name: wallet_transactions apply_wallet_tx; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER apply_wallet_tx AFTER INSERT ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_transaction();


--
-- Name: attendance attendance_cap_8h_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER attendance_cap_8h_trg BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.attendance_cap_8h();


--
-- Name: job_applications trg_applications_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: bank_accounts trg_bank_accounts_single_primary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bank_accounts_single_primary AFTER INSERT OR UPDATE OF is_primary ON public.bank_accounts FOR EACH ROW WHEN ((new.is_primary = true)) EXECUTE FUNCTION public.enforce_single_primary_bank_account();


--
-- Name: bank_accounts trg_bank_accounts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: data_entry_submissions trg_credit_data_entry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_credit_data_entry BEFORE UPDATE ON public.data_entry_submissions FOR EACH ROW EXECUTE FUNCTION public.credit_data_entry_reward();


--
-- Name: data_entry_invoices trg_de_inv_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_de_inv_updated BEFORE UPDATE ON public.data_entry_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: data_entry_submissions trg_de_subs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_de_subs_updated BEFORE UPDATE ON public.data_entry_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: email_templates trg_email_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: jobs trg_jobs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: kyc_submissions trg_kyc_seed_bank_account; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kyc_seed_bank_account AFTER UPDATE OF status ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.seed_bank_account_from_kyc();


--
-- Name: kyc_submissions trg_kyc_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: modules trg_modules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: projects trg_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tasks trg_tasks_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tickets trg_tickets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: job_applications trg_validate_job_application; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_job_application BEFORE INSERT ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.validate_job_application();


--
-- Name: withdrawals trg_withdrawals_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_withdrawals_updated BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employment_packages update_employment_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employment_packages_updated_at BEFORE UPDATE ON public.employment_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: platform_settings update_platform_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: salary_disbursements update_salary_disbursements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_salary_disbursements_updated_at BEFORE UPDATE ON public.salary_disbursements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: withdrawals validate_withdrawal_minimum_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_withdrawal_minimum_trg BEFORE INSERT ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_minimum();


--
-- Name: bank_accounts bank_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: credential_access_log credential_access_log_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credential_access_log
    ADD CONSTRAINT credential_access_log_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.task_credentials(id) ON DELETE CASCADE;


--
-- Name: data_entry_daily_pool data_entry_daily_pool_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_daily_pool
    ADD CONSTRAINT data_entry_daily_pool_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.data_entry_invoices(id) ON DELETE CASCADE;


--
-- Name: data_entry_submissions data_entry_submissions_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_entry_submissions
    ADD CONSTRAINT data_entry_submissions_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.data_entry_daily_pool(id) ON DELETE CASCADE;


--
-- Name: earnings earnings_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings
    ADD CONSTRAINT earnings_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: earnings earnings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings
    ADD CONSTRAINT earnings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_applications job_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.job_categories(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: kyc_submissions kyc_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_submissions
    ADD CONSTRAINT kyc_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: kyc_submissions kyc_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_submissions
    ADD CONSTRAINT kyc_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: login_ips login_ips_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_ips
    ADD CONSTRAINT login_ips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: modules modules_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_resources project_resources_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_resources
    ADD CONSTRAINT project_resources_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: salary_slips salary_slips_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: salary_slips salary_slips_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: task_activity task_activity_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_activity
    ADD CONSTRAINT task_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_credentials task_credentials_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_credentials
    ADD CONSTRAINT task_credentials_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_time_logs task_time_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_time_logs
    ADD CONSTRAINT task_time_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ticket_messages ticket_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ticket_messages ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: withdrawals withdrawals_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: withdrawals withdrawals_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ticket_messages admins create ticket msgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins create ticket msgs" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (sender_id = auth.uid())));


--
-- Name: user_roles admins delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_settings admins delete settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins delete settings" ON public.platform_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles admins insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_settings admins insert settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins insert settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_attachments admins manage all attachment rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage all attachment rows" ON public.task_attachments TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trusted_devices admins manage all trusted devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage all trusted devices" ON public.trusted_devices TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: job_applications admins manage apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage apps" ON public.job_applications TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: attendance admins manage attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage attendance" ON public.attendance TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bank_accounts admins manage bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage bank accounts" ON public.bank_accounts TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: job_categories admins manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage categories" ON public.job_categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_comments admins manage comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage comments" ON public.task_comments TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: data_entry_daily_pool admins manage daily_pool; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage daily_pool" ON public.data_entry_daily_pool TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: data_entry_invoices admins manage data_entry_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage data_entry_invoices" ON public.data_entry_invoices TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: salary_disbursements admins manage disbursements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage disbursements" ON public.salary_disbursements TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: earnings admins manage earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage earnings" ON public.earnings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates admins manage email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage email templates" ON public.email_templates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: incentive_pocket admins manage incentive_pocket; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage incentive_pocket" ON public.incentive_pocket TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: jobs admins manage jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage jobs" ON public.jobs TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: kyc_submissions admins manage kyc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage kyc" ON public.kyc_submissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: modules admins manage modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage modules" ON public.modules TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employment_packages admins manage packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage packages" ON public.employment_packages TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: project_members admins manage project_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage project_members" ON public.project_members TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: project_resources admins manage project_resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage project_resources" ON public.project_resources TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: projects admins manage projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage projects" ON public.projects TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: salary_slips admins manage slips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage slips" ON public.salary_slips TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: data_entry_submissions admins manage submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage submissions" ON public.data_entry_submissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_activity admins manage task_activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage task_activity" ON public.task_activity TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_credentials admins manage task_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage task_credentials" ON public.task_credentials TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tasks admins manage tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage tasks" ON public.tasks TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tickets admins manage tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage tickets" ON public.tickets TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_time_logs admins manage time_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage time_logs" ON public.task_time_logs TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallet_transactions admins manage wallet tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage wallet tx" ON public.wallet_transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallets admins manage wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage wallets" ON public.wallets TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: withdrawals admins manage withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins manage withdrawals" ON public.withdrawals TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_settings admins read all settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins read all settings" ON public.platform_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles admins update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles admins update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_settings admins update settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: job_applications admins view all apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all apps" ON public.job_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_attachments admins view all attachment rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all attachment rows" ON public.task_attachments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: login_ips admins view all ips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all ips" ON public.login_ips FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: jobs admins view all jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles admins view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles admins view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ticket_messages admins view all ticket msgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all ticket msgs" ON public.ticket_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trusted_devices admins view all trusted devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all trusted devices" ON public.trusted_devices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallet_transactions admins view all wallet tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all wallet tx" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallets admins view all wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: credential_access_log admins view credential_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins view credential_access_log" ON public.credential_access_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fx_rates anyone read fx_rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone read fx_rates" ON public.fx_rates FOR SELECT TO authenticated, anon USING (true);


--
-- Name: platform_settings anyone read public settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone read public settings" ON public.platform_settings FOR SELECT USING ((is_public = true));


--
-- Name: jobs anyone view active jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone view active jobs" ON public.jobs FOR SELECT USING ((is_active = true));


--
-- Name: job_categories anyone view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anyone view categories" ON public.job_categories FOR SELECT USING (true);


--
-- Name: task_credentials assignees view task_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "assignees view task_credentials" ON public.task_credentials FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_credentials.task_id) AND (t.user_id = auth.uid())))));


--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: credential_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credential_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: data_entry_daily_pool; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_entry_daily_pool ENABLE ROW LEVEL SECURITY;

--
-- Name: data_entry_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_entry_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: data_entry_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_entry_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_transactions deny client delete wallet tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client delete wallet tx" ON public.wallet_transactions AS RESTRICTIVE FOR DELETE USING (false);


--
-- Name: trusted_devices deny client insert on trusted_devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client insert on trusted_devices" ON public.trusted_devices AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallet_transactions deny client insert wallet tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client insert wallet tx" ON public.wallet_transactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallets deny client insert wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client insert wallets" ON public.wallets AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: trusted_devices deny client update on trusted_devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client update on trusted_devices" ON public.trusted_devices AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: wallet_transactions deny client update wallet tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client update wallet tx" ON public.wallet_transactions AS RESTRICTIVE FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: wallets deny client update wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny client update wallets" ON public.wallets AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles deny non-admin role delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny non-admin role delete" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles deny non-admin role insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny non-admin role insert" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles deny non-admin role update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny non-admin role update" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: data_entry_invoices employees view active invoices in todays pool; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "employees view active invoices in todays pool" ON public.data_entry_invoices FOR SELECT TO authenticated USING (((is_active = true) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role)) AND (EXISTS ( SELECT 1
   FROM public.data_entry_daily_pool p
  WHERE ((p.invoice_id = data_entry_invoices.id) AND (p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date))))));


--
-- Name: data_entry_daily_pool employees view current pool; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "employees view current pool" ON public.data_entry_daily_pool FOR SELECT TO authenticated USING (((pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employee'::public.app_role))));


--
-- Name: employment_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employment_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: fx_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: incentive_pocket; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incentive_pocket ENABLE ROW LEVEL SECURITY;

--
-- Name: job_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: job_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: kyc_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: login_ips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_ips ENABLE ROW LEVEL SECURITY;

--
-- Name: modules members view modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members view modules" ON public.modules FOR SELECT USING (public.is_project_member(project_id, auth.uid()));


--
-- Name: project_resources members view project resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members view project resources" ON public.project_resources FOR SELECT USING (public.is_project_member(project_id, auth.uid()));


--
-- Name: project_members members view their membership rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members view their membership rows" ON public.project_members FOR SELECT USING (((user_id = auth.uid()) OR public.is_project_member(project_id, auth.uid())));


--
-- Name: projects members view their projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members view their projects" ON public.projects FOR SELECT USING (public.is_project_member(id, auth.uid()));


--
-- Name: modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: credential_access_log restrictive deny client delete on credential_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client delete on credential_access_log" ON public.credential_access_log AS RESTRICTIVE FOR DELETE USING (false);


--
-- Name: login_ips restrictive deny client delete on login_ips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client delete on login_ips" ON public.login_ips AS RESTRICTIVE FOR DELETE USING (false);


--
-- Name: otp_codes restrictive deny client delete on otp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client delete on otp" ON public.otp_codes AS RESTRICTIVE FOR DELETE USING (false);


--
-- Name: credential_access_log restrictive deny client insert on credential_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client insert on credential_access_log" ON public.credential_access_log AS RESTRICTIVE FOR INSERT WITH CHECK (false);


--
-- Name: login_ips restrictive deny client insert on login_ips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client insert on login_ips" ON public.login_ips AS RESTRICTIVE FOR INSERT WITH CHECK (false);


--
-- Name: otp_codes restrictive deny client insert on otp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client insert on otp" ON public.otp_codes AS RESTRICTIVE FOR INSERT WITH CHECK (false);


--
-- Name: otp_codes restrictive deny client select on otp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client select on otp" ON public.otp_codes AS RESTRICTIVE FOR SELECT USING (false);


--
-- Name: credential_access_log restrictive deny client update on credential_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client update on credential_access_log" ON public.credential_access_log AS RESTRICTIVE FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: login_ips restrictive deny client update on login_ips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client update on login_ips" ON public.login_ips AS RESTRICTIVE FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: otp_codes restrictive deny client update on otp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny client update on otp" ON public.otp_codes AS RESTRICTIVE FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: withdrawals restrictive deny user delete withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny user delete withdrawals" ON public.withdrawals AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: withdrawals restrictive deny user update withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive deny user update withdrawals" ON public.withdrawals AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates restrictive only admins access email_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive only admins access email_templates" ON public.email_templates AS RESTRICTIVE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles restrictive only admins delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive only admins delete roles" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles restrictive only admins insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive only admins insert roles" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: ticket_messages restrictive only admins set admin reply flag; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive only admins set admin reply flag" ON public.ticket_messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((is_admin_reply = false) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles restrictive only admins update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "restrictive only admins update roles" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: salary_disbursements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_disbursements ENABLE ROW LEVEL SECURITY;

--
-- Name: salary_slips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;

--
-- Name: task_attachments task owners delete own attachment rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "task owners delete own attachment rows" ON public.task_attachments FOR DELETE TO authenticated USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_attachments.task_id) AND (t.user_id = auth.uid()) AND (t.status = ANY (ARRAY['assigned'::public.task_status, 'in_progress'::public.task_status])))))));


--
-- Name: task_attachments task owners insert own attachment rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "task owners insert own attachment rows" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_attachments.task_id) AND (t.user_id = auth.uid()) AND (t.status = ANY (ARRAY['assigned'::public.task_status, 'in_progress'::public.task_status, 'submitted'::public.task_status])))))));


--
-- Name: task_attachments task owners view own attachments rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "task owners view own attachments rows" ON public.task_attachments FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: task_comments task party creates comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "task party creates comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_comments.task_id) AND ((t.user_id = auth.uid()) OR ((t.project_id IS NOT NULL) AND public.is_project_member(t.project_id, auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role)))))));


--
-- Name: task_activity task party views activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "task party views activity" ON public.task_activity FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_activity.task_id) AND ((t.user_id = auth.uid()) OR ((t.project_id IS NOT NULL) AND public.is_project_member(t.project_id, auth.uid())))))));


--
-- Name: task_comments task party views comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "task party views comments" ON public.task_comments FOR SELECT USING (((author_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.tasks t
  WHERE ((t.id = task_comments.task_id) AND ((t.user_id = auth.uid()) OR ((t.project_id IS NOT NULL) AND public.is_project_member(t.project_id, auth.uid()))))))));


--
-- Name: task_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: task_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: task_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: task_time_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: job_applications users create own apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create own apps" ON public.job_applications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ticket_messages users create own ticket msgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create own ticket msgs" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (is_admin_reply = false) AND (EXISTS ( SELECT 1
   FROM public.tickets
  WHERE ((tickets.id = ticket_messages.ticket_id) AND (tickets.user_id = auth.uid()))))));


--
-- Name: tickets users create own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create own tickets" ON public.tickets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: withdrawals users create own withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.kyc_submissions
  WHERE ((kyc_submissions.user_id = auth.uid()) AND (kyc_submissions.status = 'approved'::public.kyc_status))))));


--
-- Name: bank_accounts users delete own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own bank accounts" ON public.bank_accounts FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: trusted_devices users delete own trusted devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own trusted devices" ON public.trusted_devices FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: attendance users insert own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own attendance" ON public.attendance FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: bank_accounts users insert own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own bank accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: kyc_submissions users insert own kyc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own kyc" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (status = 'not_started'::public.kyc_status) AND (fee_paid_at IS NULL) AND (fee_payment_reference IS NULL) AND (fee_amount = (79)::numeric) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL) AND (admin_notes IS NULL)));


--
-- Name: data_entry_submissions users insert own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own submissions" ON public.data_entry_submissions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (reward_credited = false) AND (is_done = false) AND (pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date) AND (EXISTS ( SELECT 1
   FROM public.data_entry_daily_pool p
  WHERE ((p.id = data_entry_submissions.pool_id) AND (p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date))))));


--
-- Name: task_time_logs users insert own time_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own time_logs" ON public.task_time_logs FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: attendance users update own attendance open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own attendance open" ON public.attendance FOR UPDATE USING (((auth.uid() = user_id) AND (check_out_at IS NULL))) WITH CHECK ((auth.uid() = user_id));


--
-- Name: bank_accounts users update own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: kyc_submissions users update own kyc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own kyc" ON public.kyc_submissions FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['not_started'::public.kyc_status, 'rejected'::public.kyc_status])))) WITH CHECK (((auth.uid() = user_id) AND (status = ( SELECT k.status
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id))) AND (fee_paid_at IS NULL) AND (fee_payment_reference IS NULL) AND (payment_utr IS NULL) AND (payment_inr_amount IS NULL) AND (payment_submitted_at IS NULL) AND (payment_screenshot_url IS NULL) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL) AND (admin_notes IS NULL) AND (fee_amount = (79)::numeric) AND (NOT (triggered_by_withdrawal_id IS DISTINCT FROM ( SELECT k.triggered_by_withdrawal_id
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)))) AND (NOT (full_name IS DISTINCT FROM COALESCE(( SELECT k.full_name
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), full_name))) AND (NOT (date_of_birth IS DISTINCT FROM COALESCE(( SELECT k.date_of_birth
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), date_of_birth))) AND (NOT (address IS DISTINCT FROM COALESCE(( SELECT k.address
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), address))) AND (NOT (aadhaar_number IS DISTINCT FROM COALESCE(( SELECT k.aadhaar_number
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), aadhaar_number))) AND (NOT (pan_number IS DISTINCT FROM COALESCE(( SELECT k.pan_number
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), pan_number))) AND (NOT (document_type IS DISTINCT FROM COALESCE(( SELECT k.document_type
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), document_type))) AND (NOT (document_number IS DISTINCT FROM COALESCE(( SELECT k.document_number
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), document_number))) AND (NOT (document_front_url IS DISTINCT FROM COALESCE(( SELECT k.document_front_url
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), document_front_url))) AND (NOT (document_back_url IS DISTINCT FROM COALESCE(( SELECT k.document_back_url
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), document_back_url))) AND (NOT (selfie_url IS DISTINCT FROM COALESCE(( SELECT k.selfie_url
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), selfie_url))) AND (NOT (bank_account_holder IS DISTINCT FROM COALESCE(( SELECT k.bank_account_holder
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), bank_account_holder))) AND (NOT (bank_account_number IS DISTINCT FROM COALESCE(( SELECT k.bank_account_number
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), bank_account_number))) AND (NOT (bank_name IS DISTINCT FROM COALESCE(( SELECT k.bank_name
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), bank_name))) AND (NOT (bank_ifsc_swift IS DISTINCT FROM COALESCE(( SELECT k.bank_ifsc_swift
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), bank_ifsc_swift))) AND (NOT (upi_id IS DISTINCT FROM COALESCE(( SELECT k.upi_id
   FROM public.kyc_submissions k
  WHERE (k.id = kyc_submissions.id)), upi_id)))));


--
-- Name: data_entry_submissions users update own open submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own open submissions" ON public.data_entry_submissions FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (reward_credited = false) AND (pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date))) WITH CHECK (((auth.uid() = user_id) AND (reward_credited = false) AND (pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date) AND (EXISTS ( SELECT 1
   FROM public.data_entry_daily_pool p
  WHERE ((p.id = data_entry_submissions.pool_id) AND (p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date))))));


--
-- Name: profiles users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: task_time_logs users update own running log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own running log" ON public.task_time_logs FOR UPDATE USING (((user_id = auth.uid()) AND (ended_at IS NULL))) WITH CHECK ((user_id = auth.uid()));


--
-- Name: tasks users update own tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own tasks" ON public.tasks FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tickets users update own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own tickets" ON public.tickets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: job_applications users view own apps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own apps" ON public.job_applications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: attendance users view own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own attendance" ON public.attendance FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: bank_accounts users view own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: credential_access_log users view own credential access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own credential access" ON public.credential_access_log FOR SELECT USING ((viewer_id = auth.uid()));


--
-- Name: salary_disbursements users view own disbursements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own disbursements" ON public.salary_disbursements FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: earnings users view own earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own earnings" ON public.earnings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: incentive_pocket users view own incentive_pocket; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own incentive_pocket" ON public.incentive_pocket FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: login_ips users view own ips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own ips" ON public.login_ips FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: kyc_submissions users view own kyc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own kyc" ON public.kyc_submissions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: employment_packages users view own packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own packages" ON public.employment_packages FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles users view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles users view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: salary_slips users view own slips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own slips" ON public.salary_slips FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: data_entry_submissions users view own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own submissions" ON public.data_entry_submissions FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));


--
-- Name: tasks users view own tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own tasks" ON public.tasks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ticket_messages users view own ticket msgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own ticket msgs" ON public.ticket_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tickets
  WHERE ((tickets.id = ticket_messages.ticket_id) AND (tickets.user_id = auth.uid())))));


--
-- Name: tickets users view own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own tickets" ON public.tickets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: task_time_logs users view own time_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own time_logs" ON public.task_time_logs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: trusted_devices users view own trusted devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own trusted devices" ON public.trusted_devices FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: wallets users view own wallet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own wallet" ON public.wallets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: wallet_transactions users view own wallet tx; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own wallet tx" ON public.wallet_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: withdrawals users view own withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users view own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

