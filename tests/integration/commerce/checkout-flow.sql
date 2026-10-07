-- Run after `pnpm dlx supabase@latest db reset` with:
-- pnpm dlx supabase@latest test db --local tests/integration/commerce/checkout-flow.sql
create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(40);

select ok(
  not has_function_privilege('authenticated', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE'),
  'customers cannot choose payment outcomes directly through the Data API'
);
select ok(
  has_function_privilege('service_role', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE'),
  'the server-only payment client can call the restricted outcome RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.place_order_from_checkout(uuid,text,jsonb,jsonb,jsonb)', 'EXECUTE'),
  'authenticated checkout can submit cart lines through the atomic checkout RPC'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'checkout-flow@nodria.example', '', now(), '{}', '{}', now(), now()
);

insert into public.carts (id, user_id, status, currency)
values ('90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000001', 'active', 'EUR');

set local "request.jwt.claim.sub" = '90000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000101', 'checkout-flow-address-invalid',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 2)),
    '{"fullName":"Cliente QA"}'::jsonb,
    '{"fullName":"Cliente QA","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  '22023', null,
  'checkout requires a minimum complete shipping and billing address'
);
select lives_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000101', 'checkout-flow-order-001',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 2)),
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  'checkout creates an order from a complete persisted cart and address'
);
reset role;
select is(
  (select count(*)::integer from public.orders where customer_id = '90000000-0000-0000-0000-000000000001' and idempotency_key = 'checkout-flow-order-001'),
  1,
  'first checkout creates one order'
);

set local role authenticated;
select lives_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000101', 'checkout-flow-order-001',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 2)),
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  'same key, cart, and address replay the existing order'
);
reset role;
select is(
  (select count(*)::integer from public.orders where customer_id = '90000000-0000-0000-0000-000000000001' and idempotency_key = 'checkout-flow-order-001'),
  1,
  'same-payload replay does not create a second order'
);

set local role authenticated;
select throws_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000101', 'checkout-flow-order-001',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 2)),
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Avenida Diferente 22","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Avenida Diferente 22","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  '23505', null,
  'same idempotency key rejects a changed address fingerprint'
);
reset role;

insert into public.carts (id, user_id, status, currency)
values ('90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000001', 'active', 'EUR');

set local role authenticated;
select throws_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000102', 'checkout-flow-order-001',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 1)),
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  '23505', null,
  'same idempotency key rejects a different persisted line quantity'
);
reset role;
select is(
  (select count(*)::integer from public.orders where customer_id = '90000000-0000-0000-0000-000000000001' and idempotency_key = 'checkout-flow-order-001'),
  1,
  'payload mismatch leaves the original order unchanged'
);

set local role service_role;
select is(
  public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'processing', 'checkout-flow-event-processing-001'
  ),
  'pending'::public.payment_status,
  'processing outcome leaves payment pending'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'checkout-flow-order-001'),
  'pending_payment',
  'processing outcome does not advance the order'
);
select is(
  (select pt.status::text from public.payment_transactions pt join public.orders o on o.id = pt.order_id where o.idempotency_key = 'checkout-flow-order-001'),
  'pending',
  'processing outcome leaves the persisted payment pending'
);
select is(
  (select count(*)::integer from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'checkout-flow-order-001' and ir.released_at is null and ir.fulfilled_at is null),
  1,
  'processing outcome keeps the reservation active'
);

set local role service_role;
select is(
  public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'temporary_error', 'checkout-flow-event-temporary-001'
  ),
  'pending'::public.payment_status,
  'temporary error is recorded as a recoverable pending result'
);
select lives_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'processing', 'checkout-flow-event-processing-001'
  )$$,
  'replaying the same nonterminal payment event is idempotent'
);
reset role;
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'checkout-flow-order-001' and e.event_key = 'payment_processing'),
  1,
  'replaying a processing event does not duplicate its order event'
);
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'checkout-flow-order-001' and e.event_key = 'payment_temporary_error'),
  1,
  'temporary payment failure has one auditable order event'
);

set local role service_role;
select is(
  public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'approved', 'checkout-flow-event-approved-001'
  ),
  'paid'::public.payment_status,
  'approved retry atomically settles the existing pending order'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'checkout-flow-order-001'),
  'paid',
  'approved payment advances the order'
);
select is(
  (select pt.status::text from public.payment_transactions pt join public.orders o on o.id = pt.order_id where o.idempotency_key = 'checkout-flow-order-001'),
  'paid',
  'approved payment advances the matching payment transaction'
);
select is(
  (select count(*)::integer from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'checkout-flow-order-001' and ir.released_at is null and ir.fulfilled_at is null),
  1,
  'approved payment keeps the reservation active'
);
set local role service_role;
select is(
  public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'approved', 'checkout-flow-event-approved-001'
  ),
  'paid'::public.payment_status,
  'replaying the approved payment returns the settled status'
);
select throws_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'failed', 'checkout-flow-event-approved-001'
  )$$,
  '23505', null,
  'payment event key cannot be reused with a different result'
);
select throws_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-001'),
    'unsupported', 'checkout-flow-event-invalid-001'
  )$$,
  '22023', null,
  'unsupported payment outcomes fail before mutation'
);
reset role;

set local role authenticated;
select lives_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000102', 'checkout-flow-order-002',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 1)),
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  'a new idempotency key creates an independent order'
);
reset role;
set local role service_role;
select is(
  public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-002'),
    'insufficient_funds', 'checkout-flow-event-insufficient-002'
  ),
  'failed'::public.payment_status,
  'rejected payment resolves as failed'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'checkout-flow-order-002'),
  'cancelled',
  'rejected payment cancels the order'
);
select is(
  (select pt.status::text from public.payment_transactions pt join public.orders o on o.id = pt.order_id where o.idempotency_key = 'checkout-flow-order-002'),
  'failed',
  'rejected payment updates the payment transaction'
);
select is(
  (select count(*)::integer from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'checkout-flow-order-002' and ir.released_at is not null and ir.fulfilled_at is null),
  1,
  'rejected payment releases the reservation'
);
select ok(
  not exists (
    select 1 from public.inventory i
    where i.reserved <> coalesce((
      select sum(ir.quantity) from public.inventory_reservations ir
      where ir.warehouse_id = i.warehouse_id and ir.variant_id = i.variant_id
        and ir.released_at is null and ir.fulfilled_at is null
    ), 0)
  ),
  'rejected checkout keeps the inventory reservation ledger balanced'
);

insert into public.carts (id, user_id, status, currency)
values ('90000000-0000-0000-0000-000000000103', '90000000-0000-0000-0000-000000000001', 'active', 'EUR');
set local role authenticated;
select lives_ok(
  $$select * from public.place_order_from_checkout(
    '90000000-0000-0000-0000-000000000103', 'checkout-flow-order-003',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id', (select v.id from public.product_variants v where v.sku = 'NOD-ARC-2T'), 'quantity', 1)),
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb,
    '{"fullName":"Cliente QA","email":"qa@nodria.example","phone":"600000000","address":"Calle de Prueba 1","postalCode":"28001","city":"Madrid","province":"Madrid","countryCode":"ES"}'::jsonb
  )$$,
  'another order is reserved for payment failure recovery'
);
reset role;

create or replace function private.test_fail_payment_paid_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_key = 'payment_paid' then
    raise exception using errcode = 'P0001', message = 'Test-only event failure';
  end if;
  return new;
end;
$$;
create trigger test_fail_payment_paid_event
  before insert on public.order_events
  for each row execute function private.test_fail_payment_paid_event();

set local role service_role;
select throws_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-003'),
    'approved', 'checkout-flow-event-recovery-003'
  )$$,
  'P0001', null,
  'failure while recording the event rolls back the whole payment transition'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'checkout-flow-order-003'),
  'pending_payment',
  'failed payment transaction leaves the order pending for recovery'
);
select is(
  (select pt.status::text from public.payment_transactions pt join public.orders o on o.id = pt.order_id where o.idempotency_key = 'checkout-flow-order-003'),
  'pending',
  'failed payment transaction leaves payment pending for recovery'
);
select is(
  (select count(*)::integer from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'checkout-flow-order-003' and ir.released_at is null and ir.fulfilled_at is null),
  1,
  'failed payment transaction leaves its reservation active'
);
drop trigger test_fail_payment_paid_event on public.order_events;
drop function private.test_fail_payment_paid_event();

set local role service_role;
select is(
  public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'checkout-flow-order-003'),
    'approved', 'checkout-flow-event-recovery-003'
  ),
  'paid'::public.payment_status,
  'retry with the same event key succeeds after the transient failure is removed'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'checkout-flow-order-003'),
  'paid',
  'recovered order reaches paid status'
);
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'checkout-flow-order-003' and e.event_key = 'payment_paid'),
  1,
  'recovery records exactly one paid event'
);

select * from finish();
rollback;
