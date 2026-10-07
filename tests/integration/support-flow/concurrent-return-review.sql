\set ON_ERROR_STOP on
\getenv rma_db_password POSTGRES_PASSWORD
\getenv rma_db_port NODRIA_TEST_DB_PORT

-- Concurrent retry against one return: the second authenticated connection is
-- held behind the order lock, then must observe and replay the first outcome.
-- NODRIA_TEST_DB_PORT is the host-published DB port. Using host.docker.internal
-- ensures PostgreSQL verifies the explicit password rather than local trust.
create extension if not exists dblink with schema extensions;

begin;
delete from public.return_refunds where return_request_id = '10000000-0000-4000-8000-00000000f301';
delete from public.return_request_events where return_request_id = '10000000-0000-4000-8000-00000000f301';
delete from public.return_items where return_request_id = '10000000-0000-4000-8000-00000000f301';
delete from public.return_requests where id = '10000000-0000-4000-8000-00000000f301';
delete from public.payment_transactions where id = '10000000-0000-4000-8000-00000000e301';
delete from public.order_items where id = '10000000-0000-4000-8000-00000000c301';
delete from public.orders where id = '10000000-0000-4000-8000-00000000b301';
delete from public.user_role_grants where user_id = '10000000-0000-4000-8000-00000000a302';
delete from auth.users where id in ('10000000-0000-4000-8000-00000000a301', '10000000-0000-4000-8000-00000000a302');

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-00000000a301', 'authenticated', 'authenticated', 'rma-race-customer@nodria.test', '', '{}', '{}'),
  ('10000000-0000-4000-8000-00000000a302', 'authenticated', 'authenticated', 'rma-race-agent@nodria.test', '', '{}', '{}');
insert into public.user_role_grants (user_id, role, granted_by)
values ('10000000-0000-4000-8000-00000000a302', 'support_agent', '10000000-0000-4000-8000-00000000a302');
insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total, shipping_address, billing_address, delivered_at
) values (
  '10000000-0000-4000-8000-00000000b301', 'NDR-RACE-000001', '10000000-0000-4000-8000-00000000a301',
  'rma-concurrency-order', repeat(md5('rma-concurrency-order'), 2), 'delivered', 'EUR',
  100, 0, 0, 0, 100, '{}', '{}', now() - interval '1 day'
);
insert into public.order_items (id, order_id, product_name, product_sku, variant_title, quantity, unit_price, currency)
values ('10000000-0000-4000-8000-00000000c301', '10000000-0000-4000-8000-00000000b301', 'Unidad RMA concurrente', 'QA-RMA-RACE', 'Estándar', 1, 100, 'EUR');
insert into public.payment_transactions (id, order_id, provider, provider_reference, status, amount, currency, processed_at)
values ('10000000-0000-4000-8000-00000000e301', '10000000-0000-4000-8000-00000000b301', 'demo', 'rma-concurrency-paid', 'paid', 100, 'EUR', now());
insert into public.return_requests (
  id, return_number, order_id, customer_id, status, reason, idempotency_key, request_fingerprint
) values (
  '10000000-0000-4000-8000-00000000f301', 'RET-RACE-000001',
  '10000000-0000-4000-8000-00000000b301', '10000000-0000-4000-8000-00000000a301',
  'requested', 'Unidad de prueba para revisión simultánea.', '10000000-0000-4000-8000-00000000e302', repeat(md5('rma-concurrency-return'), 2)
);
insert into public.return_items (return_request_id, order_item_id, quantity)
values ('10000000-0000-4000-8000-00000000f301', '10000000-0000-4000-8000-00000000c301', 1);
commit;

select extensions.dblink_connect('rma_holder', format('host=host.docker.internal port=%s dbname=%s user=postgres password=%s', :'rma_db_port', current_database(), :'rma_db_password'));
select extensions.dblink_connect('rma_worker', format('host=host.docker.internal port=%s dbname=%s user=postgres password=%s', :'rma_db_port', current_database(), :'rma_db_password'));

select extensions.dblink_exec('rma_holder', 'set request.jwt.claim.sub = ''10000000-0000-4000-8000-00000000a302''');
select extensions.dblink_exec('rma_holder', 'set request.jwt.claims = ''{"sub":"10000000-0000-4000-8000-00000000a302","role":"authenticated"}''');
select extensions.dblink_exec('rma_worker', 'set role authenticated');
select extensions.dblink_exec('rma_worker', 'set request.jwt.claim.sub = ''10000000-0000-4000-8000-00000000a302''');
select extensions.dblink_exec('rma_worker', 'set request.jwt.claims = ''{"sub":"10000000-0000-4000-8000-00000000a302","role":"authenticated"}''');

-- Hold the same order lock that the RPC takes, then start a retry on the
-- second connection so it is demonstrably waiting before the first commits.
select extensions.dblink_exec('rma_holder', 'begin');
select id from extensions.dblink(
  'rma_holder',
  'select id from public.orders where id = ''10000000-0000-4000-8000-00000000b301'' for update'
) as locked_order(id uuid);
select extensions.dblink_exec('rma_holder', 'set role authenticated');
do $$
begin
  if extensions.dblink_send_query('rma_worker', $query$
    select * from public.review_return_request(
      '10000000-0000-4000-8000-00000000f301', 'approved', 'Aprobación concurrente de prueba.',
      '10000000-0000-4000-8000-00000000e303'
    )
  $query$) <> 1 then
    raise exception 'Could not start the concurrent RMA retry';
  end if;
  if extensions.dblink_is_busy('rma_worker') <> 1 then
    raise exception 'The concurrent RMA retry did not wait behind the order lock';
  end if;
end;
$$;

create temporary table qa_holder_result as
select * from extensions.dblink(
  'rma_holder',
  $query$
    select * from public.review_return_request(
      '10000000-0000-4000-8000-00000000f301', 'approved', 'Aprobación concurrente de prueba.',
      '10000000-0000-4000-8000-00000000e303'
    )
  $query$
) as result(return_request_id uuid, return_status public.return_status, refund_amount numeric(12,2), refund_currency text, inventory_pending_inspection_quantity integer, replayed boolean);
select extensions.dblink_exec('rma_holder', 'commit');

create temporary table qa_worker_result as
select * from extensions.dblink_get_result('rma_worker') as result(
  return_request_id uuid,
  return_status public.return_status,
  refund_amount numeric(12,2),
  refund_currency text,
  inventory_pending_inspection_quantity integer,
  replayed boolean
);

do $$
begin
  if (select count(*) from qa_holder_result where return_status = 'approved' and refund_amount = 100 and refund_currency = 'EUR' and inventory_pending_inspection_quantity = 1 and not replayed) <> 1 then
    raise exception 'The first concurrent RMA review did not record one approval';
  end if;
  if (select count(*) from qa_worker_result where return_status = 'approved' and refund_amount = 100 and refund_currency = 'EUR' and inventory_pending_inspection_quantity = 1 and replayed) <> 1 then
    raise exception 'The racing RMA retry did not replay the first approval';
  end if;
  if (select count(*) from public.return_refunds where return_request_id = '10000000-0000-4000-8000-00000000f301') <> 1 then
    raise exception 'Concurrent RMA approval created duplicate refunds';
  end if;
  if (select count(*) from public.return_request_events where return_request_id = '10000000-0000-4000-8000-00000000f301' and event_type = 'business_effects_recorded') <> 1 then
    raise exception 'Concurrent RMA approval duplicated its timeline effects';
  end if;
end;
$$;

select extensions.dblink_disconnect('rma_worker');
select extensions.dblink_disconnect('rma_holder');

begin;
delete from public.return_refunds where return_request_id = '10000000-0000-4000-8000-00000000f301';
delete from public.return_request_events where return_request_id = '10000000-0000-4000-8000-00000000f301';
delete from public.return_items where return_request_id = '10000000-0000-4000-8000-00000000f301';
delete from public.return_requests where id = '10000000-0000-4000-8000-00000000f301';
delete from public.payment_transactions where id = '10000000-0000-4000-8000-00000000e301';
delete from public.order_items where id = '10000000-0000-4000-8000-00000000c301';
delete from public.orders where id = '10000000-0000-4000-8000-00000000b301';
delete from public.user_role_grants where user_id = '10000000-0000-4000-8000-00000000a302';
delete from auth.users where id in ('10000000-0000-4000-8000-00000000a301', '10000000-0000-4000-8000-00000000a302');
commit;
