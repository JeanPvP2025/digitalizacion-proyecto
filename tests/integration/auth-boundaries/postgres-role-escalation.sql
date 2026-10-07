\set ON_ERROR_STOP on

-- Authentication/authorization boundary probes. Claims are deliberately
-- untrusted input; staff authority must come from user_role_grants.
BEGIN;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-4000-8000-00000000b301', 'authenticated', 'authenticated', 'boundary-customer@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b302', 'authenticated', 'authenticated', 'boundary-catalog@nodria.test', '', '{}', '{}');

INSERT INTO public.user_role_grants (user_id, role)
VALUES ('00000000-0000-4000-8000-00000000b302', 'catalog_manager');

DO $$
DECLARE v_role_labels text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO v_role_labels
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'app_role';

  IF v_role_labels IS DISTINCT FROM ARRAY[
    'catalog_manager', 'fulfillment_manager', 'support_agent', 'sales_manager', 'super_admin'
  ]::text[] THEN
    RAISE EXCEPTION 'app_role catalog changed unexpectedly: %', v_role_labels;
  END IF;
  IF 'marketing' = ANY(v_role_labels) OR 'manager' = ANY(v_role_labels) THEN
    RAISE EXCEPTION 'a non-existent UI label was added as an app_role';
  END IF;
  IF to_regprocedure('public.grant_user_role(uuid,public.app_role)') IS NOT NULL
     OR to_regprocedure('public.set_user_role_grant(uuid,public.app_role)') IS NOT NULL THEN
    RAISE EXCEPTION 'an unreviewed public staff-role assignment RPC exists';
  END IF;

  BEGIN
    PERFORM 'marketing'::public.app_role;
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'marketing unexpectedly casts to app_role';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
  BEGIN
    PERFORM 'manager'::public.app_role;
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'manager unexpectedly casts to app_role';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE v_is_super_admin boolean;
BEGIN
  -- A normal customer cannot insert its own staff grant, even when the value
  -- is a valid real role. This catches direct table privilege escalation.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b301', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b301","role":"authenticated"}', true);
  BEGIN
    INSERT INTO public.user_role_grants (user_id, role)
    VALUES ('00000000-0000-4000-8000-00000000b301', 'super_admin');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'customer self-assigned super_admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Forged role-like JWT claims must not grant database authority.
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-00000000b301","role":"authenticated","app_metadata":{"app_role":"super_admin","roles":["super_admin","marketing","manager"]},"user_role":"super_admin"}',
    true
  );
  SELECT private.has_any_staff_role(ARRAY['super_admin']::public.app_role[])
  INTO v_is_super_admin;
  IF v_is_super_admin THEN RAISE EXCEPTION 'forged JWT claims granted super_admin authority'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_role_grants WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forged JWT claims created a persisted staff grant';
  END IF;

  -- Catalog management authority stays scoped to catalog actions.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b302', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-00000000b302","role":"authenticated","app_metadata":{"app_role":"super_admin"}}',
    true
  );
  SELECT private.has_any_staff_role(ARRAY['super_admin']::public.app_role[])
  INTO v_is_super_admin;
  IF v_is_super_admin THEN RAISE EXCEPTION 'catalog_manager escalated to super_admin through JWT claims'; END IF;
  IF NOT private.has_any_staff_role(ARRAY['catalog_manager']::public.app_role[]) THEN
    RAISE EXCEPTION 'catalog_manager persisted grant was not recognized';
  END IF;
  BEGIN
    INSERT INTO public.user_role_grants (user_id, role)
    VALUES ('00000000-0000-4000-8000-00000000b302', 'super_admin');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog_manager self-assigned super_admin';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email LIKE 'boundary-%@nodria.test')
     OR EXISTS (
       SELECT 1 FROM public.user_role_grants
       WHERE user_id IN (
         '00000000-0000-4000-8000-00000000b301',
         '00000000-0000-4000-8000-00000000b302'
       )
     ) THEN
    RAISE EXCEPTION 'auth boundary test left fixture records behind after rollback';
  END IF;
END;
$$;

SELECT 'NODRIA PostgreSQL auth role-escalation boundary passed' AS result;
