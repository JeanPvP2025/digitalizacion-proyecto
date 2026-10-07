\set ON_ERROR_STOP on
-- Real PostgreSQL authorization, idempotency and ledger test for the
-- warehouse disposition of approved returned units. All fixtures roll back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-00000000a401', 'authenticated', 'authenticated', 'return-inspection-customer@nodria.test', '', '{}', '{}'),
  ('10000000-0000-4000-8000-00000000a402', 'authenticated', 'authenticated', 'return-inspection-support@nodria.test', '', '{}', '{}'),
  ('10000000-0000-4000-8000-00000000a403', 'authenticated', 'authenticated', 'return-inspection-warehouse@nodria.test', '', '{}', '{}');

insert into public.user_role_grants (user_id, role, granted_by) values
  ('10000000-0000-4000-8000-00000000a402', 'support_agent', '10000000-0000-4000-8000-00000000a402'),
  ('10000000-0000-4000-8000-00000000a403', 'fulfillment_manager', '10000000-0000-4000-8000-00000000a403');

insert into public.orders (
  id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency,
  subtotal, tax_total, shipping_total, discount_total, grand_total,
  shipping_address, billing_address, delivered_at
) values (
  '10000000-0000-4000-8000-00000000b401', 'NDR-INSPECT-0001', '10000000-0000-4000-8000-00000000a401',
  'return-inspection-order', repeat(md5('return-inspection-order'), 2), 'delivered', 'EUR',
  100, 0, 0, 0, 100, '{}', '{}', now() - interval '2 days'
);

insert into public.order_items (id, order_id, variant_id, product_name, product_sku, variant_title, quantity, unit_price, currency)
select '10000000-0000-4000-8000-00000000c401', '10000000-0000-4000-8000-00000000b401', v.id,
  'FluxBook para inspección', v.sku, v.title, 1, 50, 'EUR'
from public.product_variants v where v.sku = 'NOD-FB14-PRO';
insert into public.order_items (id, order_id, variant_id, product_name, product_sku, variant_title, quantity, unit_price, currency)
select '10000000-0000-4000-8000-00000000c402', '10000000-0000-4000-8000-00000000b401', v.id,
  'Router para inspección', v.sku, v.title, 2, 25, 'EUR'
from public.product_variants v where v.sku = 'NOD-LMX7-PRO';

insert into public.payment_transactions (id, order_id, provider, provider_reference, status, amount, currency, processed_at)
values ('10000000-0000-4000-8000-00000000e401', '10000000-0000-4000-8000-00000000b401', 'demo', 'return-inspection-paid', 'paid', 100, 'EUR', now());
insert into public.return_requests (
  id, return_number, order_id, customer_id, status, reason, idempotency_key, request_fingerprint
) values (
  '10000000-0000-4000-8000-00000000f401', 'RET-INSPECT-0001',
  '10000000-0000-4000-8000-00000000b401', '10000000-0000-4000-8000-00000000a401',
  'requested', 'El producto presenta daños tras la entrega.',
  '10000000-0000-4000-8000-00000000e402', repeat(md5('return-inspection-request'), 2)
);
insert into public.return_items (id, return_request_id, order_item_id, quantity)
values
  ('10000000-0000-4000-8000-00000000d401', '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000c401', 1),
  ('10000000-0000-4000-8000-00000000d402', '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000c402', 2);

create temporary table nodria_inspection_baseline on commit drop as
select v.sku, i.on_hand
from public.inventory i
join public.warehouses w on w.id = i.warehouse_id and w.code = 'MAD-CENTRAL'
join public.product_variants v on v.id = i.variant_id
where v.sku in ('NOD-FB14-PRO', 'NOD-LMX7-PRO');
grant select on pg_temp.nodria_inspection_baseline to authenticated;

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a402';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a402","role":"authenticated"}';
set local role authenticated;
select * from public.review_return_request(
  '10000000-0000-4000-8000-00000000f401', 'approved', 'Recepción autorizada; almacén comprobará el estado físico.',
  '10000000-0000-4000-8000-00000000e403'
);

do $$
begin
  if has_table_privilege('authenticated', 'public.return_items', 'UPDATE') then
    raise exception 'Warehouse inspection must not allow direct return item updates';
  end if;
  begin
    perform * from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      (select id from public.warehouses where code = 'MAD-CENTRAL'), 'restocked', 1,
      'Unidad comprobada', '10000000-0000-4000-8000-00000000e404'
    );
    raise exception 'Support role inspected physical inventory';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a401';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a401","role":"authenticated"}';
set local role authenticated;
do $$
begin
  begin
    perform * from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      (select id from public.warehouses where code = 'MAD-CENTRAL'), 'restocked', 1,
      'Unidad comprobada', '10000000-0000-4000-8000-00000000e405'
    );
    raise exception 'Customer inspected physical inventory';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-00000000a403';
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-00000000a403","role":"authenticated"}';
set local role authenticated;
do $$
declare
  v_warehouse uuid := (select id from public.warehouses where code = 'MAD-CENTRAL');
  v_movement bigint;
  v_qty integer;
  v_disposition text;
  v_replayed boolean;
  v_count integer;
begin
  begin
    perform * from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      v_warehouse, 'restocked', 2, 'Cantidad alterada por el navegador', '10000000-0000-4000-8000-00000000e406'
    );
    raise exception 'Inspection accepted more units than the approved quantity';
  exception when check_violation then null;
  end;

  select inventory_movement_id, quantity, replayed into v_movement, v_qty, v_replayed
    from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      v_warehouse, 'restocked', 1, 'Unidad comprobada y apta para volver a venta.', '10000000-0000-4000-8000-00000000e407'
    );
  if v_movement is null or v_qty <> 1 or v_replayed then
    raise exception 'Restock did not create its first inventory movement';
  end if;

  select inventory_movement_id, replayed into v_movement, v_replayed
    from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      v_warehouse, 'restocked', 1, 'Unidad comprobada y apta para volver a venta.', '10000000-0000-4000-8000-00000000e407'
    );
  if v_movement is null or not v_replayed then raise exception 'Same inspection retry did not replay'; end if;
  begin
    perform * from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      v_warehouse, 'restocked', 1, 'Payload distinto bajo la misma clave de inspección.', '10000000-0000-4000-8000-00000000e407'
    );
    raise exception 'Different inspection payload reused an idempotency key';
  exception when unique_violation then null;
  end;
  begin
    perform * from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
      v_warehouse, 'disposed', 1, 'No se permite la segunda disposición.', '10000000-0000-4000-8000-00000000e408'
    );
    raise exception 'A return item received a second inspection under another key';
  exception when unique_violation then null;
  end;

  select inventory_movement_id, disposition, quantity into v_movement, v_disposition, v_qty
    from public.inspect_return_item(
      '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d402',
      v_warehouse, 'disposed', 2, 'Carcasa rota; conectores deformados y sin reparación segura.', '10000000-0000-4000-8000-00000000e409'
    );
  if v_movement is not null or v_disposition <> 'disposed' or v_qty <> 2 then
    raise exception 'Discard should be recorded without adding stock';
  end if;

  select count(*) into v_count from public.inventory_movements
    where return_request_id = '10000000-0000-4000-8000-00000000f401' and movement_type = 'return_restock';
  if v_count <> 1 then raise exception 'Restock did not create exactly one ledger row'; end if;
  select count(*) into v_count from public.return_request_events
    where return_request_id = '10000000-0000-4000-8000-00000000f401' and event_type = 'inspection_completed';
  if v_count <> 2 then raise exception 'Inspection timeline is missing a disposition'; end if;
  if not exists (select 1 from public.return_items where id = '10000000-0000-4000-8000-00000000d401' and inventory_disposition = 'restocked')
     or not exists (select 1 from public.return_items where id = '10000000-0000-4000-8000-00000000d402' and inventory_disposition = 'disposed') then
    raise exception 'Return item dispositions were not persisted';
  end if;
  if (select status from public.return_requests where id = '10000000-0000-4000-8000-00000000f401') <> 'closed' then
    raise exception 'Return request did not close after every line was inspected';
  end if;
  if not exists (
    select 1 from public.return_request_events
    where return_request_id = '10000000-0000-4000-8000-00000000f401'
      and event_type = 'status_changed' and from_status = 'approved' and to_status = 'closed'
  ) then
    raise exception 'Return closure was not added to the customer timeline';
  end if;
  select replayed into v_replayed from public.inspect_return_item(
    '10000000-0000-4000-8000-00000000f401', '10000000-0000-4000-8000-00000000d401',
    v_warehouse, 'restocked', 1, 'Unidad comprobada y apta para volver a venta.', '10000000-0000-4000-8000-00000000e407'
  );
  if not v_replayed then raise exception 'Same-key retry did not replay after return closure'; end if;
  if (select on_hand from public.inventory i join public.warehouses w on w.id = i.warehouse_id join public.product_variants v on v.id = i.variant_id where w.code = 'MAD-CENTRAL' and v.sku = 'NOD-FB14-PRO')
     <> (select on_hand + 1 from nodria_inspection_baseline where sku = 'NOD-FB14-PRO') then
    raise exception 'Restock did not add exactly the inspected units';
  end if;
  if (select on_hand from public.inventory i join public.warehouses w on w.id = i.warehouse_id join public.product_variants v on v.id = i.variant_id where w.code = 'MAD-CENTRAL' and v.sku = 'NOD-LMX7-PRO')
     <> (select on_hand from nodria_inspection_baseline where sku = 'NOD-LMX7-PRO') then
    raise exception 'Disposed units changed available stock';
  end if;
end;
$$;

reset role;
rollback;
select 'NODRIA PostgreSQL warehouse return inspection and disposition gate passed' as result;
