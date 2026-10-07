-- Procurement masters and purchase-order workflow. All writes use bounded RPCs
-- so inventory stock changes and PO receipt history commit atomically.

create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique default (
    'SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  contact_email text check (contact_email is null or char_length(btrim(contact_email)) between 5 and 254),
  contact_phone text check (contact_phone is null or char_length(btrim(contact_phone)) between 3 and 40),
  notes text check (notes is null or char_length(btrim(notes)) <= 500),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_suppliers_name_normalized_idx
  on public.inventory_suppliers (lower(btrim(name)));

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'PO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  supplier_id uuid not null references public.inventory_suppliers(id) on delete restrict,
  supplier_name_snapshot text not null check (char_length(btrim(supplier_name_snapshot)) between 2 and 120),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  expected_delivery date,
  notes text check (notes is null or char_length(btrim(notes)) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  placed_by uuid references auth.users(id) on delete set null,
  placed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_status_created_idx
  on public.purchase_orders (status, created_at desc);
create index purchase_orders_supplier_created_idx
  on public.purchase_orders (supplier_id, created_at desc);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  sku_snapshot text not null,
  product_name_snapshot text not null,
  variant_title_snapshot text not null,
  ordered_quantity integer not null check (ordered_quantity between 1 and 100000),
  received_quantity integer not null default 0
    check (received_quantity >= 0 and received_quantity <= ordered_quantity),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  created_at timestamptz not null default now(),
  unique (purchase_order_id, variant_id)
);

create index purchase_order_lines_order_idx on public.purchase_order_lines (purchase_order_id, created_at);

create table public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  received_by uuid references auth.users(id) on delete set null,
  idempotency_key uuid not null unique,
  request_fingerprint text not null,
  supplier_reference text not null check (char_length(btrim(supplier_reference)) between 1 and 80),
  requested_lines jsonb not null check (jsonb_typeof(requested_lines) = 'array'),
  status text not null check (status in ('processing', 'received', 'rejected', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  check ((status in ('rejected', 'failed')) = (error_code is not null))
);

create index purchase_order_receipts_order_created_idx
  on public.purchase_order_receipts (purchase_order_id, created_at desc);

create table public.purchase_order_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_order_receipts(id) on delete restrict,
  purchase_order_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 100000),
  inventory_movement_id bigint not null unique references public.inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (receipt_id, purchase_order_line_id)
);

create index purchase_order_receipt_lines_receipt_idx
  on public.purchase_order_receipt_lines (receipt_id, created_at);

create table public.purchase_order_events (
  id bigint generated always as identity primary key,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index purchase_order_events_order_created_idx
  on public.purchase_order_events (purchase_order_id, created_at desc);

alter table public.inventory_suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_receipts enable row level security;
alter table public.purchase_order_receipt_lines enable row level security;
alter table public.purchase_order_events enable row level security;

create policy inventory_suppliers_staff_read on public.inventory_suppliers for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
create policy purchase_orders_staff_read on public.purchase_orders for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
create policy purchase_order_lines_staff_read on public.purchase_order_lines for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
create policy purchase_order_receipts_staff_read on public.purchase_order_receipts for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
create policy purchase_order_receipt_lines_staff_read on public.purchase_order_receipt_lines for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
create policy purchase_order_events_staff_read on public.purchase_order_events for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

revoke all on public.inventory_suppliers, public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_receipts, public.purchase_order_receipt_lines, public.purchase_order_events
  from public, anon, authenticated, service_role;
grant select on public.inventory_suppliers, public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_receipts, public.purchase_order_receipt_lines, public.purchase_order_events
  to authenticated;
revoke update, delete on public.inventory_suppliers, public.purchase_orders, public.purchase_order_lines,
  public.purchase_order_receipts, public.purchase_order_receipt_lines, public.purchase_order_events
  from authenticated, service_role;

create or replace function private.replace_purchase_order_lines(
  p_purchase_order_id uuid,
  p_warehouse_id uuid,
  p_lines jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_cost numeric(12, 2);
  v_sku text;
  v_title text;
  v_product_name text;
  v_count integer := 0;
begin
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array'
    or pg_catalog.jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'A purchase order requires between 1 and 100 lines';
  end if;

  delete from public.purchase_order_lines where purchase_order_id = p_purchase_order_id;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_lines)
  loop
    v_variant_id := (v_item ->> 'variantId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_cost := (v_item ->> 'unitCost')::numeric;
    if v_quantity not between 1 and 100000 or v_unit_cost < 0 or v_unit_cost > 9999999999.99 then
      raise exception using errcode = '22023', message = 'Invalid purchase order line';
    end if;

    select pv.sku, pv.title, p.name into v_sku, v_title, v_product_name
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = v_variant_id and pv.is_active
        and exists (
          select 1 from public.inventory i
          where i.variant_id = pv.id and i.warehouse_id = p_warehouse_id
        );
    if not found then
      raise exception using errcode = '23503', message = 'The variant is not stocked in the selected warehouse';
    end if;

    insert into public.purchase_order_lines (
      purchase_order_id, variant_id, sku_snapshot, product_name_snapshot,
      variant_title_snapshot, ordered_quantity, unit_cost
    ) values (
      p_purchase_order_id, v_variant_id, v_sku, v_product_name,
      v_title, v_quantity, v_unit_cost
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.replace_purchase_order_lines(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.create_procurement_supplier(
  p_name text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_notes text default null
)
returns table (
  id uuid, supplier_code text, name text, contact_email text,
  contact_phone text, notes text, is_active boolean, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;

  return query
    insert into public.inventory_suppliers as s (name, contact_email, contact_phone, notes, created_by)
    values (
      pg_catalog.btrim(p_name), nullif(pg_catalog.btrim(p_contact_email), ''),
      nullif(pg_catalog.btrim(p_contact_phone), ''), nullif(pg_catalog.btrim(p_notes), ''), auth.uid()
    )
    returning s.id, s.supplier_code, s.name, s.contact_email, s.contact_phone, s.notes, s.is_active, s.created_at;
end;
$$;

create or replace function public.update_procurement_supplier(
  p_supplier_id uuid,
  p_name text,
  p_contact_email text,
  p_contact_phone text,
  p_notes text,
  p_is_active boolean
)
returns table (
  id uuid, supplier_code text, name text, contact_email text,
  contact_phone text, notes text, is_active boolean, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;

  return query
    update public.inventory_suppliers as s set
      name = pg_catalog.btrim(p_name),
      contact_email = nullif(pg_catalog.btrim(p_contact_email), ''),
      contact_phone = nullif(pg_catalog.btrim(p_contact_phone), ''),
      notes = nullif(pg_catalog.btrim(p_notes), ''),
      is_active = p_is_active,
      updated_at = pg_catalog.now()
    where s.id = p_supplier_id
    returning s.id, s.supplier_code, s.name, s.contact_email, s.contact_phone, s.notes, s.is_active, s.created_at;
  if not found then
    raise exception using errcode = 'P0002', message = 'Supplier not found';
  end if;
end;
$$;

create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_expected_delivery date,
  p_notes text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.purchase_orders%rowtype;
  v_supplier_name text;
  v_line_count integer;
begin
  if v_user_id is null or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;

  select s.name into v_supplier_name from public.inventory_suppliers s where s.id = p_supplier_id and s.is_active;
  if not found then raise exception using errcode = 'P0002', message = 'Active supplier not found'; end if;
  if not exists (select 1 from public.warehouses w where w.id = p_warehouse_id and w.is_active) then
    raise exception using errcode = 'P0002', message = 'Active warehouse not found';
  end if;

  insert into public.purchase_orders (
    supplier_id, supplier_name_snapshot, warehouse_id, expected_delivery, notes, created_by
  ) values (
    p_supplier_id, v_supplier_name, p_warehouse_id, p_expected_delivery,
    nullif(pg_catalog.btrim(p_notes), ''), v_user_id
  ) returning * into v_order;

  v_line_count := private.replace_purchase_order_lines(v_order.id, p_warehouse_id, p_lines);
  insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, to_status, details)
  values (v_order.id, v_user_id, 'created', 'draft', pg_catalog.jsonb_build_object('line_count', v_line_count));

  return pg_catalog.jsonb_build_object(
    'success', true, 'purchaseOrderId', v_order.id, 'orderNumber', v_order.order_number, 'status', v_order.status
  );
end;
$$;

create or replace function public.update_purchase_order_draft(
  p_purchase_order_id uuid,
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_expected_delivery date,
  p_notes text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.purchase_orders%rowtype;
  v_supplier_name text;
  v_line_count integer;
begin
  if v_user_id is null or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;

  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Purchase order not found'; end if;
  if v_order.status <> 'draft' then raise exception using errcode = '23514', message = 'Only draft purchase orders can be edited'; end if;
  select s.name into v_supplier_name from public.inventory_suppliers s where s.id = p_supplier_id and s.is_active;
  if not found then raise exception using errcode = 'P0002', message = 'Active supplier not found'; end if;
  if not exists (select 1 from public.warehouses w where w.id = p_warehouse_id and w.is_active) then
    raise exception using errcode = 'P0002', message = 'Active warehouse not found';
  end if;

  update public.purchase_orders set
    supplier_id = p_supplier_id, supplier_name_snapshot = v_supplier_name,
    warehouse_id = p_warehouse_id, expected_delivery = p_expected_delivery,
    notes = nullif(pg_catalog.btrim(p_notes), ''), updated_at = pg_catalog.now()
    where id = p_purchase_order_id;
  v_line_count := private.replace_purchase_order_lines(p_purchase_order_id, p_warehouse_id, p_lines);
  insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
  values (p_purchase_order_id, v_user_id, 'draft_updated', 'draft', 'draft', pg_catalog.jsonb_build_object('line_count', v_line_count));

  return pg_catalog.jsonb_build_object(
    'success', true, 'purchaseOrderId', v_order.id, 'orderNumber', v_order.order_number, 'status', 'draft'
  );
end;
$$;

create or replace function public.transition_purchase_order(p_purchase_order_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.purchase_orders%rowtype;
  v_next_status text;
  v_previous_status text;
begin
  if v_user_id is null or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;
  if p_action not in ('place', 'cancel') then raise exception using errcode = '22023', message = 'Unsupported purchase order action'; end if;

  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Purchase order not found'; end if;
  if p_action = 'place' and v_order.status = 'ordered' then
    return pg_catalog.jsonb_build_object('success', true, 'replayed', true, 'purchaseOrderId', v_order.id, 'status', v_order.status);
  end if;
  if p_action = 'cancel' and v_order.status = 'cancelled' then
    return pg_catalog.jsonb_build_object('success', true, 'replayed', true, 'purchaseOrderId', v_order.id, 'status', v_order.status);
  end if;

  if p_action = 'place' and v_order.status = 'draft'
    and exists (select 1 from public.purchase_order_lines l where l.purchase_order_id = v_order.id) then
    v_next_status := 'ordered';
    v_previous_status := v_order.status;
    update public.purchase_orders set status = v_next_status, placed_by = v_user_id,
      placed_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = v_order.id;
  elsif p_action = 'cancel' and v_order.status in ('draft', 'ordered', 'partially_received') then
    v_next_status := 'cancelled';
    v_previous_status := v_order.status;
    update public.purchase_orders set status = v_next_status, cancelled_by = v_user_id,
      cancelled_at = pg_catalog.now(), updated_at = pg_catalog.now() where id = v_order.id;
  else
    insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
    values (v_order.id, v_user_id, 'transition_rejected', v_order.status, v_order.status,
      pg_catalog.jsonb_build_object('action', p_action, 'errorCode', 'invalid_status_transition'));
    return pg_catalog.jsonb_build_object('success', false, 'errorCode', 'invalid_status_transition', 'status', v_order.status);
  end if;

  insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
  values (v_order.id, v_user_id, case p_action when 'place' then 'placed' else 'cancelled' end,
    v_previous_status, v_next_status, '{}'::jsonb);
  return pg_catalog.jsonb_build_object('success', true, 'replayed', false, 'purchaseOrderId', v_order.id, 'status', v_next_status);
end;
$$;

create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_supplier_reference text,
  p_idempotency_key uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.purchase_orders%rowtype;
  v_receipt public.purchase_order_receipts%rowtype;
  v_item jsonb;
  v_normalized_lines jsonb;
  v_fingerprint text;
  v_line_id uuid;
  v_quantity integer;
  v_pending integer;
  v_variant_id uuid;
  v_inventory_movement_id bigint;
  v_sqlstate text;
  v_error_code text;
  v_previous_status text;
begin
  if v_user_id is null or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required';
  end if;
  if p_idempotency_key is null or p_supplier_reference is null
    or pg_catalog.char_length(pg_catalog.btrim(p_supplier_reference)) not between 1 and 80
    or p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array'
    or pg_catalog.jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid purchase order receipt';
  end if;

  select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('lineId', line_id, 'quantity', quantity) order by line_id
    ) into v_normalized_lines
    from (
      select (value ->> 'lineId')::uuid as line_id, (value ->> 'quantity')::integer as quantity
        from pg_catalog.jsonb_array_elements(p_lines) as elements(value)
    ) normalized;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_normalized_lines) as elements(value)
      where (value ->> 'quantity')::integer not between 1 and 100000
  ) or (select count(*) from pg_catalog.jsonb_array_elements(v_normalized_lines))
      <> (select count(distinct value ->> 'lineId') from pg_catalog.jsonb_array_elements(v_normalized_lines) as elements(value)) then
    raise exception using errcode = '22023', message = 'Invalid purchase order receipt lines';
  end if;

  v_fingerprint := pg_catalog.jsonb_build_object(
    'purchaseOrderId', p_purchase_order_id,
    'supplierReference', pg_catalog.btrim(p_supplier_reference),
    'lines', v_normalized_lines
  )::text;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text, 17));
  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Purchase order not found'; end if;
  v_previous_status := v_order.status;

  select * into v_receipt from public.purchase_order_receipts where idempotency_key = p_idempotency_key;
  if found then
    if v_receipt.request_fingerprint is distinct from v_fingerprint then
      insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, details)
      values (p_purchase_order_id, v_user_id, 'receipt_replay_rejected',
        pg_catalog.jsonb_build_object('errorCode', 'idempotency_conflict'));
      return pg_catalog.jsonb_build_object('success', false, 'replayed', false, 'errorCode', 'idempotency_conflict');
    end if;
    return pg_catalog.jsonb_build_object(
      'success', v_receipt.status = 'received', 'replayed', true,
      'receiptId', v_receipt.id, 'errorCode', v_receipt.error_code, 'status', v_receipt.status
    );
  end if;

  insert into public.purchase_order_receipts (
    purchase_order_id, received_by, idempotency_key, request_fingerprint,
    supplier_reference, requested_lines, status
  ) values (
    p_purchase_order_id, v_user_id, p_idempotency_key, v_fingerprint,
    pg_catalog.btrim(p_supplier_reference), v_normalized_lines, 'processing'
  ) returning * into v_receipt;

  if v_order.status not in ('ordered', 'partially_received') then
    v_error_code := 'purchase_order_not_receivable';
    update public.purchase_order_receipts set status = 'rejected', error_code = v_error_code where id = v_receipt.id;
    insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_purchase_order_id, v_user_id, 'receipt_rejected', v_order.status, v_order.status,
      pg_catalog.jsonb_build_object('receiptId', v_receipt.id, 'errorCode', v_error_code));
    return pg_catalog.jsonb_build_object('success', false, 'replayed', false, 'receiptId', v_receipt.id, 'errorCode', v_error_code);
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_normalized_lines)
  loop
    v_line_id := (v_item ->> 'lineId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    select l.variant_id, l.ordered_quantity - l.received_quantity into v_variant_id, v_pending
      from public.purchase_order_lines l
      where l.id = v_line_id and l.purchase_order_id = p_purchase_order_id
      for update;
    if not found then
      v_error_code := 'purchase_order_line_not_found';
      exit;
    elsif v_quantity > v_pending then
      v_error_code := 'quantity_exceeds_pending';
      exit;
    end if;
  end loop;

  if v_error_code is not null then
    update public.purchase_order_receipts set status = 'rejected', error_code = v_error_code where id = v_receipt.id;
    insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_purchase_order_id, v_user_id, 'receipt_rejected', v_order.status, v_order.status,
      pg_catalog.jsonb_build_object('receiptId', v_receipt.id, 'errorCode', v_error_code, 'requestedLines', v_normalized_lines));
    return pg_catalog.jsonb_build_object('success', false, 'replayed', false, 'receiptId', v_receipt.id, 'errorCode', v_error_code);
  end if;

  begin
    for v_item in select value from pg_catalog.jsonb_array_elements(v_normalized_lines)
    loop
      v_line_id := (v_item ->> 'lineId')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
      select l.variant_id into v_variant_id from public.purchase_order_lines l where l.id = v_line_id;
      select movement_id into v_inventory_movement_id from public.receive_inventory(
        v_order.warehouse_id, v_variant_id, v_quantity, v_order.supplier_name_snapshot,
        p_supplier_reference, gen_random_uuid()
      );
      insert into public.purchase_order_receipt_lines (
        receipt_id, purchase_order_line_id, quantity, inventory_movement_id
      ) values (v_receipt.id, v_line_id, v_quantity, v_inventory_movement_id);
      update public.purchase_order_lines set received_quantity = received_quantity + v_quantity
        where id = v_line_id;
    end loop;

    update public.purchase_orders po set
      status = case when not exists (
        select 1 from public.purchase_order_lines l
          where l.purchase_order_id = po.id and l.received_quantity < l.ordered_quantity
      ) then 'received' else 'partially_received' end,
      received_at = case when not exists (
        select 1 from public.purchase_order_lines l
          where l.purchase_order_id = po.id and l.received_quantity < l.ordered_quantity
      ) then pg_catalog.now() else po.received_at end,
      updated_at = pg_catalog.now()
      where po.id = p_purchase_order_id
      returning * into v_order;
    update public.purchase_order_receipts set status = 'received' where id = v_receipt.id;
    insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_purchase_order_id, v_user_id, 'receipt_completed', v_previous_status, v_order.status,
      pg_catalog.jsonb_build_object('receiptId', v_receipt.id, 'supplierReference', pg_catalog.btrim(p_supplier_reference)));
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    v_error_code := 'inventory_write_failed';
    update public.purchase_order_receipts set status = 'failed', error_code = v_error_code where id = v_receipt.id;
    insert into public.purchase_order_events (purchase_order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_purchase_order_id, v_user_id, 'receipt_failed', v_previous_status, v_previous_status,
      pg_catalog.jsonb_build_object('receiptId', v_receipt.id, 'errorCode', v_error_code, 'databaseCode', v_sqlstate));
    return pg_catalog.jsonb_build_object('success', false, 'replayed', false, 'receiptId', v_receipt.id, 'errorCode', v_error_code);
  end;

  return pg_catalog.jsonb_build_object(
    'success', true, 'replayed', false, 'receiptId', v_receipt.id, 'status', v_order.status
  );
end;
$$;

revoke all on function public.create_procurement_supplier(text, text, text, text),
  public.update_procurement_supplier(uuid, text, text, text, text, boolean),
  public.create_purchase_order(uuid, uuid, date, text, jsonb),
  public.update_purchase_order_draft(uuid, uuid, uuid, date, text, jsonb),
  public.transition_purchase_order(uuid, text),
  public.receive_purchase_order(uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_procurement_supplier(text, text, text, text),
  public.update_procurement_supplier(uuid, text, text, text, text, boolean),
  public.create_purchase_order(uuid, uuid, date, text, jsonb),
  public.update_purchase_order_draft(uuid, uuid, uuid, date, text, jsonb),
  public.transition_purchase_order(uuid, text),
  public.receive_purchase_order(uuid, text, uuid, jsonb)
  to authenticated;
