-- Inventory changes use authenticated RPCs with database role checks and an
-- append-only, idempotent ledger. Checkout reservations and fulfillment keep
-- their existing ownership and do not call these staff movement functions.

alter table public.inventory_movements
  add column if not exists idempotency_key uuid,
  add column if not exists request_fingerprint text,
  add column if not exists supplier_name text,
  add column if not exists supplier_reference text;

create unique index if not exists inventory_movements_idempotency_key_idx
  on public.inventory_movements (idempotency_key)
  where idempotency_key is not null;

create or replace function private.apply_inventory_movement(
  p_warehouse_id uuid,
  p_variant_id uuid,
  p_delta integer,
  p_movement_type text,
  p_reason text,
  p_idempotency_key uuid,
  p_supplier_name text default null,
  p_supplier_reference text default null
)
returns table (movement_id bigint, on_hand integer, reserved integer, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_fingerprint text;
  v_existing public.inventory_movements%rowtype;
  v_on_hand integer;
  v_reserved integer;
begin
  if v_user_id is null
    or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'An idempotency key is required';
  end if;
  if p_movement_type not in ('receipt', 'adjustment') then
    raise exception using errcode = '22023', message = 'Unsupported staff inventory movement';
  end if;
  if p_delta is null or p_delta = 0
    or (p_movement_type = 'receipt' and p_delta not between 1 and 100000)
    or (p_movement_type = 'adjustment' and abs(p_delta::bigint) > 100000) then
    raise exception using errcode = '22023', message = 'Invalid inventory quantity';
  end if;
  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'An inventory movement reason is required';
  end if;
  if p_movement_type = 'receipt' and (
    p_supplier_name is null or pg_catalog.char_length(pg_catalog.btrim(p_supplier_name)) not between 2 and 120
    or p_supplier_reference is null or pg_catalog.char_length(pg_catalog.btrim(p_supplier_reference)) not between 1 and 80
  ) then
    raise exception using errcode = '22023', message = 'Supplier name and delivery reference are required';
  end if;
  if p_movement_type = 'adjustment' and (p_supplier_name is not null or p_supplier_reference is not null) then
    raise exception using errcode = '22023', message = 'Supplier details only apply to receipts';
  end if;

  v_fingerprint := pg_catalog.jsonb_build_object(
    'warehouse_id', p_warehouse_id,
    'variant_id', p_variant_id,
    'delta', p_delta,
    'movement_type', p_movement_type,
    'reason', pg_catalog.btrim(p_reason),
    'supplier_name', nullif(pg_catalog.btrim(p_supplier_name), ''),
    'supplier_reference', nullif(pg_catalog.btrim(p_supplier_reference), '')
  )::text;

  -- Serialize attempts sharing a key before reading the ledger or changing stock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text, 0));
  select im.* into v_existing
    from public.inventory_movements im
    where im.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'Idempotency key was already used with a different movement';
    end if;
    select i.on_hand, i.reserved into v_on_hand, v_reserved
      from public.inventory i
      where i.warehouse_id = v_existing.warehouse_id and i.variant_id = v_existing.variant_id;
    return query select v_existing.id, v_on_hand, v_reserved, true;
    return;
  end if;

  update public.inventory i
    set on_hand = i.on_hand + p_delta
    where i.warehouse_id = p_warehouse_id and i.variant_id = p_variant_id
      and i.on_hand + p_delta >= i.reserved
    returning i.on_hand, i.reserved into v_on_hand, v_reserved;
  if not found then
    raise exception using errcode = '23514', message = 'Stock row is missing or adjustment would consume reserved stock';
  end if;

  insert into public.inventory_movements (
    warehouse_id, variant_id, movement_type, quantity_delta, on_hand_after,
    reason, actor_user_id, idempotency_key, request_fingerprint,
    supplier_name, supplier_reference
  ) values (
    p_warehouse_id, p_variant_id, p_movement_type, p_delta, v_on_hand,
    pg_catalog.btrim(p_reason), v_user_id, p_idempotency_key, v_fingerprint,
    nullif(pg_catalog.btrim(p_supplier_name), ''),
    nullif(pg_catalog.btrim(p_supplier_reference), '')
  ) returning id into movement_id;

  on_hand := v_on_hand;
  reserved := v_reserved;
  replayed := false;
  return next;
end;
$$;

revoke all on function private.apply_inventory_movement(uuid, uuid, integer, text, text, uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.receive_inventory(
  p_warehouse_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_supplier_name text,
  p_supplier_reference text,
  p_idempotency_key uuid
)
returns table (movement_id bigint, on_hand integer, reserved integer, replayed boolean)
language sql
security definer
set search_path = ''
as $$
  select * from private.apply_inventory_movement(
    p_warehouse_id, p_variant_id, p_quantity, 'receipt',
    'Recepción de proveedor ' || pg_catalog.btrim(p_supplier_name) || ' · referencia ' || pg_catalog.btrim(p_supplier_reference),
    p_idempotency_key, p_supplier_name, p_supplier_reference
  );
$$;

revoke all on function public.receive_inventory(uuid, uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function public.receive_inventory(uuid, uuid, integer, text, text, uuid) to authenticated;

create or replace function public.adjust_inventory(
  p_warehouse_id uuid,
  p_variant_id uuid,
  p_delta integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (movement_id bigint, on_hand integer, reserved integer, replayed boolean)
language sql
security definer
set search_path = ''
as $$
  select * from private.apply_inventory_movement(
    p_warehouse_id, p_variant_id, p_delta, 'adjustment', p_reason, p_idempotency_key
  );
$$;

revoke all on function public.adjust_inventory(uuid, uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.adjust_inventory(uuid, uuid, integer, text, uuid) to authenticated;

-- Keep the legacy no-key overload service-only; browser roles must use the new
-- idempotent contract above.
revoke all on function public.adjust_inventory(uuid, uuid, integer, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
