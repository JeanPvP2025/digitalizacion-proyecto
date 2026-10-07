\set ON_ERROR_STOP on
create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(35);

select ok(
  has_function_privilege('service_role', 'public.start_order_picking(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.start_order_picking(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.start_order_picking(uuid,uuid)', 'EXECUTE'),
  'picking RPC is callable only through the server service role'
);
select ok(
  has_function_privilege('service_role', 'public.pack_order(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.pack_order(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pack_order(uuid,uuid)', 'EXECUTE'),
  'packing RPC is callable only through the server service role'
);
select ok(
  has_function_privilege('service_role', 'public.dispatch_order(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.dispatch_order(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.dispatch_order(uuid,uuid)', 'EXECUTE'),
  'dispatch RPC is callable only through the server service role'
);
select ok(
  has_function_privilege('service_role', 'public.confirm_order_delivery(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.confirm_order_delivery(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.confirm_order_delivery(uuid,uuid)', 'EXECUTE'),
  'delivery confirmation RPC is callable only through the server service role'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('94000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'fulfillment-buyer@nodria.test', '', now(), '{}', '{}', now(), now()),
  ('94000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'fulfillment-warehouse@nodria.test', '', now(), '{}', '{}', now(), now()),
  ('94000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'fulfillment-sales@nodria.test', '', now(), '{}', '{}', now(), now()),
  ('94000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'fulfillment-buyer-2@nodria.test', '', now(), '{}', '{}', now(), now());

insert into public.user_role_grants (user_id, role)
values
  ('94000000-0000-4000-8000-000000000002', 'fulfillment_manager'),
  ('94000000-0000-4000-8000-000000000003', 'sales_manager');

insert into public.carts (id, user_id, status, currency)
values
  ('94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000001', 'active', 'EUR'),
  ('94000000-0000-4000-8000-000000000102', '94000000-0000-4000-8000-000000000004', 'active', 'EUR');

set local "request.jwt.claim.sub" = '94000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" = '{"sub":"94000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select * from public.place_order_from_checkout(
    '94000000-0000-4000-8000-000000000101', 'fulfillment-workflow-order-001',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 2)),
    '{"fullName":"Cliente QA","email":"qa@nodria.test","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.test","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  'a fulfillment order is created with stock reservations'
);
set local "request.jwt.claim.sub" = '94000000-0000-4000-8000-000000000004';
set local "request.jwt.claims" = '{"sub":"94000000-0000-4000-8000-000000000004","role":"authenticated"}';
select lives_ok(
  $$select * from public.place_order_from_checkout(
    '94000000-0000-4000-8000-000000000102', 'fulfillment-workflow-order-002',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 1)),
    '{"fullName":"Cliente QA","email":"qa@nodria.test","address":"Calle de Prueba 2","postalCode":"28001","city":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.test","address":"Calle de Prueba 2","postalCode":"28001","city":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  'a second order is created for reservation-coherence checks'
);
reset role;

set local role service_role;
select throws_ok(
  $$select public.start_order_picking((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000003')$$,
  '42501', null,
  'a sales role cannot act as a fulfillment actor'
);
select throws_ok(
  $$select public.start_order_picking((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'picking rejects an order before payment is confirmed'
);
select public.resolve_demo_payment(
  (select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'),
  'approved', 'fulfillment-workflow-payment-001'
);
reset role;

-- Simulate a broken reservation ledger before an order becomes paid. The database
-- trigger keeps the aggregate inventory balance aligned, but fulfillment must refuse it.
update public.inventory_reservations ir
set released_at = now()
from public.order_items oi
where oi.id = ir.order_item_id
  and oi.order_id = (select id from public.orders where idempotency_key = 'fulfillment-workflow-order-002')
  and ir.released_at is null and ir.fulfilled_at is null;
set local role service_role;
select public.resolve_demo_payment(
  (select id from public.orders where idempotency_key = 'fulfillment-workflow-order-002'),
  'approved', 'fulfillment-workflow-payment-002'
);
select throws_ok(
  $$select public.start_order_picking((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-002'), '94000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'picking rejects a paid order whose active reservation no longer covers its item quantity'
);
select throws_ok(
  $$select public.dispatch_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-002'), '94000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'dispatch rejects a paid order without coherent active reservations'
);
reset role;

set local role service_role;
select throws_ok(
  $$select public.pack_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'packing cannot skip the picking stage'
);
select throws_ok(
  $$select public.dispatch_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'dispatch cannot skip picking and packing'
);
select is(
  public.start_order_picking((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'picking',
  'paid and reserved order enters picking'
);
select is(
  public.start_order_picking((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'picking',
  'picking retry returns the prior stage without a duplicate transition'
);
select throws_ok(
  $$select public.dispatch_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002')$$,
  '23514', null,
  'a picked order cannot dispatch until it has been packed'
);
select is(
  public.pack_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'packed',
  'picked order enters packing'
);
select is(
  public.pack_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'packed',
  'packing retry returns the prior stage without a duplicate transition'
);
select is(
  public.dispatch_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'shipped'::public.order_status,
  'packed order dispatches through the reservation-consuming fulfillment RPC'
);
select is(
  public.dispatch_order((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'shipped'::public.order_status,
  'dispatch retry returns shipped without consuming stock again'
);
reset role;

select is(
  (select status::text from public.orders where idempotency_key = 'fulfillment-workflow-order-001'),
  'shipped',
  'dispatch persists the shipped order state'
);
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_picking_started'),
  1,
  'picking retry leaves one timeline event'
);
select is(
  (select actor_user_id from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_picking_started'),
  '94000000-0000-4000-8000-000000000002'::uuid,
  'picking event records the authorized warehouse actor'
);
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_packed'),
  1,
  'packing retry leaves one timeline event'
);
select is(
  (select actor_user_id from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_packed'),
  '94000000-0000-4000-8000-000000000002'::uuid,
  'packing event records the authorized warehouse actor'
);
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_shipped'),
  1,
  'dispatch retry leaves one timeline event'
);
select is(
  (select actor_user_id from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_shipped'),
  '94000000-0000-4000-8000-000000000002'::uuid,
  'dispatch event records the authorized warehouse actor'
);
select is(
  (select count(*)::integer from public.inventory_movements im join public.orders o on o.id = im.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and im.movement_type = 'sale'),
  1,
  'dispatch retry does not duplicate the sale movement'
);
select ok(
  not exists (
    select 1 from public.inventory i join public.product_variants v on v.id = i.variant_id
    where v.sku = 'NOD-ARC-2T'
      and i.reserved <> coalesce((
        select sum(ir.quantity) from public.inventory_reservations ir
        where ir.warehouse_id = i.warehouse_id and ir.variant_id = i.variant_id
          and ir.released_at is null and ir.fulfilled_at is null
      ), 0)
  ),
  'dispatch preserves the reservation ledger balance'
);

set local role service_role;
select is(
  public.confirm_order_delivery((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'delivered'::public.order_status,
  'shipped order accepts an actor-attributed delivery confirmation'
);
select is(
  public.confirm_order_delivery((select id from public.orders where idempotency_key = 'fulfillment-workflow-order-001'), '94000000-0000-4000-8000-000000000002'),
  'delivered'::public.order_status,
  'delivery confirmation retry is idempotent'
);
reset role;
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_delivered'),
  1,
  'delivery confirmation retry leaves one timeline event'
);
select is(
  (select actor_user_id from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-001' and e.event_key = 'order_delivered'),
  '94000000-0000-4000-8000-000000000002'::uuid,
  'delivery event records the authorized warehouse actor'
);

select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'fulfillment-workflow-order-002' and e.event_key in ('order_picking_started', 'order_packed', 'order_shipped')),
  0,
  'an order with released reservations receives no fulfillment stage events'
);
select is(
  (select status::text from public.orders where idempotency_key = 'fulfillment-workflow-order-002'),
  'paid',
  'a rejected fulfillment transition leaves the paid order unchanged'
);
select is(
  (select count(*)::integer from public.inventory_movements im join public.orders o on o.id = im.order_id where o.idempotency_key = 'fulfillment-workflow-order-002' and im.movement_type = 'sale'),
  0,
  'a rejected fulfillment transition does not consume stock'
);

select * from finish();
rollback;
