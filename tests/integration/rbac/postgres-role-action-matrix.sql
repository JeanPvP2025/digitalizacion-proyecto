\set ON_ERROR_STOP on

-- Runtime authorization matrix using the PostgreSQL roles PostgREST uses
-- (anon/authenticated/service_role) plus persisted public.app_role grants.
-- Every synthetic row and mutation is inside this rollback-only transaction.
BEGIN;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-4000-8000-00000000b101', 'authenticated', 'authenticated', 'rbac-customer-a@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b102', 'authenticated', 'authenticated', 'rbac-customer-b@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b103', 'authenticated', 'authenticated', 'rbac-catalog@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b104', 'authenticated', 'authenticated', 'rbac-support@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b105', 'authenticated', 'authenticated', 'rbac-sales@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b106', 'authenticated', 'authenticated', 'rbac-fulfillment@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b107', 'authenticated', 'authenticated', 'rbac-superadmin@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b108', 'authenticated', 'authenticated', 'rbac-org-admin@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b109', 'authenticated', 'authenticated', 'rbac-org-buyer@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000b110', 'authenticated', 'authenticated', 'rbac-outsider@nodria.test', '', '{}', '{}');

INSERT INTO public.user_role_grants (user_id, role)
VALUES
  ('00000000-0000-4000-8000-00000000b103', 'catalog_manager'),
  ('00000000-0000-4000-8000-00000000b104', 'support_agent'),
  ('00000000-0000-4000-8000-00000000b105', 'sales_manager'),
  ('00000000-0000-4000-8000-00000000b106', 'fulfillment_manager'),
  ('00000000-0000-4000-8000-00000000b107', 'super_admin');

INSERT INTO public.organizations (id, slug, legal_name, display_name, created_by)
VALUES
  ('00000000-0000-4000-8000-00000000d101', 'rbac-org-a', 'RBAC Organización A SL', 'RBAC Org A', '00000000-0000-4000-8000-00000000b108'),
  ('00000000-0000-4000-8000-00000000d102', 'rbac-org-b', 'RBAC Organización B SL', 'RBAC Org B', '00000000-0000-4000-8000-00000000b110');

INSERT INTO public.organization_memberships (organization_id, user_id, role, added_by)
VALUES
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000b108', 'admin', '00000000-0000-4000-8000-00000000b108'),
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000b109', 'buyer', '00000000-0000-4000-8000-00000000b108'),
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000b110', 'owner', '00000000-0000-4000-8000-00000000b110');

INSERT INTO public.products (id, slug, sku, name, brand, summary, is_published)
VALUES ('qa-rbac-unpublished', 'qa-rbac-unpublished', 'QA-RBAC-UNPUBLISHED-01', 'RBAC unpublished product', 'NODRIA QA', 'Before edit', false);

INSERT INTO public.carts (id, user_id, currency)
VALUES
  ('00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000b101', 'EUR'),
  ('00000000-0000-4000-8000-00000000b202', '00000000-0000-4000-8000-00000000b102', 'EUR');

INSERT INTO public.support_tickets (id, ticket_number, customer_id, subject)
VALUES
  ('00000000-0000-4000-8000-00000000c101', 'RBAC-T-CUSTOMER-A', '00000000-0000-4000-8000-00000000b101', 'RBAC ticket A'),
  ('00000000-0000-4000-8000-00000000c102', 'RBAC-T-CUSTOMER-B', '00000000-0000-4000-8000-00000000b102', 'RBAC ticket B');

INSERT INTO public.quote_inquiries (contact_name, email, company, message, consent_to_contact, source)
VALUES ('RBAC Contact', 'rbac-inquiry@nodria.test', 'RBAC Example SL', 'Synthetic inquiry for role coverage.', true, 'rbac-matrix');

INSERT INTO public.quotes (id, quote_number, requested_by, organization_id, request_note, status)
VALUES
  ('00000000-0000-4000-8000-00000000e101', 'RBAC-Q-A', '00000000-0000-4000-8000-00000000b109', '00000000-0000-4000-8000-00000000d101', 'Synthetic quote A', 'requested'),
  ('00000000-0000-4000-8000-00000000e102', 'RBAC-Q-B', '00000000-0000-4000-8000-00000000b110', '00000000-0000-4000-8000-00000000d102', 'Synthetic quote B', 'requested');

-- ACL checks are global to the PostgREST database role. RLS below checks the
-- application role stored for each auth.uid(), rather than a UI role label.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.orders', 'SELECT')
     OR has_table_privilege('anon', 'public.user_role_grants', 'SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has a private table grant';
  END IF;
  IF has_table_privilege('authenticated', 'public.user_role_grants', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_role_grants', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_role_grants', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated can mutate staff grants directly';
  END IF;
  IF has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') THEN
    RAISE EXCEPTION 'profile column grants do not match the restricted self-service contract';
  END IF;
  IF has_table_privilege('authenticated', 'public.orders', 'INSERT')
     OR has_table_privilege('authenticated', 'public.orders', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.orders', 'DELETE')
     OR has_table_privilege('authenticated', 'public.inventory', 'INSERT')
     OR has_table_privilege('authenticated', 'public.inventory', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.inventory', 'DELETE')
     OR has_table_privilege('authenticated', 'public.organizations', 'UPDATE') THEN
    RAISE EXCEPTION 'direct order or inventory DML is unexpectedly granted';
  END IF;
  IF has_table_privilege('authenticated', 'public.categories', 'INSERT')
     OR has_table_privilege('authenticated', 'public.categories', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.categories', 'DELETE')
     OR has_table_privilege('authenticated', 'public.products', 'INSERT')
     OR has_table_privilege('authenticated', 'public.products', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.products', 'DELETE')
     OR has_table_privilege('authenticated', 'public.product_categories', 'INSERT')
     OR has_table_privilege('authenticated', 'public.product_categories', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.product_categories', 'DELETE')
     OR has_table_privilege('authenticated', 'public.product_variants', 'INSERT')
     OR has_table_privilege('authenticated', 'public.product_variants', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.product_variants', 'DELETE')
     OR has_table_privilege('authenticated', 'public.product_specifications', 'INSERT')
     OR has_table_privilege('authenticated', 'public.product_specifications', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.product_specifications', 'DELETE')
     OR has_any_column_privilege('authenticated', 'public.categories', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.categories', 'UPDATE')
     OR has_any_column_privilege('authenticated', 'public.products', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.products', 'UPDATE')
     OR has_any_column_privilege('authenticated', 'public.product_categories', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.product_categories', 'UPDATE')
     OR has_any_column_privilege('authenticated', 'public.product_variants', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.product_variants', 'UPDATE')
     OR has_any_column_privilege('authenticated', 'public.product_specifications', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.product_specifications', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated can directly mutate a catalog table';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.products', 'SELECT')
     OR NOT has_table_privilege('anon', 'public.products', 'SELECT') THEN
    RAISE EXCEPTION 'catalog reads were removed while restricting writes';
  END IF;
  IF has_function_privilege('anon', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'private.update_catalog_product_editorial_impl(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'private.update_catalog_product_editorial_impl(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('service_role', 'private.update_catalog_product_editorial_impl(text,jsonb)', 'EXECUTE')
     OR (SELECT procedure.prosecdef FROM pg_catalog.pg_proc AS procedure
         WHERE procedure.oid = 'public.update_catalog_product_editorial(text,jsonb)'::regprocedure)
     OR NOT (SELECT procedure.prosecdef FROM pg_catalog.pg_proc AS procedure
             WHERE procedure.oid = 'private.update_catalog_product_editorial_impl(text,jsonb)'::regprocedure)
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_proc AS procedure
       CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
       WHERE procedure.oid = 'public.update_catalog_product_editorial(text,jsonb)'::regprocedure
         AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'catalog editorial RPC grants do not match authenticated-only contract';
  END IF;
  IF has_function_privilege('anon', 'public.place_order_from_checkout(uuid,text,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.place_order_from_checkout(uuid,text,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fulfill_order(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fulfill_order(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.mark_order_delivered(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_order_delivered(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.adjust_inventory(uuid,uuid,integer,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.adjust_inventory(uuid,uuid,integer,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fulfill_order(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.mark_order_delivered(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.adjust_inventory(uuid,uuid,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'sensitive checkout/operations RPC grants do not match the server-only contract';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.add_organization_member(uuid,text,public.organization_role)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.add_organization_member(uuid,text,public.organization_role)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_business_quote(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_business_quote(uuid,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.claim_business_quote(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_business_quote(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_support_ticket(text,text,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_support_ticket(text,text,uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.request_return(uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.request_return(uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated business/support RPC grants are missing';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.products WHERE sku = 'QA-RBAC-UNPUBLISHED-01';
  IF v_count <> 0 THEN RAISE EXCEPTION 'anon can read an unpublished catalog item'; END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_count integer;
  v_rows integer;
  v_is_staff boolean;
BEGIN
  -- Customer A: own profile/cart/ticket only; cannot enumerate CRM, inventory,
  -- staff grants, another customer's cart, or unpublished catalog rows.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b101', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b101","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000b101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'customer cannot read own profile'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000b102';
  IF v_count <> 0 THEN RAISE EXCEPTION 'customer can read another profile'; END IF;
  SELECT count(*) INTO v_count FROM public.carts WHERE id IN ('00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000b202');
  IF v_count <> 1 THEN RAISE EXCEPTION 'customer cart boundary failed'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets
  WHERE id IN ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c102');
  IF v_count <> 1 THEN RAISE EXCEPTION 'customer ticket boundary failed'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries WHERE email = 'rbac-inquiry@nodria.test';
  IF v_count <> 0 THEN RAISE EXCEPTION 'customer can read CRM inquiries'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'customer can read inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.user_role_grants;
  IF v_count <> 0 THEN RAISE EXCEPTION 'customer can enumerate staff grants'; END IF;
  SELECT count(*) INTO v_count FROM public.products WHERE sku = 'QA-RBAC-UNPUBLISHED-01';
  IF v_count <> 0 THEN RAISE EXCEPTION 'customer can read unpublished catalog item'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b102', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b102","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000b102';
  IF v_count <> 1 THEN RAISE EXCEPTION 'customer B cannot read own profile'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles WHERE id = '00000000-0000-4000-8000-00000000b101';
  IF v_count <> 0 THEN RAISE EXCEPTION 'customer B can read customer A profile'; END IF;
  SELECT count(*) INTO v_count FROM public.carts WHERE id IN ('00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000b202');
  IF v_count <> 1 THEN RAISE EXCEPTION 'customer B cart boundary failed'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets
  WHERE id IN ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c102');
  IF v_count <> 1 THEN RAISE EXCEPTION 'customer B ticket boundary failed'; END IF;

  -- Buyer and organization admin see only their own tenant. Buyers do not list
  -- other members; org admins can inspect their roster and manage allowed roles.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b109', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b109","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organizations
  WHERE id IN ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d102');
  IF v_count <> 1 THEN RAISE EXCEPTION 'business buyer can read outside its organization'; END IF;
  SELECT count(*) INTO v_count FROM public.organization_memberships WHERE organization_id = '00000000-0000-4000-8000-00000000d101';
  IF v_count <> 1 THEN RAISE EXCEPTION 'business buyer can enumerate organization roster'; END IF;
  SELECT count(*) INTO v_count FROM public.quotes
  WHERE id IN ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000e102');
  IF v_count <> 1 THEN RAISE EXCEPTION 'business buyer can read a quote outside its organization'; END IF;
  BEGIN
    PERFORM public.add_organization_member('00000000-0000-4000-8000-00000000d101', 'rbac-outsider@nodria.test', 'viewer');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'business buyer added an organization member';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b108', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b108","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organization_memberships WHERE organization_id = '00000000-0000-4000-8000-00000000d101';
  IF v_count <> 2 THEN RAISE EXCEPTION 'business admin cannot read its organization roster'; END IF;
  BEGIN
    UPDATE public.organizations SET display_name = 'RBAC Org A updated' WHERE id = '00000000-0000-4000-8000-00000000d101';
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'business admin directly updated organization fields';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.add_organization_member('00000000-0000-4000-8000-00000000d101', 'rbac-outsider@nodria.test', 'viewer');
  BEGIN
    PERFORM public.add_organization_member('00000000-0000-4000-8000-00000000d102', 'rbac-customer-a@nodria.test', 'buyer');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'business admin changed a different organization';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.add_organization_member('00000000-0000-4000-8000-00000000d101', 'rbac-customer-a@nodria.test', 'owner');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'business admin escalated a member to owner';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Catalog manager can read hidden products and edit only editorial fields;
  -- publication, identity, rating and inventory remain outside the contract.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b103', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b103","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.products WHERE sku = 'QA-RBAC-UNPUBLISHED-01';
  IF v_count <> 1 THEN RAISE EXCEPTION 'catalog manager cannot read an unpublished product'; END IF;
  BEGIN
    UPDATE public.products SET is_published = true WHERE sku = 'QA-RBAC-UNPUBLISHED-01';
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog manager directly updated a product';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.product_specifications (product_id, label, value)
    VALUES ('qa-rbac-unpublished', 'Protected', 'No direct insert');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog manager directly inserted a specification';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.product_categories WHERE product_id = 'qa-rbac-unpublished';
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog manager directly deleted a category link';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF public.update_catalog_product_editorial(
       'qa-rbac-unpublished',
       '{"name":"Updated editorial name","summary":"Updated summary","image_url":null,"badge":"Nuevo"}'::jsonb
     ) ->> 'changed' <> 'true' THEN
    RAISE EXCEPTION 'catalog manager could not edit allowed product fields';
  END IF;
  IF public.update_catalog_product_editorial(
       'qa-rbac-unpublished',
       '{"name":"Updated editorial name","summary":"Updated summary","image_url":null,"badge":"Nuevo"}'::jsonb
     ) ->> 'changed' <> 'false' THEN
    RAISE EXCEPTION 'catalog editorial replay was not idempotent';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM public.products
       WHERE id = 'qa-rbac-unpublished' AND name = 'Updated editorial name'
         AND summary = 'Updated summary' AND image_url IS NULL AND badge = 'Nuevo'
         AND is_published = false AND rating_count = 0
     ) THEN
    RAISE EXCEPTION 'catalog editor changed a protected value or failed to persist editorial values';
  END IF;
  BEGIN
    PERFORM public.update_catalog_product_editorial('qa-rbac-unpublished', '{"is_published":true}'::jsonb);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog RPC accepted a protected field';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.update_catalog_product_editorial('qa-rbac-unpublished', '{"name":null}'::jsonb);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog RPC accepted an invalid type';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.update_catalog_product_editorial('qa-rbac-unpublished', '{"name":"x"}'::jsonb);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog RPC accepted a too-short name';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'catalog manager can read inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries;
  IF v_count <> 0 THEN RAISE EXCEPTION 'catalog manager can read CRM'; END IF;
  BEGIN
    PERFORM public.claim_business_quote('00000000-0000-4000-8000-00000000e101');
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'catalog manager claimed a sales quote';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b107', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b107","role":"authenticated"}', true);
  IF public.update_catalog_product_editorial('qa-rbac-unpublished', '{"image_alt":"Superadmin edit"}'::jsonb) ->> 'changed' <> 'true' THEN
    RAISE EXCEPTION 'persisted super_admin grant cannot edit catalog';
  END IF;

  -- Other staff and ordinary customers cannot call the narrowly granted RPC,
  -- even if a user-editable JWT metadata field claims a privileged role.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b105', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b105","role":"authenticated","user_metadata":{"role":"catalog_manager"}}', true);
  BEGIN
    PERFORM public.update_catalog_product_editorial('qa-rbac-unpublished', '{"name":"Unauthorized"}'::jsonb);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'sales manager edited catalog';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b106', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b106","role":"authenticated"}', true);
  BEGIN
    PERFORM public.update_catalog_product_editorial('qa-rbac-unpublished', '{"name":"Unauthorized"}'::jsonb);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'fulfillment manager edited catalog';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b101', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b101","role":"authenticated","user_metadata":{"role":"super_admin"}}', true);
  BEGIN
    PERFORM public.update_catalog_product_editorial('qa-rbac-unpublished', '{"name":"Unauthorized"}'::jsonb);
    RAISE EXCEPTION USING ERRCODE = 'ZX000', MESSAGE = 'customer metadata escalated catalog access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Support owns the support queue and changes ticket state through the
  -- audited RPC; direct table DML stays revoked for authenticated clients.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b104', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b104","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.support_tickets
  WHERE id IN ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c102');
  IF v_count <> 2 THEN RAISE EXCEPTION 'support agent cannot read support queue'; END IF;
  PERFORM public.send_support_message(
    '00000000-0000-4000-8000-00000000c101',
    'Role matrix status transition.',
    'in_progress',
    '00000000-0000-4000-8000-00000000f104'
  );
  SELECT count(*) INTO v_rows FROM public.support_tickets
  WHERE id = '00000000-0000-4000-8000-00000000c101' AND status = 'in_progress';
  IF v_rows <> 1 THEN RAISE EXCEPTION 'support agent cannot transition an authorized ticket through the RPC'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'support agent can read inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries WHERE email = 'rbac-inquiry@nodria.test';
  IF v_count <> 0 THEN RAISE EXCEPTION 'support agent can read CRM'; END IF;

  -- Sales may read the inquiry and claim an unassigned quote, but gets no
  -- customer support, tenant directory, or inventory access.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b105', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b105","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.quote_inquiries WHERE email = 'rbac-inquiry@nodria.test';
  IF v_count <> 1 THEN RAISE EXCEPTION 'sales manager cannot read the CRM inquiry'; END IF;
  SELECT count(*) INTO v_count FROM public.organizations
  WHERE id IN ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d102');
  IF v_count <> 0 THEN RAISE EXCEPTION 'sales manager can enumerate organizations'; END IF;
  SELECT count(*) INTO v_count FROM public.organization_memberships;
  IF v_count <> 0 THEN RAISE EXCEPTION 'sales manager can enumerate memberships'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets
  WHERE id IN ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c102');
  IF v_count <> 0 THEN RAISE EXCEPTION 'sales manager can read support tickets'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count <> 0 THEN RAISE EXCEPTION 'sales manager can read inventory'; END IF;
  PERFORM public.claim_business_quote('00000000-0000-4000-8000-00000000e101');
  SELECT count(*) INTO v_count FROM public.quotes
  WHERE id = '00000000-0000-4000-8000-00000000e101'
    AND sales_owner_id = '00000000-0000-4000-8000-00000000b105'
    AND status = 'in_review';
  IF v_count <> 1 THEN RAISE EXCEPTION 'sales claim RPC did not assign the requested quote'; END IF;

  -- Fulfillment has operational read scope, without CRM/support rights. Its
  -- write path is server/service-role RPC only (checked in the ACL block).
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b106', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b106","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.warehouses;
  IF v_count < 1 THEN RAISE EXCEPTION 'fulfillment manager cannot read warehouses'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count < 1 THEN RAISE EXCEPTION 'fulfillment manager cannot read inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries WHERE email = 'rbac-inquiry@nodria.test';
  IF v_count <> 0 THEN RAISE EXCEPTION 'fulfillment manager can read CRM'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets
  WHERE id IN ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c102');
  IF v_count <> 0 THEN RAISE EXCEPTION 'fulfillment manager can read support queue'; END IF;

  -- Super admin has the documented cross-domain read scope.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000b107', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000b107","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organizations
  WHERE id IN ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d102');
  IF v_count <> 2 THEN RAISE EXCEPTION 'super admin cannot read all organizations'; END IF;
  SELECT count(*) INTO v_count FROM public.support_tickets
  WHERE id IN ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c102');
  IF v_count <> 2 THEN RAISE EXCEPTION 'super admin cannot read support queue'; END IF;
  SELECT count(*) INTO v_count FROM public.quote_inquiries WHERE email = 'rbac-inquiry@nodria.test';
  IF v_count <> 1 THEN RAISE EXCEPTION 'super admin cannot read CRM inquiries'; END IF;
  SELECT count(*) INTO v_count FROM public.inventory;
  IF v_count < 1 THEN RAISE EXCEPTION 'super admin cannot read inventory'; END IF;
  SELECT count(*) INTO v_count FROM public.user_role_grants
  WHERE user_id IN (
    '00000000-0000-4000-8000-00000000b103', '00000000-0000-4000-8000-00000000b104',
    '00000000-0000-4000-8000-00000000b105', '00000000-0000-4000-8000-00000000b106',
    '00000000-0000-4000-8000-00000000b107'
  );
  IF v_count <> 5 THEN RAISE EXCEPTION 'super admin cannot inspect staff grants'; END IF;
END;
$$;

RESET ROLE;
ROLLBACK;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email LIKE 'rbac-%@nodria.test')
     OR EXISTS (SELECT 1 FROM public.support_tickets WHERE ticket_number LIKE 'RBAC-T-%')
     OR EXISTS (SELECT 1 FROM public.products WHERE sku = 'QA-RBAC-UNPUBLISHED-01') THEN
    RAISE EXCEPTION 'RBAC matrix left fixture records behind after rollback';
  END IF;
END;
$$;

SELECT 'NODRIA PostgreSQL role/action RBAC matrix passed' AS result;
