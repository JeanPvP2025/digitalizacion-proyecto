-- Run after a local migration reset with:
-- pnpm dlx supabase@latest test db --local tests/database/crm_customer_orders.sql
create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(23);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-00000000d101', 'authenticated', 'authenticated', 'crm-customer-a@nodria.test', '', now(), '{}', '{"display_name":"Cliente A"}', now(), now()),
  ('10000000-0000-4000-8000-00000000d102', 'authenticated', 'authenticated', 'crm-customer-b@nodria.test', '', now(), '{}', '{"display_name":"Cliente B"}', now(), now()),
  ('10000000-0000-4000-8000-00000000d103', 'authenticated', 'authenticated', 'crm-sales@nodria.test', '', now(), '{}', '{"display_name":"Ventas Internas"}', now(), now()),
  ('10000000-0000-4000-8000-00000000d104', 'authenticated', 'authenticated', 'crm-support@nodria.test', '', now(), '{}', '{"display_name":"Soporte Interno"}', now(), now()),
  ('10000000-0000-4000-8000-00000000d105', 'authenticated', 'authenticated', 'crm-admin@nodria.test', '', now(), '{}', '{"display_name":"Admin Interno"}', now(), now());

insert into public.user_role_grants (user_id, role)
values
  ('10000000-0000-4000-8000-00000000d103', 'sales_manager'),
  ('10000000-0000-4000-8000-00000000d104', 'support_agent'),
  ('10000000-0000-4000-8000-00000000d105', 'super_admin');

insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address, placed_at
)
values
  ('10000000-0000-4000-8000-00000000f101', 'CRM-READ-001', '10000000-0000-4000-8000-00000000d101', 'crm-read-order-a-001', repeat('a', 64), 'processing', 'EUR', 100, 21, 5, 0, 126, '{"name":"Private Shipping Name"}', '{"name":"Private Billing Name"}', now()),
  ('10000000-0000-4000-8000-00000000f102', 'CRM-STAFF-001', '10000000-0000-4000-8000-00000000d103', 'crm-read-staff-order-01', repeat('b', 64), 'paid', 'EUR', 100, 21, 5, 0, 126, '{}', '{}', now());

insert into public.order_items (
  id, order_id, product_name, product_sku, variant_title, quantity, unit_price, currency
)
values ('10000000-0000-4000-8000-00000000f201', '10000000-0000-4000-8000-00000000f101', 'Equipo snapshot', 'CRM-SKU-1', '16 GB', 1, 126, 'EUR');

insert into public.payment_transactions (
  id, order_id, provider, provider_reference, status, amount, currency, processed_at
)
values ('10000000-0000-4000-8000-00000000f301', '10000000-0000-4000-8000-00000000f101', 'demo', 'crm-private-reference', 'paid', 126, 'EUR', now());

insert into public.order_events (order_id, event_key, note, details)
values ('10000000-0000-4000-8000-00000000f101', 'order_picking_started', 'Picking iniciado; pago y reservas verificados.', '{"stage":"picking"}');

insert into public.return_requests (id, return_number, order_id, customer_id, status, reason)
values ('10000000-0000-4000-8000-00000000f401', 'CRM-RMA-001', '10000000-0000-4000-8000-00000000f101', '10000000-0000-4000-8000-00000000d101', 'requested', 'El producto llegó con daños.');

select ok(has_function_privilege('authenticated', 'public.crm_customer_directory(text,integer,integer)', 'EXECUTE'), 'Authenticated users can call the guarded customer CRM RPC');
select ok(not has_function_privilege('anon', 'public.crm_customer_directory(text,integer,integer)', 'EXECUTE'), 'Anonymous users cannot call the customer CRM RPC');
select ok(has_function_privilege('authenticated', 'public.crm_orders(uuid,text,text,text,text,text,integer,integer)', 'EXECUTE'), 'Authenticated users can call the guarded order CRM RPC');
select ok(not has_function_privilege('anon', 'public.crm_orders(uuid,text,text,text,text,text,integer,integer)', 'EXECUTE'), 'Anonymous users cannot call the order CRM RPC');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.crm_orders(null::uuid, null::text, null::text, null::text, null::text, null::text, 50, 0)$$, '42501', null, 'Anonymous requests cannot read CRM orders');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-00000000d101', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-00000000d101","role":"authenticated"}', true);
select throws_ok($$select * from public.crm_orders(null::uuid, null::text, null::text, null::text, null::text, null::text, 50, 0)$$, '42501', null, 'Customers cannot call the sales CRM order directory');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-00000000d104', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-00000000d104","role":"authenticated"}', true);
select throws_ok($$select * from public.crm_customer_directory(null, 50, 0)$$, '42501', null, 'Support does not receive the CRM customer directory permission');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-00000000d103', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-00000000d103","role":"authenticated"}', true);
select is((select count(*)::int from public.orders where id = '10000000-0000-4000-8000-00000000f101'), 0, 'Sales does not receive direct RLS access to customer orders');
select is((select count(*)::int from public.payment_transactions where id = '10000000-0000-4000-8000-00000000f301'), 0, 'Sales does not receive direct RLS access to payment transactions');
select is((select count(*)::int from public.crm_customer_directory('crm-customer-a@nodria.test', 50, 0)), 1, 'Sales can search the customer directory by email');
select is((select count(*)::int from public.crm_customer_directory('crm-sales@nodria.test', 50, 0)), 0, 'Staff profiles are excluded from the customer directory');
select is((select count(*)::int from public.crm_orders('10000000-0000-4000-8000-00000000d101', null, 'processing', 'paid', 'picking', 'requested', 50, 0)), 1, 'Order, payment, fulfillment, and return filters work together independently');
select is((select count(*)::int from public.crm_orders(null, 'CRM-SKU-1', null, null, null, null, 50, 0)), 1, 'Order search includes snapshot product SKU');
select is((select count(*)::int from public.crm_orders(null, 'CRM-STAFF-001', null, null, null, null, 50, 0)), 0, 'Sales cannot enumerate staff orders through CRM search');
select throws_ok($$select * from public.crm_orders(null, null, 'invalid', null, null, null, 50, 0)$$, '22023', null, 'Invalid order status filters are rejected');
select is((select order_count::int from public.crm_customer_profile('10000000-0000-4000-8000-00000000d101')), 1, 'Customer profile includes its order count');
select is((select count(*)::int from public.crm_customer_profile('10000000-0000-4000-8000-00000000d103')), 0, 'Staff profiles cannot be opened as customer records');
select is((select fulfillment_status from public.crm_order_detail('10000000-0000-4000-8000-00000000f101')), 'picking', 'Order detail derives current fulfillment status from its event timeline');
select is((select payment_status from public.crm_order_detail('10000000-0000-4000-8000-00000000f101')), 'paid', 'Order detail reports the latest payment state separately');
select is((select return_status from public.crm_order_detail('10000000-0000-4000-8000-00000000f101')), 'requested', 'Order detail reports the latest return state separately');
select is((select items->0->>'sku' from public.crm_order_detail('10000000-0000-4000-8000-00000000f101')), 'CRM-SKU-1', 'Order detail returns historical line snapshots');
select ok(not (select to_jsonb(detail) ?| array['shipping_address', 'billing_address', 'provider_reference'] from public.crm_order_detail('10000000-0000-4000-8000-00000000f101') detail), 'CRM order detail omits private addresses and payment provider references');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-00000000d105', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-00000000d105","role":"authenticated"}', true);
select is((select count(*)::int from public.crm_orders(null, null, null, null, null, null, 50, 0)), 1, 'Superadmin can use the CRM order read model');

select * from finish();
rollback;
