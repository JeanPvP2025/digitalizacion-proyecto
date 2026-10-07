\set ON_ERROR_STOP on

-- Run after `supabase db reset --local --yes` with the project's PostgreSQL.
-- All fixture users, purchase orders, receipts and stock movements roll back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000f401', 'authenticated', 'authenticated', 'procurement-warehouse@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000f402', 'authenticated', 'authenticated', 'procurement-sales@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000f403', 'authenticated', 'authenticated', 'procurement-buyer@nodria.test', '', '{}', '{}');

insert into public.user_role_grants (user_id, role)
values
  ('00000000-0000-4000-8000-00000000f401', 'fulfillment_manager'),
  ('00000000-0000-4000-8000-00000000f402', 'sales_manager');

insert into public.organizations (id, slug, legal_name, display_name, created_by)
values (
  '00000000-0000-4000-8000-00000000f404', 'procurement-tenant-fixture',
  'Empresa de Prueba Procurement, S.L.', 'Tenant de prueba Procurement',
  '00000000-0000-4000-8000-00000000f403'
);
insert into public.organization_memberships (organization_id, user_id, role, added_by)
values (
  '00000000-0000-4000-8000-00000000f404', '00000000-0000-4000-8000-00000000f403', 'buyer',
  '00000000-0000-4000-8000-00000000f403'
);

do $$
begin
  if has_function_privilege('anon', 'public.create_procurement_supplier(text,text,text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.create_procurement_supplier(text,text,text,text)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.purchase_orders', 'INSERT')
    or has_table_privilege('authenticated', 'public.purchase_order_receipts', 'UPDATE') then
    raise exception 'procurement grants do not follow the RPC/read-only boundary';
  end if;
end;
$$;

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000f401';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000f401","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_supplier_id uuid;
  v_order_id uuid;
  v_cancelled_order_id uuid;
  v_line_id uuid;
  v_cancelled_line_id uuid;
  v_variant_id uuid;
  v_warehouse_id uuid;
  v_before_on_hand integer;
  v_after_on_hand integer;
  v_before_reserved integer;
  v_after_reserved integer;
  v_key_first uuid := '00000000-0000-4000-8000-00000000f411';
  v_key_over uuid := '00000000-0000-4000-8000-00000000f412';
  v_key_final uuid := '00000000-0000-4000-8000-00000000f413';
  v_key_after uuid := '00000000-0000-4000-8000-00000000f414';
  v_key_cancelled uuid := '00000000-0000-4000-8000-00000000f415';
  v_result jsonb;
  v_lines jsonb;
begin
  select id into strict v_variant_id from public.product_variants where sku = 'NOD-ARC-2T';
  select id into strict v_warehouse_id from public.warehouses where code = 'MAD-CENTRAL';
  select on_hand, reserved into strict v_before_on_hand, v_before_reserved
    from public.inventory where variant_id = v_variant_id and warehouse_id = v_warehouse_id;

  select id into strict v_supplier_id from public.create_procurement_supplier(
    'Proveedor QA Procurement', 'compras@nodria.test', '+34 910 000 001', 'Proveedor ficticio de prueba'
  );
  v_result := public.create_purchase_order(v_supplier_id, v_warehouse_id, current_date + 7, 'Pedido de prueba',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variantId', v_variant_id, 'quantity', 4, 'unitCost', 71.25)));
  if v_result ->> 'success' <> 'true' then raise exception 'purchase order creation failed: %', v_result; end if;
  v_order_id := (v_result ->> 'purchaseOrderId')::uuid;
  select id into strict v_line_id from public.purchase_order_lines where purchase_order_id = v_order_id;

  v_result := public.transition_purchase_order(v_order_id, 'place');
  if v_result ->> 'status' <> 'ordered' then raise exception 'draft did not transition to ordered: %', v_result; end if;
  v_result := public.transition_purchase_order(v_order_id, 'place');
  if v_result ->> 'replayed' <> 'true' then raise exception 'repeated place transition was not idempotent: %', v_result; end if;

  v_lines := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_line_id, 'quantity', 2));
  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-001', v_key_first, v_lines);
  if v_result ->> 'success' <> 'true' or v_result ->> 'replayed' <> 'false' then
    raise exception 'first partial receipt failed: %', v_result;
  end if;
  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-001', v_key_first, v_lines);
  if v_result ->> 'success' <> 'true' or v_result ->> 'replayed' <> 'true' then
    raise exception 'same-key receipt replay failed: %', v_result;
  end if;

  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-CHANGED', v_key_first,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_line_id, 'quantity', 1)));
  if v_result ->> 'errorCode' <> 'idempotency_conflict' then
    raise exception 'same key with another payload was accepted: %', v_result;
  end if;

  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-OVER', v_key_over,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_line_id, 'quantity', 3)));
  if v_result ->> 'errorCode' <> 'quantity_exceeds_pending' then
    raise exception 'receipt over the pending quantity was accepted: %', v_result;
  end if;
  if not exists (select 1 from public.purchase_order_receipts where idempotency_key = v_key_over
      and status = 'rejected' and error_code = 'quantity_exceeds_pending') then
    raise exception 'over-receipt error was not persisted';
  end if;
  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-OVER', v_key_over,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_line_id, 'quantity', 3)));
  if v_result ->> 'errorCode' <> 'quantity_exceeds_pending' or v_result ->> 'replayed' <> 'true' then
    raise exception 'rejected receipt replay did not return persisted error: %', v_result;
  end if;

  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-002', v_key_final,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_line_id, 'quantity', 2)));
  if v_result ->> 'success' <> 'true' or v_result ->> 'status' <> 'received' then
    raise exception 'final receipt failed to complete the PO: %', v_result;
  end if;
  v_result := public.receive_purchase_order(v_order_id, 'ALB-QA-003', v_key_after,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_line_id, 'quantity', 1)));
  if v_result ->> 'errorCode' <> 'purchase_order_not_receivable' then
    raise exception 'fully received PO accepted an additional receipt: %', v_result;
  end if;
  if not exists (select 1 from public.purchase_order_receipts where idempotency_key = v_key_after
      and status = 'rejected' and error_code = 'purchase_order_not_receivable') then
    raise exception 'invalid PO state error was not persisted';
  end if;

  select on_hand, reserved into strict v_after_on_hand, v_after_reserved
    from public.inventory where variant_id = v_variant_id and warehouse_id = v_warehouse_id;
  if v_after_on_hand <> v_before_on_hand + 4 or v_after_reserved <> v_before_reserved then
    raise exception 'receipt replay/over-receipt changed stock unexpectedly (before %, after %, reserve before %, after %)',
      v_before_on_hand, v_after_on_hand, v_before_reserved, v_after_reserved;
  end if;
  if (select received_quantity <> 4 from public.purchase_order_lines where id = v_line_id)
    or (select status <> 'received' from public.purchase_orders where id = v_order_id) then
    raise exception 'PO line or terminal status does not match the received quantity';
  end if;
  if (select count(*) <> 2 from public.purchase_order_receipt_lines rl
      join public.purchase_order_receipts r on r.id = rl.receipt_id where r.purchase_order_id = v_order_id)
    or (select count(*) <> 2 from public.inventory_movements im
      join public.purchase_order_receipt_lines rl on rl.inventory_movement_id = im.id
      join public.purchase_order_receipts r on r.id = rl.receipt_id where r.purchase_order_id = v_order_id) then
    raise exception 'Successful PO receipts are not linked to exactly one inventory ledger movement per line';
  end if;
  if exists (
    select 1 from public.purchase_order_receipt_lines rl
      join public.inventory_movements im on im.id = rl.inventory_movement_id
      join public.purchase_order_receipts r on r.id = rl.receipt_id
      where r.purchase_order_id = v_order_id and (im.supplier_name <> 'Proveedor QA Procurement'
        or im.supplier_reference not like 'ALB-QA-%' or im.quantity_delta <> rl.quantity)
  ) then raise exception 'PO receipt history does not match its stock ledger movements'; end if;

  v_result := public.create_purchase_order(v_supplier_id, v_warehouse_id, null, '',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variantId', v_variant_id, 'quantity', 3, 'unitCost', 70)));
  v_cancelled_order_id := (v_result ->> 'purchaseOrderId')::uuid;
  select id into strict v_cancelled_line_id from public.purchase_order_lines where purchase_order_id = v_cancelled_order_id;
  v_result := public.update_purchase_order_draft(v_cancelled_order_id, v_supplier_id, v_warehouse_id, null, 'Editado',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variantId', v_variant_id, 'quantity', 5, 'unitCost', 72.5)));
  if v_result ->> 'status' <> 'draft'
    or (select ordered_quantity <> 5 or unit_cost <> 72.5 from public.purchase_order_lines where id = v_cancelled_line_id) then
    raise exception 'Draft update did not replace the PO lines';
  end if;
  v_result := public.transition_purchase_order(v_cancelled_order_id, 'cancel');
  if v_result ->> 'status' <> 'cancelled' then raise exception 'Draft PO did not cancel: %', v_result; end if;
  v_result := public.receive_purchase_order(v_cancelled_order_id, 'ALB-QA-CANCEL', v_key_cancelled,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('lineId', v_cancelled_line_id, 'quantity', 1)));
  if v_result ->> 'errorCode' <> 'purchase_order_not_receivable'
    or not exists (select 1 from public.purchase_order_receipts where idempotency_key = v_key_cancelled and status = 'rejected') then
    raise exception 'Cancelled PO receipt rejection was not persisted: %', v_result;
  end if;

  perform * from public.update_procurement_supplier(
    v_supplier_id, 'Proveedor QA Archivado', 'compras@nodria.test', '+34 910 000 001', 'Archivado en fixture', false
  );
  if (select supplier_name_snapshot <> 'Proveedor QA Procurement' from public.purchase_orders where id = v_order_id)
    or (select is_active from public.inventory_suppliers where id = v_supplier_id) then
    raise exception 'Supplier update changed PO history or failed to archive supplier';
  end if;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000f402';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000f402","role":"authenticated"}';
set local role authenticated;
do $$
begin
  if (select count(*) <> 0 from public.inventory_suppliers)
    or (select count(*) <> 0 from public.purchase_orders)
    or (select count(*) <> 0 from public.purchase_order_receipts) then
    raise exception 'sales role can read procurement records outside its role boundary';
  end if;
  begin
    perform * from public.create_procurement_supplier('Proveedor Sales Denegado', null, null, null);
    raise exception 'sales unexpectedly created a procurement supplier';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000f403';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000f403","role":"authenticated"}';
set local role authenticated;
do $$
begin
  if (select count(*) <> 0 from public.inventory_suppliers)
    or (select count(*) <> 0 from public.purchase_orders)
    or (select count(*) <> 0 from public.purchase_order_events) then
    raise exception 'non-staff user can read procurement records';
  end if;
end;
$$;

rollback;
