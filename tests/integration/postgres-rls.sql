\set ON_ERROR_STOP on

-- Runtime gate for the locally migrated Supabase database. Every fixture,
-- order, stock reservation, and audit event is rolled back at the end.
BEGIN;

CREATE TEMP TABLE nodria_qa_seed_inventory_count ON COMMIT DROP AS
SELECT count(*)::integer AS row_count FROM public.inventory;
GRANT SELECT ON pg_temp.nodria_qa_seed_inventory_count TO authenticated;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'qa-customer-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'qa-customer-b@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a003', 'authenticated', 'authenticated', 'qa-sales@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a004', 'authenticated', 'authenticated', 'qa-fulfillment@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a005', 'authenticated', 'authenticated', 'qa-support@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a006', 'authenticated', 'authenticated', 'qa-org-owner@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a007', 'authenticated', 'authenticated', 'qa-org-admin@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a008', 'authenticated', 'authenticated', 'qa-org-buyer@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a009', 'authenticated', 'authenticated', 'qa-org-outsider@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a010', 'authenticated', 'authenticated', 'qa-superadmin@nodria.test', '', '{}', '{}');

INSERT INTO public.user_role_grants (user_id, role)
VALUES
  ('00000000-0000-4000-8000-00000000a003', 'sales_manager'),
  ('00000000-0000-4000-8000-00000000a004', 'fulfillment_manager'),
  ('00000000-0000-4000-8000-00000000a005', 'support_agent'),
  ('00000000-0000-4000-8000-00000000a010', 'super_admin');

INSERT INTO public.organizations (id, slug, legal_name, display_name, created_by)
VALUES
  ('00000000-0000-4000-8000-00000000d001', 'qa-org-a', 'QA Organización A SL', 'QA Org A', '00000000-0000-4000-8000-00000000a006'),
  ('00000000-0000-4000-8000-00000000d002', 'qa-org-b', 'QA Organización B SL', 'QA Org B', '00000000-0000-4000-8000-00000000a009');

INSERT INTO public.organization_memberships (organization_id, user_id, role, added_by)
VALUES
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000a006', 'owner', '00000000-0000-4000-8000-00000000a006'),
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000a007', 'admin', '00000000-0000-4000-8000-00000000a006'),
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000a008', 'buyer', '00000000-0000-4000-8000-00000000a006'),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000a009', 'owner', '00000000-0000-4000-8000-00000000a009');

INSERT INTO public.quote_inquiries (contact_name, email, company, message, consent_to_contact, source)
VALUES ('QA B2B Contact', 'qa-b2b@nodria.test', 'QA Example SL', 'Solicitamos una propuesta de equipamiento.', true, 'qa-rls');

INSERT INTO public.support_tickets (id, ticket_number, customer_id, subject)
VALUES
  ('00000000-0000-4000-8000-00000000c001', 'QA-RLS-CUSTOMER-A', '00000000-0000-4000-8000-00000000a001', 'Consulta QA de A'),
  ('00000000-0000-4000-8000-00000000c002', 'QA-RLS-CUSTOMER-B', '00000000-0000-4000-8000-00000000a002', 'Consulta QA de B');

INSERT INTO public.carts (id, user_id, currency)
VALUES
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001', 'EUR'),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a002', 'EUR');

INSERT INTO public.cart_items (cart_id, variant_id, quantity)
SELECT '00000000-0000-4000-8000-00000000b001', id, 1
FROM public.product_variants WHERE sku = 'NOD-LM27-4K';

INSERT INTO public.cart_items (cart_id, variant_id, quantity)
SELECT '00000000-0000-4000-8000-00000000b002', id, 7
FROM public.product_variants WHERE sku = 'NOD-FS-02';

CREATE TEMP TABLE nodria_qa_initial_stock ON COMMIT DROP AS
SELECT v.sku, i.reserved
FROM public.inventory AS i
JOIN public.product_variants AS v ON v.id = i.variant_id
WHERE v.sku = 'NOD-LM27-4K';
GRANT SELECT ON nodria_qa_initial_stock TO authenticated;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.quote_inquiries', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous quote role must not have SELECT privilege';
  END IF;
  IF NOT has_column_privilege('anon', 'public.quote_inquiries', 'contact_name', 'INSERT')
     OR has_column_privilege('anon', 'public.quote_inquiries', 'status', 'INSERT') THEN
    RAISE EXCEPTION 'Anonymous quote role has an unexpected column grant';
  END IF;
END;
$$;

SET LOCAL ROLE anon;

-- Anonymous B2B intake may insert only an opted-in new request.
INSERT INTO public.quote_inquiries (contact_name, email, company, message, consent_to_contact)
VALUES ('QA Anonymous Contact', 'qa-anon@nodria.test', 'QA Example SL', 'Solicitamos una propuesta para varias oficinas.', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.quote_inquiries (contact_name, email, company, message, consent_to_contact, status)
    VALUES ('QA Forged Contact', 'qa-forged@nodria.test', 'QA Example SL', 'Intento de modificar la etapa comercial.', true, 'qualified');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'Anonymous B2B caller changed a CRM stage';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.quote_inquiries (contact_name, email, company, message, consent_to_contact)
    VALUES ('QA No Consent', 'qa-no-consent@nodria.test', 'QA Example SL', 'Solicitud que no incluye consentimiento.', false);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'B2B row without consent passed RLS';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_first record;
  v_retry record;
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);

  SELECT * INTO v_first
  FROM public.place_order(
    '00000000-0000-4000-8000-00000000b001',
    'qa-checkout-idempotency-001',
    '{"fullName":"QA Customer A","email":"qa-customer-a@nodria.test","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"QA Customer A","email":"qa-customer-a@nodria.test","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  );
  SELECT * INTO v_retry
  FROM public.place_order(
    '00000000-0000-4000-8000-00000000b001',
    'qa-checkout-idempotency-001',
    '{"fullName":"QA Customer A","email":"qa-customer-a@nodria.test","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"QA Customer A","email":"qa-customer-a@nodria.test","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  );

  IF v_first.order_id IS DISTINCT FROM v_retry.order_id
     OR v_first.order_number IS DISTINCT FROM v_retry.order_number
     OR v_first.grand_total IS DISTINCT FROM v_retry.grand_total
     OR v_first.currency <> 'EUR'
     OR v_first.grand_total <> 629.00 THEN
    RAISE EXCEPTION 'Checkout retry did not return the same authoritative order snapshot';
  END IF;

  SELECT count(*) INTO v_count FROM public.orders WHERE id = v_first.order_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Idempotent checkout created more than one order'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);

  SELECT count(*) INTO v_count FROM public.orders WHERE id = v_first.order_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'A different customer can read another customer order'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a003', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.orders WHERE id = v_first.order_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales manager can read another customer order'; END IF;
  SELECT count(*) INTO v_count FROM public.order_items WHERE order_id = v_first.order_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales manager can read another customer order items'; END IF;
  SELECT count(*) INTO v_count FROM public.order_events WHERE order_id = v_first.order_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales manager can read another customer order events'; END IF;
  SELECT count(*) INTO v_count FROM public.payment_transactions WHERE order_id = v_first.order_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales manager can read another customer payment transactions'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
  BEGIN
    SELECT * INTO v_retry FROM public.place_order(
      '00000000-0000-4000-8000-00000000b001',
      'qa-cross-customer-cart-001',
      '{"fullName":"QA Customer B","email":"qa-customer-b@nodria.test","phone":"600000000","address":"Calle de Prueba 2","postalCode":"28002","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
      '{"fullName":"QA Customer B","email":"qa-customer-b@nodria.test","phone":"600000000","address":"Calle de Prueba 2","postalCode":"28002","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'A different customer placed an order from someone else cart';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    NULL;
  END;

  BEGIN
    SELECT * INTO v_retry FROM public.place_order(
      '00000000-0000-4000-8000-00000000b002',
      'qa-overstock-checkout-001',
      '{"fullName":"QA Customer B","email":"qa-customer-b@nodria.test","phone":"600000000","address":"Calle de Prueba 2","postalCode":"28002","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
      '{"fullName":"QA Customer B","email":"qa-customer-b@nodria.test","phone":"600000000","address":"Calle de Prueba 2","postalCode":"28002","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'Checkout accepted a quantity above available stock';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    NULL;
  END;

  SELECT count(*) INTO v_count FROM public.orders WHERE customer_id = auth.uid();
  IF v_count <> 0 THEN RAISE EXCEPTION 'Failed overstock checkout left an order behind'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Customer can read a ticket belonging to another customer'; END IF;

  BEGIN
    INSERT INTO public.support_tickets (customer_id, subject, status, priority)
    VALUES ('00000000-0000-4000-8000-00000000a002', 'QA forged ticket owner', 'open', 'normal');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'Customer created a support ticket for a different customer';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

DO $$
DECLARE
  v_count integer;
  v_reserved integer;
  v_initial_reserved integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Customer can read staff inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Customer can read CRM inquiries'; END IF;
  SELECT count(*) INTO v_count FROM public.user_role_grants;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Customer can read staff role grants'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a003', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a003","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.quote_inquiries;
  IF v_count < 1 THEN RAISE EXCEPTION 'Sales manager cannot read B2B CRM inquiries'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales manager can read inventory without a fulfillment role'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales manager can read customer support tickets'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a004', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a004","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> (SELECT row_count FROM pg_temp.nodria_qa_seed_inventory_count) THEN
    RAISE EXCEPTION 'Fulfillment manager cannot read all seeded stock rows';
  END IF;
  SELECT i.reserved, baseline.reserved INTO v_reserved, v_initial_reserved
  FROM public.inventory AS i
  JOIN public.product_variants AS v ON v.id = i.variant_id
  JOIN pg_temp.nodria_qa_initial_stock AS baseline ON baseline.sku = v.sku
  WHERE v.sku = 'NOD-LM27-4K';
  IF v_reserved - v_initial_reserved <> 1 THEN RAISE EXCEPTION 'Idempotent retry reserved stock more than once or failed to reserve'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Fulfillment manager can read sales CRM inquiries'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a005', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a005","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Support agent cannot read the support queue'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Support agent can read inventory without a fulfillment role'; END IF;
END;
$$;

-- Organization boundary: business_user maps to buyer; business_manager maps to admin.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a008', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a008","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organizations;
  IF v_count <> 1 THEN RAISE EXCEPTION 'A business buyer can read an organization outside their membership'; END IF;
  SELECT count(*) INTO v_count FROM public.organization_memberships;
  IF v_count <> 1 THEN RAISE EXCEPTION 'A business buyer can read memberships outside their organization'; END IF;
  BEGIN
    PERFORM public.add_organization_member(
      '00000000-0000-4000-8000-00000000d001', 'qa-org-outsider@nodria.test', 'buyer'
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'A business buyer added a member';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a007', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a007","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organization_memberships;
  IF v_count <> 3 THEN RAISE EXCEPTION 'A business admin cannot see its organization memberships'; END IF;
  PERFORM public.add_organization_member(
    '00000000-0000-4000-8000-00000000d001', 'qa-org-outsider@nodria.test', 'viewer'
  );
  BEGIN
    PERFORM public.add_organization_member(
      '00000000-0000-4000-8000-00000000d002', 'qa-org-outsider@nodria.test', 'buyer'
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'A business admin changed a different organization';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.add_organization_member(
      '00000000-0000-4000-8000-00000000d001', 'qa-org-outsider@nodria.test', 'owner'
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'A business admin assigned an owner role';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    UPDATE public.organization_memberships SET role = 'owner'
    WHERE organization_id = '00000000-0000-4000-8000-00000000d001' AND user_id = '00000000-0000-4000-8000-00000000a008';
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'A business admin changed a membership role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a010', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a010","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organizations;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Super admin cannot inspect organizations'; END IF;
  SELECT count(*) INTO v_count FROM public.organization_memberships;
  IF v_count <> 5 THEN RAISE EXCEPTION 'Super admin cannot inspect all organization memberships'; END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.organization_memberships', 'SELECT')
     OR has_table_privilege('anon', 'public.organization_memberships', 'INSERT')
     OR has_table_privilege('anon', 'public.organization_memberships', 'UPDATE')
     OR has_table_privilege('anon', 'public.organization_memberships', 'DELETE') THEN
    RAISE EXCEPTION 'Anonymous role has organization membership table access';
  END IF;
END;
$$;

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.quote_inquiries WHERE email LIKE 'qa-%@nodria.test')
     OR EXISTS (SELECT 1 FROM public.support_tickets WHERE ticket_number LIKE 'QA-RLS-%')
     OR EXISTS (SELECT 1 FROM auth.users WHERE email LIKE 'qa-%@nodria.test') THEN
    RAISE EXCEPTION 'The PostgreSQL QA transaction left fixture records behind';
  END IF;
END;
$$;

SELECT 'NODRIA PostgreSQL RLS and checkout transaction gate passed' AS result;
