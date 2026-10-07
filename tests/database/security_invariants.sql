-- Run after a clean local reset with:
-- pnpm dlx supabase@latest test db --local tests/database
create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(60);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'buyer@nodria.example', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sales@nodria.example', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'invitee@nodria.example', '', now(), '{}', '{}', now(), now());

insert into public.user_role_grants (user_id, role)
values ('10000000-0000-0000-0000-000000000002', 'sales_manager');

select ok(
  not has_table_privilege('authenticated', 'public.inventory', 'INSERT')
  and not has_table_privilege('authenticated', 'public.inventory', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.inventory', 'DELETE'),
  'authenticated cannot write inventory directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.warehouses', 'INSERT')
  and not has_table_privilege('authenticated', 'public.warehouses', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.warehouses', 'DELETE'),
  'authenticated cannot write warehouses directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_transactions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.payment_transactions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.payment_transactions', 'DELETE'),
  'authenticated cannot write payment transactions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.inventory_reservations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.inventory_reservations', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.inventory_reservations', 'DELETE'),
  'authenticated cannot mutate the reservation ledger directly'
);
select ok(
  not has_table_privilege('service_role', 'public.inventory', 'UPDATE')
  and not has_table_privilege('service_role', 'public.payment_transactions', 'UPDATE')
  and not has_table_privilege('service_role', 'public.inventory_reservations', 'UPDATE')
  and not has_table_privilege('service_role', 'public.organization_memberships', 'INSERT'),
  'service_role uses RPCs for protected stock, payment, and membership transitions'
);
select ok(
  not has_function_privilege('authenticated', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE'),
  'authenticated cannot choose a payment outcome'
);
select ok(
  has_function_privilege('service_role', 'public.resolve_demo_payment(uuid,text,text)', 'EXECUTE'),
  'the server role can resolve a demo payment'
);
select ok(
  not has_column_privilege('anon', 'public.crm_leads', 'source', 'INSERT')
  and not has_column_privilege('authenticated', 'public.crm_leads', 'created_at', 'INSERT'),
  'public lead submissions cannot set attribution or timestamps'
);
select ok(
  not has_table_privilege('authenticated', 'public.return_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.return_items', 'INSERT'),
  'return creation is restricted to the request RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.create_organization(text,text,text,text,text)', 'EXECUTE'),
  'authenticated can create an organization through its atomic RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.request_return(uuid,text,jsonb)', 'EXECUTE'),
  'authenticated can request a return through its bounded RPC'
);

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.create_organization('security-test-org', 'Empresa de Prueba SL', 'Empresa de Prueba', null, 'contacto@nodria.example')$$,
  'organization and first owner are created in one transaction'
);
reset role;

select is(
  (select m.role::text from public.organization_memberships m join public.organizations o on o.id = m.organization_id where o.slug = 'security-test-org' and m.user_id = '10000000-0000-0000-0000-000000000001'),
  'owner',
  'the creator is the organization owner'
);
select is(
  (select m.added_by from public.organization_memberships m join public.organizations o on o.id = m.organization_id where o.slug = 'security-test-org' and m.user_id = '10000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the owner assignment records the authenticated actor'
);
select throws_ok(
  $$insert into public.organization_memberships (organization_id, user_id, role, added_by)
    select o.id, '10000000-0000-0000-0000-000000000003', 'owner', '10000000-0000-0000-0000-000000000001'
    from public.organizations o where o.slug = 'security-test-org'$$,
  '23505', null, 'database permits at most one owner per organization'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'INSERT'),
  'organizations cannot be created without their owner'
);

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$insert into public.organization_memberships (organization_id, user_id, role, added_by)
    select o.id, '10000000-0000-0000-0000-000000000003', 'owner', '10000000-0000-0000-0000-000000000002'
    from public.organizations o where o.slug = 'security-test-org'$$,
  '42501', null, 'sales manager cannot assign an owner'
);
select lives_ok(
  $$delete from public.organization_memberships m using public.organizations o
    where o.id = m.organization_id and o.slug = 'security-test-org' and m.role = 'owner'$$,
  'sales manager owner deletion attempt is rejected by row security'
);
reset role;
select is(
  (select count(*)::integer from public.organization_memberships m join public.organizations o on o.id = m.organization_id where o.slug = 'security-test-org' and m.role = 'owner'),
  1,
  'sales manager cannot remove the owner membership'
);

set local role anon;
select throws_ok(
  $$insert into public.crm_leads (contact_name, email, message, consent_to_contact, source)
    values ('Lead Falso', 'lead.source@nodria.example', 'Solicitud válida de prueba.', true, 'forged')$$,
  '42501', null, 'anonymous caller cannot forge lead source'
);
select throws_ok(
  $$insert into public.crm_leads (contact_name, email, message, consent_to_contact, created_at)
    values ('Lead Falso', 'lead.date@nodria.example', 'Solicitud válida de prueba.', true, '2000-01-01'::timestamptz)$$,
  '42501', null, 'anonymous caller cannot forge lead timestamp'
);
select lives_ok(
  $$insert into public.crm_leads (contact_name, email, company, message, consent_to_contact)
    values ('Lead de Prueba', 'lead.test@nodria.example', 'Estudio de Prueba', 'Solicitud de información comercial de prueba.', true)$$,
  'anonymous lead can submit the approved contact fields'
);
reset role;
select is(
  (select source from public.crm_leads where email = 'lead.test@nodria.example'),
  'website',
  'lead source comes from the database default'
);
select ok(
  (select created_at between now() - interval '1 minute' and now() from public.crm_leads where email = 'lead.test@nodria.example'),
  'lead timestamp is assigned by the database'
);

insert into public.carts (id, user_id, status, currency)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active', 'EUR');
insert into public.cart_items (cart_id, variant_id, quantity)
select '20000000-0000-0000-0000-000000000001', v.id, 2
from public.product_variants v where v.sku = 'NOD-ARC-2T';

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select * from public.place_order(
    '20000000-0000-0000-0000-000000000001', 'pgtest-checkout-approved-1',
    '{"name":"Cliente de Prueba","street":"Calle de Prueba 1","postal_code":"28001","city":"Madrid","country_code":"ES"}'::jsonb,
    '{"name":"Cliente de Prueba","street":"Calle de Prueba 1","postal_code":"28001","city":"Madrid","country_code":"ES"}'::jsonb
  )$$,
  'authenticated checkout creates the order and reservation atomically'
);
select throws_ok(
  $$update public.payment_transactions set status = 'paid'
    where order_id = (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1')$$,
  '42501', null, 'customer cannot mark a payment paid directly'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
  'pending_payment',
  'checkout order begins in pending payment'
);
set local role service_role;
select throws_ok(
  $$select public.adjust_inventory(
    (select id from public.warehouses where code = 'MAD-CENTRAL'),
    (select id from public.product_variants where sku = 'NOD-ARC-2T'),
    -100, 'Ajuste de prueba'
  )$$,
  '23514', null, 'inventory adjustment cannot consume reserved units'
);
reset role;
select ok(
  (select i.on_hand = 47 and i.reserved = 2
    from public.inventory i join public.product_variants v on v.id = i.variant_id
    where v.sku = 'NOD-ARC-2T' and i.warehouse_id = (select id from public.warehouses where code = 'MAD-CENTRAL')),
  'a rejected adjustment leaves physical and reserved stock unchanged'
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
  'reserved stock matches the active reservation ledger after checkout'
);

set local role service_role;
select lives_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
    'approved', 'pgtest-payment-approved-001'
  )$$,
  'server can atomically approve the demo payment'
);
reset role;
select is(
  (select pt.status::text from public.payment_transactions pt join public.orders o on o.id = pt.order_id where o.idempotency_key = 'pgtest-checkout-approved-1'),
  'paid',
  'payment is marked paid only through the outcome RPC'
);
select is(
  (select status::text from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
  'paid',
  'payment approval advances the order in the same transaction'
);
select is(
  (select sum(ir.quantity)::integer from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'pgtest-checkout-approved-1' and ir.released_at is null and ir.fulfilled_at is null),
  2,
  'approved order keeps its stock reserved until fulfillment'
);
set local role service_role;
select lives_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
    'approved', 'pgtest-payment-approved-001'
  )$$,
  'replaying the same payment event is idempotent'
);
reset role;
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'pgtest-checkout-approved-1' and e.event_key = 'payment_paid'),
  1,
  'payment replay does not duplicate the order event'
);

set local role service_role;
select lives_ok(
  $$select public.fulfill_order((select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'))$$,
  'server fulfillment consumes the reservation'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
  'shipped',
  'fulfillment advances the paid order to shipped'
);
select is(
  (select i.on_hand from public.inventory i join public.product_variants v on v.id = i.variant_id where v.sku = 'NOD-ARC-2T' and i.warehouse_id = (select id from public.warehouses where code = 'MAD-CENTRAL')),
  45,
  'fulfillment decrements physical stock'
);
select is(
  (select i.reserved from public.inventory i join public.product_variants v on v.id = i.variant_id where v.sku = 'NOD-ARC-2T' and i.warehouse_id = (select id from public.warehouses where code = 'MAD-CENTRAL')),
  0,
  'fulfillment clears reserved stock'
);
select ok(
  (select count(*) = 1 from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'pgtest-checkout-approved-1' and ir.fulfilled_at is not null and ir.released_at is null),
  'fulfilled reservation remains in the immutable ledger'
);
select is(
  (select quantity_delta from public.inventory_movements im join public.orders o on o.id = im.order_id where o.idempotency_key = 'pgtest-checkout-approved-1'),
  -2,
  'fulfillment records its stock movement'
);
set local role service_role;
select lives_ok(
  $$select public.fulfill_order((select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'))$$,
  'replaying fulfillment is idempotent'
);
reset role;
select is(
  (select count(*)::integer from public.inventory_movements im join public.orders o on o.id = im.order_id where o.idempotency_key = 'pgtest-checkout-approved-1' and im.movement_type = 'sale'),
  1,
  'fulfillment replay does not duplicate the stock movement'
);

set local role service_role;
select lives_ok(
  $$select public.mark_order_delivered((select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'))$$,
  'server records delivery after shipment'
);
reset role;
select ok(
  (select status = 'delivered' and delivered_at is not null from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
  'delivery timestamp is stored with delivered status'
);
set local role service_role;
select lives_ok(
  $$select public.mark_order_delivered((select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'))$$,
  'replaying delivery confirmation is idempotent'
);
reset role;
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'pgtest-checkout-approved-1' and e.event_key = 'order_delivered'),
  1,
  'delivery replay does not duplicate the order event'
);

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select public.request_return(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
    'El producto de prueba llegó con una incidencia visible.',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order_item_id', (select oi.id from public.order_items oi join public.orders o on o.id = oi.order_id where o.idempotency_key = 'pgtest-checkout-approved-1'),
      'quantity', 2
    ))
  )$$,
  'customer can request the purchased quantity within 30 days of delivery'
);
select throws_ok(
  $$select public.request_return(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
    'Intento de superar las unidades compradas.',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order_item_id', (select oi.id from public.order_items oi join public.orders o on o.id = oi.order_id where o.idempotency_key = 'pgtest-checkout-approved-1'),
      'quantity', 1
    ))
  )$$,
  '23514', null, 'a second request cannot claim more than the purchased quantity'
);
reset role;
select is(
  (select sum(ri.quantity)::integer from public.return_items ri join public.return_requests rr on rr.id = ri.return_request_id join public.orders o on o.id = rr.order_id where o.idempotency_key = 'pgtest-checkout-approved-1'),
  2,
  'the failed overclaim leaves no partial return request'
);

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select public.request_return(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1'),
    'Otro usuario no debe reclamar este pedido.',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'order_item_id', (select oi.id from public.order_items oi join public.orders o on o.id = oi.order_id where o.idempotency_key = 'pgtest-checkout-approved-1'),
      'quantity', 1
    ))
  )$$,
  'P0002', null, 'a different customer cannot request a return for this order'
);
reset role;

set local role service_role;
select throws_ok(
  $$update public.return_requests set status = 'refunded'
    where order_id = (select id from public.orders where idempotency_key = 'pgtest-checkout-approved-1')$$,
  '23514', null, 'return status must follow the declared transition sequence'
);
reset role;

insert into public.carts (id, user_id, status, currency)
values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'active', 'EUR');
insert into public.cart_items (cart_id, variant_id, quantity)
select '20000000-0000-0000-0000-000000000002', v.id, 1
from public.product_variants v where v.sku = 'NOD-ARC-2T';

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select * from public.place_order(
    '20000000-0000-0000-0000-000000000002', 'pgtest-checkout-failed-2',
    '{"name":"Cliente de Prueba","street":"Calle de Prueba 1","postal_code":"28001","city":"Madrid","country_code":"ES"}'::jsonb,
    '{"name":"Cliente de Prueba","street":"Calle de Prueba 1","postal_code":"28001","city":"Madrid","country_code":"ES"}'::jsonb
  )$$,
  'a second checkout creates a fresh pending reservation'
);
reset role;

set local role service_role;
select lives_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-failed-2'),
    'failed', 'pgtest-payment-failed-002'
  )$$,
  'server can fail a demo payment and release stock atomically'
);
select lives_ok(
  $$select public.resolve_demo_payment(
    (select id from public.orders where idempotency_key = 'pgtest-checkout-failed-2'),
    'failed', 'pgtest-payment-failed-002'
  )$$,
  'replaying a failed payment event is idempotent'
);
reset role;
select is(
  (select status::text from public.orders where idempotency_key = 'pgtest-checkout-failed-2'),
  'cancelled',
  'failed payment cancels the unpaid order'
);
select ok(
  (select count(*) = 1 from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.idempotency_key = 'pgtest-checkout-failed-2' and ir.released_at is not null and ir.fulfilled_at is null),
  'failed payment keeps a released reservation record'
);
select is(
  (select count(*)::integer from public.order_events e join public.orders o on o.id = e.order_id where o.idempotency_key = 'pgtest-checkout-failed-2' and e.event_key = 'payment_failed'),
  1,
  'failed payment replay does not duplicate the order event'
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
  'inventory reserved counts reconcile with the active reservation ledger'
);

select * from finish();
rollback;
