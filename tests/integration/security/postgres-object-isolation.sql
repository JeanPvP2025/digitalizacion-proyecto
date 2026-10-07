\set ON_ERROR_STOP on

-- Supplemental local PostgreSQL probes for sensitive rows not exercised by
-- tests/integration/postgres-rls.sql. All fixtures and writes are rolled back.
BEGIN;

CREATE TEMP TABLE nodria_security_seed_order_count ON COMMIT DROP AS
SELECT count(*)::integer AS row_count FROM public.orders;
GRANT SELECT ON pg_temp.nodria_security_seed_order_count TO authenticated;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-4000-8000-00000000a011', 'authenticated', 'authenticated', 'sec-customer-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a012', 'authenticated', 'authenticated', 'sec-customer-b@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a013', 'authenticated', 'authenticated', 'sec-sales@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a014', 'authenticated', 'authenticated', 'sec-fulfillment@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a015', 'authenticated', 'authenticated', 'sec-support@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a016', 'authenticated', 'authenticated', 'sec-org-admin@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a017', 'authenticated', 'authenticated', 'sec-org-buyer@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a018', 'authenticated', 'authenticated', 'sec-org-outsider@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000a019', 'authenticated', 'authenticated', 'sec-superadmin@nodria.test', '', '{}', '{}');

INSERT INTO public.user_role_grants (user_id, role)
VALUES
  ('00000000-0000-4000-8000-00000000a013', 'sales_manager'),
  ('00000000-0000-4000-8000-00000000a014', 'fulfillment_manager'),
  ('00000000-0000-4000-8000-00000000a015', 'support_agent'),
  ('00000000-0000-4000-8000-00000000a019', 'super_admin');

INSERT INTO public.organizations (id, slug, legal_name, display_name, created_by, tax_id, billing_email)
VALUES
  ('00000000-0000-4000-8000-00000000d011', 'sec-org-a', 'Seguridad A SL', 'Seguridad A', '00000000-0000-4000-8000-00000000a016', 'B12345678', 'billing-a@nodria.test'),
  ('00000000-0000-4000-8000-00000000d012', 'sec-org-b', 'Seguridad B SL', 'Seguridad B', '00000000-0000-4000-8000-00000000a012', 'B87654321', 'billing-b@nodria.test');

INSERT INTO public.organization_memberships (organization_id, user_id, role, added_by)
VALUES
  ('00000000-0000-4000-8000-00000000d011', '00000000-0000-4000-8000-00000000a016', 'admin', '00000000-0000-4000-8000-00000000a016'),
  ('00000000-0000-4000-8000-00000000d011', '00000000-0000-4000-8000-00000000a017', 'buyer', '00000000-0000-4000-8000-00000000a016'),
  ('00000000-0000-4000-8000-00000000d012', '00000000-0000-4000-8000-00000000a012', 'owner', '00000000-0000-4000-8000-00000000a012');

INSERT INTO public.quotes (id, quote_number, requested_by, organization_id, request_note, status)
VALUES
  ('00000000-0000-4000-8000-00000000e011', 'SEC-Q-ORG-A', '00000000-0000-4000-8000-00000000a017', '00000000-0000-4000-8000-00000000d011', 'Oferta privada de organización A', 'requested'),
  ('00000000-0000-4000-8000-00000000e012', 'SEC-Q-ORG-B', '00000000-0000-4000-8000-00000000a012', '00000000-0000-4000-8000-00000000d012', 'Oferta privada de organización B', 'requested'),
  ('00000000-0000-4000-8000-00000000e013', 'SEC-Q-PUBLIC', '00000000-0000-4000-8000-00000000a011', null, 'Solicitud comercial pública', 'requested');

INSERT INTO public.quote_items (quote_id, variant_id, quantity, product_name, product_sku, variant_title, requested_unit_price, tax_rate, currency)
SELECT '00000000-0000-4000-8000-00000000e011', v.id, 1, p.name, v.sku, v.title, v.current_price, v.tax_rate, v.currency
FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.sku = 'NOD-LM27-4K';
INSERT INTO public.quote_items (quote_id, variant_id, quantity, product_name, product_sku, variant_title, requested_unit_price, tax_rate, currency)
SELECT '00000000-0000-4000-8000-00000000e012', v.id, 1, p.name, v.sku, v.title, v.current_price, v.tax_rate, v.currency
FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.sku = 'NOD-FS-02';
INSERT INTO public.quote_items (quote_id, variant_id, quantity, product_name, product_sku, variant_title, requested_unit_price, tax_rate, currency)
SELECT '00000000-0000-4000-8000-00000000e013', v.id, 1, p.name, v.sku, v.title, v.current_price, v.tax_rate, v.currency
FROM public.product_variants v JOIN public.products p ON p.id = v.product_id WHERE v.sku = 'NOD-FS-02';
INSERT INTO public.crm_activities (organization_id, quote_id, actor_user_id, event_key, title, visibility)
VALUES
  ('00000000-0000-4000-8000-00000000d011', '00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000a016', 'quote_note', 'Nota privada B2B', 'organization'),
  (null, '00000000-0000-4000-8000-00000000e013', '00000000-0000-4000-8000-00000000a011', 'quote_received', 'Nueva solicitud pública', 'internal');

INSERT INTO public.support_tickets (id, ticket_number, customer_id, subject)
VALUES
  ('00000000-0000-4000-8000-00000000c011', 'SEC-T-CUSTOMER-A', '00000000-0000-4000-8000-00000000a011', 'Consulta de seguridad A'),
  ('00000000-0000-4000-8000-00000000c012', 'SEC-T-CUSTOMER-B', '00000000-0000-4000-8000-00000000a012', 'Consulta de seguridad B');

INSERT INTO public.support_messages (ticket_id, author_id, body, is_internal)
VALUES
  ('00000000-0000-4000-8000-00000000c011', '00000000-0000-4000-8000-00000000a011', 'Mensaje público de A', false),
  ('00000000-0000-4000-8000-00000000c011', '00000000-0000-4000-8000-00000000a015', 'Nota interna de A', true),
  ('00000000-0000-4000-8000-00000000c012', '00000000-0000-4000-8000-00000000a012', 'Mensaje público de B', false);

INSERT INTO public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, subtotal, tax_total,
  shipping_total, discount_total, grand_total, shipping_address, billing_address, delivered_at
)
VALUES
  ('00000000-0000-4000-8000-00000000f011', 'SEC-NOD-ORDER-A', '00000000-0000-4000-8000-00000000a011', 'sec-order-a-001', repeat(md5('SEC-NOD-ORDER-A'), 2), 'delivered', 10, 0, 0, 0, 10, '{}', '{}', now()),
  ('00000000-0000-4000-8000-00000000f012', 'SEC-NOD-ORDER-B', '00000000-0000-4000-8000-00000000a012', 'sec-order-b-001', repeat(md5('SEC-NOD-ORDER-B'), 2), 'delivered', 10, 0, 0, 0, 10, '{}', '{}', now());

INSERT INTO public.payment_transactions (order_id, provider, provider_reference, status, amount)
VALUES ('00000000-0000-4000-8000-00000000f011', 'demo_gateway', 'sec-private-payment-ref-a', 'paid', 10);

INSERT INTO public.order_items (id, order_id, product_name, product_sku, quantity, unit_price, currency)
VALUES
  ('00000000-0000-4000-8000-00000000f021', '00000000-0000-4000-8000-00000000f011', 'Artículo A', 'SEC-A', 1, 10, 'EUR'),
  ('00000000-0000-4000-8000-00000000f022', '00000000-0000-4000-8000-00000000f012', 'Artículo B', 'SEC-B', 1, 10, 'EUR');

INSERT INTO public.return_requests (id, return_number, order_id, customer_id, reason)
VALUES
  ('00000031-0000-4000-8000-00000000f031', '', '00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-00000000a011', 'Prueba de aislamiento de devolución A'),
  ('00000032-0000-4000-8000-00000000f032', '', '00000000-0000-4000-8000-00000000f012', '00000000-0000-4000-8000-00000000a012', 'Prueba de aislamiento de devolución B');

INSERT INTO public.return_items (return_request_id, order_item_id, quantity)
VALUES
  ('00000031-0000-4000-8000-00000000f031', '00000000-0000-4000-8000-00000000f021', 1),
  ('00000032-0000-4000-8000-00000000f032', '00000000-0000-4000-8000-00000000f022', 1);

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.organizations', 'SELECT')
     OR has_table_privilege('anon', 'public.orders', 'SELECT')
     OR has_table_privilege('anon', 'public.support_tickets', 'SELECT')
     OR has_table_privilege('anon', 'public.return_requests', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous role has a grant on a private business table';
  END IF;
  IF has_function_privilege('anon', 'public.create_organization(text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.place_order(uuid,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.request_return(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fulfill_order(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_order_delivered(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.adjust_inventory(uuid,uuid,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC execution grant escaped the intended role boundary';
  END IF;
  IF has_table_privilege('authenticated', 'public.inventory', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.orders', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.payment_transactions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.return_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.return_items', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated caller has direct DML on an RPC-owned transition';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a017', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a017","role":"authenticated"}', true);

  SELECT count(*) INTO v_count FROM public.organizations;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Business buyer can read outside their organization'; END IF;
  SELECT count(*) INTO v_count FROM public.quotes;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Business buyer can read a quote outside their organization'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_items;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Business buyer can read quote lines outside their organization'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a016', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a016","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organization_memberships;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Business admin cannot see only its organization roster'; END IF;

  PERFORM public.add_organization_member(
    '00000000-0000-4000-8000-00000000d011', 'sec-org-outsider@nodria.test', 'viewer'
  );

  BEGIN
    PERFORM public.add_organization_member(
      '00000000-0000-4000-8000-00000000d012', 'sec-org-outsider@nodria.test', 'buyer'
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'Business admin added a member to another organization';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.add_organization_member(
      '00000000-0000-4000-8000-00000000d011', 'sec-org-outsider@nodria.test', 'owner'
    );
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'Business admin assigned an owner role';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END;
$$;

DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a011', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a011","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.payment_transactions WHERE order_id = '00000000-0000-4000-8000-00000000f011';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Customer cannot read their own payment transaction'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Customer can read another customer ticket'; END IF;
  SELECT count(*) INTO v_count FROM public.support_messages;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Customer can read internal or cross-customer support messages'; END IF;
  SELECT count(*) INTO v_count FROM public.return_requests;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Customer can read another customer return'; END IF;
  SELECT count(*) INTO v_count FROM public.return_items;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Customer can read another customer return line'; END IF;
  SELECT count(*) INTO v_count FROM public.orders WHERE id = '00000000-0000-4000-8000-00000000f012';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Customer can read another customer order'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a012', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a012","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.payment_transactions WHERE order_id = '00000000-0000-4000-8000-00000000f011';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Customer can read another customer payment transaction'; END IF;
  SELECT count(*) INTO v_count FROM public.return_requests;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Return request owner cannot read their own return'; END IF;
END;
$$;

DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a013', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a013","role":"authenticated"}', true);
  -- Formal tenant records stay private until the quote is assigned; sales can
  -- still work the separate inbound quote inquiry queue.
  SELECT count(*) INTO v_count FROM public.organizations;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read tenant organizations'; END IF;
  SELECT count(*) INTO v_count FROM public.organizations
  WHERE tax_id IN ('B12345678', 'B87654321') AND billing_email LIKE 'billing-%@nodria.test';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read cross-tenant tax and billing fields'; END IF;
  SELECT count(*) INTO v_count FROM public.organization_memberships;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read tenant memberships'; END IF;
  SELECT count(*) INTO v_count FROM public.quotes;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Sales role cannot read the unassigned quote work queue'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_items;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Sales role cannot read the unassigned quote line work queue'; END IF;
  SELECT count(*) INTO v_count FROM public.crm_activities
  WHERE quote_id IN ('00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000e012');
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read organization-only quote activities'; END IF;
  SELECT count(*) INTO v_count FROM public.crm_activities
  WHERE quote_id = '00000000-0000-4000-8000-00000000e013';
  IF v_count < 1 THEN RAISE EXCEPTION 'Sales role cannot read internal activity on its public intake queue'; END IF;
  SELECT count(*) INTO v_count FROM public.orders;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read customer orders'; END IF;
  SELECT count(*) INTO v_count FROM public.payment_transactions;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read another customer payment transaction'; END IF;
  SELECT count(*) INTO v_count FROM public.return_requests;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read customer returns'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Sales role can read customer support tickets'; END IF;
END;
$$;

DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a014', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a014","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.orders;
  IF v_count <> (SELECT row_count + 2 FROM pg_temp.nodria_security_seed_order_count) THEN
    RAISE EXCEPTION 'Fulfillment role cannot read the complete operations order queue';
  END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count = 0 THEN RAISE EXCEPTION 'Fulfillment role cannot read stock'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Fulfillment role can read CRM inquiries'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Fulfillment role can read support tickets'; END IF;
END;
$$;

DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a015', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a015","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.support_tickets;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Support role cannot read the support queue'; END IF;
  SELECT count(*) INTO v_count FROM public.support_messages;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Support role cannot read internal and public messages'; END IF;
  SELECT count(*) INTO v_count FROM public.orders;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Support role cannot read orders needed for case handling'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Support role can read inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.payment_transactions;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Support role can read payment transactions'; END IF;
END;
$$;

DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a019', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000a019","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.user_role_grants;
  IF v_count <> 4 THEN RAISE EXCEPTION 'Superadmin cannot inspect staff grants'; END IF;
  SELECT count(*) INTO v_count FROM public.audit_events;
  IF v_count = 0 THEN RAISE EXCEPTION 'Superadmin cannot inspect audit events'; END IF;
  SELECT count(*) INTO v_count FROM public.orders;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Superadmin cannot inspect orders'; END IF;
END;
$$;

RESET ROLE;
ROLLBACK;

SELECT 'NODRIA supplemental security probes passed (fixtures rolled back)' AS result;
