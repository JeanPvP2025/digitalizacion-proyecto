\set ON_ERROR_STOP on

-- Run after `supabase db reset --local --yes` with the SQL Server from
-- tests/TESTING.md. Synthetic users and stock mutations roll back at the end.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000f101', 'authenticated', 'authenticated', 'inventory-buyer@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000f102', 'authenticated', 'authenticated', 'inventory-warehouse@nodria.test', '', '{}', '{}'),
  ('00000000-0000-4000-8000-00000000f103', 'authenticated', 'authenticated', 'inventory-sales@nodria.test', '', '{}', '{}');

insert into public.user_role_grants (user_id, role)
values
  ('00000000-0000-4000-8000-00000000f102', 'fulfillment_manager'),
  ('00000000-0000-4000-8000-00000000f103', 'sales_manager');

do $$
begin
  if has_function_privilege('anon', 'public.receive_inventory(uuid,uuid,integer,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.receive_inventory(uuid,uuid,integer,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.adjust_inventory(uuid,uuid,integer,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.adjust_inventory(uuid,uuid,integer,text,uuid)', 'EXECUTE') then
    raise exception 'inventory RPC grants do not follow the authenticated role boundary';
  end if;
  if has_table_privilege('authenticated', 'public.inventory', 'UPDATE')
    or has_table_privilege('authenticated', 'public.inventory_movements', 'INSERT') then
    raise exception 'authenticated users unexpectedly have direct inventory DML';
  end if;
end;
$$;

insert into public.carts (id, user_id, status, currency)
values ('00000000-0000-4000-8000-00000000f201', '00000000-0000-4000-8000-00000000f101', 'active', 'EUR');
insert into public.cart_items (cart_id, variant_id, quantity)
select '00000000-0000-4000-8000-00000000f201', v.id, 2
from public.product_variants v where v.sku = 'NOD-ARC-2T';

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000f101';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000f101","role":"authenticated"}';
set local role authenticated;
select * from public.place_order(
  '00000000-0000-4000-8000-00000000f201', 'inventory-workflow-order-1',
  '{"name":"Cliente de Prueba","street":"Calle de Prueba 1","postal_code":"28001","city":"Madrid","country_code":"ES"}'::jsonb,
  '{"name":"Cliente de Prueba","street":"Calle de Prueba 1","postal_code":"28001","city":"Madrid","country_code":"ES"}'::jsonb
);
reset role;

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000f103';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000f103","role":"authenticated"}';
set local role authenticated;
do $$
begin
  begin
    perform * from public.receive_inventory(
      (select id from public.warehouses where code = 'MAD-CENTRAL'),
      (select id from public.product_variants where sku = 'NOD-ARC-2T'),
      5, 'Proveedor Ficticio', 'ALB-SALES-01', '00000000-0000-4000-8000-00000000f301'
    );
    raise exception 'sales unexpectedly received stock';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000f102';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000f102","role":"authenticated"}';
set local role authenticated;
select * from public.receive_inventory(
  (select id from public.warehouses where code = 'MAD-CENTRAL'),
  (select id from public.product_variants where sku = 'NOD-ARC-2T'),
  5, 'Proveedor Ficticio', 'ALB-NOD-001', '00000000-0000-4000-8000-00000000f302'
);
select * from public.receive_inventory(
  (select id from public.warehouses where code = 'MAD-CENTRAL'),
  (select id from public.product_variants where sku = 'NOD-ARC-2T'),
  5, 'Proveedor Ficticio', 'ALB-NOD-001', '00000000-0000-4000-8000-00000000f302'
);
select * from public.adjust_inventory(
  (select id from public.warehouses where code = 'MAD-CENTRAL'),
  (select id from public.product_variants where sku = 'NOD-ARC-2T'),
  -1, 'Recuento de prueba', '00000000-0000-4000-8000-00000000f303'
);
do $$
begin
  if (select on_hand <> 51 or reserved <> 2 from public.inventory i
      join public.product_variants v on v.id = i.variant_id
      where v.sku = 'NOD-ARC-2T' and i.warehouse_id = (select id from public.warehouses where code = 'MAD-CENTRAL')) then
    raise exception 'physical/reserved stock did not reconcile after receipt and adjustment';
  end if;
  if (select count(*) <> 2 from public.inventory_movements im
      join public.product_variants v on v.id = im.variant_id
      where v.sku = 'NOD-ARC-2T' and im.idempotency_key in (
        '00000000-0000-4000-8000-00000000f302', '00000000-0000-4000-8000-00000000f303')) then
    raise exception 'same-key retry duplicated or omitted a ledger movement';
  end if;
  if exists (
    select 1 from public.inventory i join public.product_variants v on v.id = i.variant_id
    where v.sku = 'NOD-ARC-2T' and i.warehouse_id = (select id from public.warehouses where code = 'MAD-CENTRAL')
      and i.reserved <> coalesce((select sum(ir.quantity) from public.inventory_reservations ir
        where ir.warehouse_id = i.warehouse_id and ir.variant_id = i.variant_id
          and ir.released_at is null and ir.fulfilled_at is null), 0)
  ) then
    raise exception 'reserved units differ from the active order reservation ledger';
  end if;
  begin
    perform * from public.receive_inventory(
      (select id from public.warehouses where code = 'MAD-CENTRAL'),
      (select id from public.product_variants where sku = 'NOD-ARC-2T'),
      4, 'Proveedor Ficticio', 'ALB-DIFERENTE', '00000000-0000-4000-8000-00000000f302'
    );
    raise exception 'same idempotency key accepted a different payload';
  exception when unique_violation then
    null;
  end;
  begin
    perform * from public.adjust_inventory(
      (select id from public.warehouses where code = 'MAD-CENTRAL'),
      (select id from public.product_variants where sku = 'NOD-ARC-2T'),
      -100, 'Ajuste excesivo', '00000000-0000-4000-8000-00000000f304'
    );
    raise exception 'adjustment consumed reserved stock';
  exception when check_violation then
    null;
  end;
end;
$$;
reset role;

set local role service_role;
select public.resolve_demo_payment(
  (select id from public.orders where idempotency_key = 'inventory-workflow-order-1'),
  'approved', 'inventory-workflow-payment-1'
);
select public.fulfill_order((select id from public.orders where idempotency_key = 'inventory-workflow-order-1'));
reset role;

do $$
begin
  if (select on_hand <> 49 or reserved <> 0 from public.inventory i
      join public.product_variants v on v.id = i.variant_id
      where v.sku = 'NOD-ARC-2T' and i.warehouse_id = (select id from public.warehouses where code = 'MAD-CENTRAL')) then
    raise exception 'fulfillment did not consume the existing reservation exactly once';
  end if;
  if (select count(*) <> 1 from public.inventory_movements im
      join public.orders o on o.id = im.order_id
      where o.idempotency_key = 'inventory-workflow-order-1' and im.movement_type = 'sale') then
    raise exception 'fulfillment produced a duplicated sale ledger entry';
  end if;
end;
$$;

rollback;
