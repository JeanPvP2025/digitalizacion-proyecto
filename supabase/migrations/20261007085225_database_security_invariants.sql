-- NODRIA database security and transaction invariants.
-- Client roles read protected operational data; state changes go through narrow RPCs.

alter table public.orders
  add column if not exists delivered_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'orders_delivered_at_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_delivered_at_status_check
      check (delivered_at is null or status = 'delivered');
  end if;
end;
$$;

-- Reservation rows retain both sides of the stock key. The trigger fills variant_id
-- for the existing place_order RPC, while these foreign keys prevent cross-SKU stock links.
alter table public.order_items
  add constraint order_items_id_variant_id_key unique (id, variant_id);

alter table public.order_items
  add constraint order_items_id_order_id_key unique (id, order_id);

alter table public.inventory_reservations
  add column if not exists variant_id uuid;

update public.inventory_reservations ir
set variant_id = oi.variant_id
from public.order_items oi
where oi.id = ir.order_item_id and ir.variant_id is null;

do $$
begin
  if exists (
    select 1 from public.inventory_reservations where variant_id is null
  ) then
    raise exception 'Cannot harden inventory reservations: an order item has no variant';
  end if;
end;
$$;

alter table public.inventory_reservations
  alter column variant_id set not null;

alter table public.inventory_reservations
  add constraint inventory_reservations_item_variant_fkey
    foreign key (order_item_id, variant_id)
    references public.order_items (id, variant_id) on delete restrict,
  add constraint inventory_reservations_stock_variant_fkey
    foreign key (warehouse_id, variant_id)
    references public.inventory (warehouse_id, variant_id) on delete restrict;

create index if not exists inventory_reservations_open_item_idx
  on public.inventory_reservations (order_item_id)
  where released_at is null and fulfilled_at is null;

create index if not exists return_items_order_item_idx
  on public.return_items (order_item_id, return_request_id);

create unique index if not exists organization_single_owner_idx
  on public.organization_memberships (organization_id)
  where role = 'owner';

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  warehouse_id uuid not null,
  variant_id uuid not null,
  movement_type text not null check (movement_type in ('receipt', 'adjustment', 'sale')),
  quantity_delta integer not null check (quantity_delta <> 0),
  on_hand_after integer not null check (on_hand_after >= 0),
  reason text not null check (char_length(reason) between 3 and 500),
  actor_user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inventory_movements_stock_fkey
    foreign key (warehouse_id, variant_id)
    references public.inventory (warehouse_id, variant_id) on delete restrict,
  constraint inventory_movements_order_item_pair_check
    check ((order_id is null) = (order_item_id is null)),
  constraint inventory_movements_order_item_order_fkey
    foreign key (order_item_id, order_id)
    references public.order_items (id, order_id) on delete restrict
);

create index if not exists inventory_movements_stock_date_idx
  on public.inventory_movements (warehouse_id, variant_id, created_at desc);
create index if not exists inventory_movements_order_idx
  on public.inventory_movements (order_id, created_at)
  where order_id is not null;

alter table public.inventory_movements enable row level security;

create or replace function private.validate_inventory_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant_id uuid;
  v_item_quantity integer;
  v_order_status public.order_status;
  v_reserved_quantity integer;
begin
  if tg_op = 'INSERT' then
    if new.released_at is not null or new.fulfilled_at is not null then
      raise exception using errcode = '23514', message = 'A new reservation must be active';
    end if;

    select oi.variant_id, oi.quantity, o.status
      into v_variant_id, v_item_quantity, v_order_status
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = new.order_item_id
      for update of oi;
    if not found or v_variant_id is null then
      raise exception using errcode = '23503', message = 'Reservation order item must have a variant';
    end if;
    if v_order_status <> 'pending_payment' then
      raise exception using errcode = '23514', message = 'Reservations can only be added during checkout';
    end if;
    if new.variant_id is not null and new.variant_id <> v_variant_id then
      raise exception using errcode = '23514', message = 'Reservation variant does not match its order item';
    end if;
    new.variant_id := v_variant_id;

    select coalesce(sum(ir.quantity), 0)::integer
      into v_reserved_quantity
      from public.inventory_reservations ir
      where ir.order_item_id = new.order_item_id
        and ir.released_at is null and ir.fulfilled_at is null;
    if v_reserved_quantity + new.quantity > v_item_quantity then
      raise exception using errcode = '23514', message = 'Active reservations exceed the order item quantity';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.order_item_id is distinct from old.order_item_id
       or new.warehouse_id is distinct from old.warehouse_id
       or new.variant_id is distinct from old.variant_id
       or new.quantity is distinct from old.quantity
       or new.created_at is distinct from old.created_at then
      raise exception using errcode = '23514', message = 'Reservation identity and quantity are immutable';
    end if;
    if old.released_at is not null or old.fulfilled_at is not null
       or (new.released_at is null and new.fulfilled_at is null)
       or (new.released_at is not null and new.fulfilled_at is not null) then
      raise exception using errcode = '23514', message = 'An active reservation can be closed exactly once';
    end if;

    select o.status into v_order_status
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = old.order_item_id
      for update of o;
    if new.released_at is not null and v_order_status <> 'pending_payment' then
      raise exception using errcode = '23514', message = 'Only an unpaid order reservation can be released';
    end if;
    if new.fulfilled_at is not null and v_order_status not in ('paid', 'processing') then
      raise exception using errcode = '23514', message = 'Only a paid order reservation can be fulfilled';
    end if;
    return new;
  end if;

  raise exception using errcode = '23514', message = 'Reservation rows cannot be deleted';
end;
$$;

revoke all on function private.validate_inventory_reservation() from public, anon, authenticated;

drop trigger if exists inventory_reservations_validate on public.inventory_reservations;
create trigger inventory_reservations_validate
  before insert or update or delete on public.inventory_reservations
  for each row execute function private.validate_inventory_reservation();

create or replace function private.apply_inventory_reservation_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_on_hand integer;
begin
  if tg_op <> 'UPDATE'
     or (new.released_at is null and new.fulfilled_at is null) then
    return new;
  end if;

  select oi.order_id into v_order_id
    from public.order_items oi
    where oi.id = new.order_item_id;

  if new.released_at is not null then
    update public.inventory i
      set reserved = i.reserved - old.quantity
      where i.warehouse_id = old.warehouse_id
        and i.variant_id = old.variant_id
        and i.reserved >= old.quantity;
  else
    update public.inventory i
      set reserved = i.reserved - old.quantity,
          on_hand = i.on_hand - old.quantity
      where i.warehouse_id = old.warehouse_id
        and i.variant_id = old.variant_id
        and i.reserved >= old.quantity
        and i.on_hand >= old.quantity
      returning i.on_hand into v_on_hand;
  end if;

  if not found then
    raise exception using errcode = '23514', message = 'Inventory reservation balance is inconsistent';
  end if;

  if new.fulfilled_at is not null then
    insert into public.inventory_movements (
      warehouse_id, variant_id, movement_type, quantity_delta, on_hand_after,
      reason, actor_user_id, order_id, order_item_id
    ) values (
      new.warehouse_id, new.variant_id, 'sale', -old.quantity, v_on_hand,
      'Reserva consumida durante la expedición del pedido.', (select auth.uid()),
      v_order_id, new.order_item_id
    );
  end if;

  return new;
end;
$$;

revoke all on function private.apply_inventory_reservation_close() from public, anon, authenticated;

drop trigger if exists inventory_reservations_apply_close on public.inventory_reservations;
create trigger inventory_reservations_apply_close
  after update of released_at, fulfilled_at on public.inventory_reservations
  for each row execute function private.apply_inventory_reservation_close();

create or replace function private.lock_order_stock_rows(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Match place_order's variant-first, warehouse-code order to avoid cross-order deadlocks.
  perform i.warehouse_id
    from public.inventory i
    join public.inventory_reservations ir
      on ir.warehouse_id = i.warehouse_id and ir.variant_id = i.variant_id
    join public.order_items oi on oi.id = ir.order_item_id
    join public.warehouses w on w.id = i.warehouse_id
    where oi.order_id = p_order_id
      and ir.released_at is null and ir.fulfilled_at is null
    order by oi.variant_id, w.code, i.warehouse_id
    for update of i;

  perform ir.id
    from public.inventory_reservations ir
    join public.order_items oi on oi.id = ir.order_item_id
    join public.warehouses w on w.id = ir.warehouse_id
    where oi.order_id = p_order_id
      and ir.released_at is null and ir.fulfilled_at is null
    order by oi.variant_id, w.code, ir.warehouse_id, ir.id
    for update of ir;
end;
$$;

revoke all on function private.lock_order_stock_rows(uuid) from public, anon, authenticated;

create or replace function private.reject_inventory_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Inventory movement history is append-only';
end;
$$;

revoke all on function private.reject_inventory_movement_mutation() from public, anon, authenticated;

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function private.reject_inventory_movement_mutation();

create or replace function private.create_organization(
  p_slug text,
  p_legal_name text,
  p_display_name text,
  p_tax_id text,
  p_billing_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to create an organization';
  end if;

  insert into public.organizations (
    slug, legal_name, display_name, tax_id, billing_email, created_by
  ) values (
    p_slug, p_legal_name, p_display_name, nullif(pg_catalog.btrim(p_tax_id), ''),
    nullif(pg_catalog.lower(pg_catalog.btrim(p_billing_email)), ''), v_user_id
  ) returning id into v_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, added_by)
  values (v_organization_id, v_user_id, 'owner', v_user_id);

  return v_organization_id;
end;
$$;

revoke all on function private.create_organization(text, text, text, text, text) from public, anon, authenticated;
grant execute on function private.create_organization(text, text, text, text, text) to authenticated;

create or replace function public.create_organization(
  p_slug text,
  p_legal_name text,
  p_display_name text,
  p_tax_id text,
  p_billing_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organization(p_slug, p_legal_name, p_display_name, p_tax_id, p_billing_email);
$$;

revoke all on function public.create_organization(text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text) to authenticated;

create or replace function private.resolve_demo_payment(
  p_order_id uuid,
  p_outcome text,
  p_event_id text
)
returns public.payment_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payment_transactions%rowtype;
  v_existing public.payment_transactions%rowtype;
  v_status public.payment_status;
begin
  if p_outcome is null or p_outcome not in ('approved', 'failed') then
    raise exception using errcode = '22023', message = 'Demo payment outcome must be approved or failed';
  end if;
  if p_event_id is null or pg_catalog.char_length(p_event_id) not between 8 and 120 then
    raise exception using errcode = '22023', message = 'A stable demo payment event id is required';
  end if;

  select o.* into v_order
    from public.orders o
    where o.id = p_order_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  select pt.* into v_existing
    from public.payment_transactions pt
    where pt.provider = 'demo' and pt.provider_reference = p_event_id;
  if found then
    if v_existing.order_id <> p_order_id
       or (p_outcome = 'approved' and v_existing.status <> 'paid')
       or (p_outcome = 'failed' and v_existing.status <> 'failed') then
      raise exception using errcode = '23505', message = 'Payment event id was already used for a different result';
    end if;
    return v_existing.status;
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception using errcode = '23514', message = 'Only an unpaid order can receive a payment result';
  end if;

  select pt.* into v_payment
    from public.payment_transactions pt
    where pt.order_id = p_order_id and pt.status = 'pending'
    order by pt.created_at desc, pt.id
    limit 1
    for update;
  if not found or v_payment.amount <> v_order.grand_total or v_payment.currency <> v_order.currency then
    raise exception using errcode = '23514', message = 'Pending payment does not match the order total';
  end if;

  v_status := case when p_outcome = 'approved' then 'paid'::public.payment_status else 'failed'::public.payment_status end;
  update public.payment_transactions
    set provider = 'demo', provider_reference = p_event_id,
        status = v_status, processed_at = pg_catalog.now()
    where id = v_payment.id;

  if p_outcome = 'approved' then
    update public.orders set status = 'paid' where id = p_order_id;
    insert into public.order_events (order_id, actor_user_id, event_key, note, details)
      values (p_order_id, null, 'payment_paid', 'Pago ficticio aprobado; reserva mantenida hasta expedición.',
        pg_catalog.jsonb_build_object('provider', 'demo', 'event_id', p_event_id));
  else
    perform private.lock_order_stock_rows(p_order_id);
    update public.inventory_reservations ir
      set released_at = pg_catalog.now()
      from public.order_items oi
      where oi.id = ir.order_item_id and oi.order_id = p_order_id
        and ir.released_at is null and ir.fulfilled_at is null;
    update public.orders set status = 'cancelled' where id = p_order_id;
    insert into public.order_events (order_id, actor_user_id, event_key, note, details)
      values (p_order_id, null, 'payment_failed', 'Pago ficticio fallido; reserva liberada.',
        pg_catalog.jsonb_build_object('provider', 'demo', 'event_id', p_event_id));
  end if;

  return v_status;
end;
$$;

revoke all on function private.resolve_demo_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function private.resolve_demo_payment(uuid, text, text) to service_role;

create or replace function public.resolve_demo_payment(
  p_order_id uuid,
  p_outcome text,
  p_event_id text
)
returns public.payment_status
language sql
security invoker
set search_path = ''
as $$
  select private.resolve_demo_payment(p_order_id, p_outcome, p_event_id);
$$;

revoke all on function public.resolve_demo_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_demo_payment(uuid, text, text) to service_role;

create or replace function private.fulfill_order(p_order_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;
  if v_order.status = 'shipped' then
    return v_order.status;
  end if;
  if v_order.status not in ('paid', 'processing')
     or not exists (
       select 1 from public.payment_transactions pt
       where pt.order_id = p_order_id and pt.status = 'paid'
     ) then
    raise exception using errcode = '23514', message = 'Only a paid order can be fulfilled';
  end if;
  if exists (
    select 1
    from public.order_items oi
    left join public.inventory_reservations ir on ir.order_item_id = oi.id
    where oi.order_id = p_order_id
    group by oi.id, oi.quantity
    having coalesce(sum(ir.quantity) filter (where ir.released_at is null and ir.fulfilled_at is null), 0) <> oi.quantity
  ) then
    raise exception using errcode = '23514', message = 'Active reservations do not match the order quantities';
  end if;

  perform private.lock_order_stock_rows(p_order_id);
  update public.inventory_reservations ir
    set fulfilled_at = pg_catalog.now()
    from public.order_items oi
    where oi.id = ir.order_item_id and oi.order_id = p_order_id
      and ir.released_at is null and ir.fulfilled_at is null;

  update public.orders set status = 'shipped' where id = p_order_id;
  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
    values (p_order_id, null, 'order_shipped', 'Reserva consumida y pedido expedido.', '{}'::jsonb);
  return 'shipped'::public.order_status;
end;
$$;

revoke all on function private.fulfill_order(uuid) from public, anon, authenticated;
grant execute on function private.fulfill_order(uuid) to service_role;

create or replace function public.fulfill_order(p_order_id uuid)
returns public.order_status
language sql
security invoker
set search_path = ''
as $$
  select private.fulfill_order(p_order_id);
$$;

revoke all on function public.fulfill_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_order(uuid) to service_role;

create or replace function private.mark_order_delivered(p_order_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  select o.status into v_status from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;
  if v_status = 'delivered' then
    return v_status;
  end if;
  if v_status <> 'shipped' then
    raise exception using errcode = '23514', message = 'Only a shipped order can be marked delivered';
  end if;

  update public.orders set status = 'delivered', delivered_at = pg_catalog.now()
    where id = p_order_id;
  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
    values (p_order_id, null, 'order_delivered', 'Entrega confirmada por operaciones.', '{}'::jsonb);
  return 'delivered'::public.order_status;
end;
$$;

revoke all on function private.mark_order_delivered(uuid) from public, anon, authenticated;
grant execute on function private.mark_order_delivered(uuid) to service_role;

create or replace function public.mark_order_delivered(p_order_id uuid)
returns public.order_status
language sql
security invoker
set search_path = ''
as $$
  select private.mark_order_delivered(p_order_id);
$$;

revoke all on function public.mark_order_delivered(uuid) from public, anon, authenticated;
grant execute on function public.mark_order_delivered(uuid) to service_role;

create or replace function private.adjust_inventory(
  p_warehouse_id uuid,
  p_variant_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand integer;
begin
  if p_delta is null or p_delta = 0 then
    raise exception using errcode = '22023', message = 'Inventory delta must be non-zero';
  end if;
  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'An inventory movement reason is required';
  end if;

  update public.inventory i
    set on_hand = i.on_hand + p_delta
    where i.warehouse_id = p_warehouse_id and i.variant_id = p_variant_id
      and i.on_hand + p_delta >= i.reserved
    returning i.on_hand into v_on_hand;
  if not found then
    raise exception using errcode = '23514', message = 'Stock row is missing or adjustment would consume reserved stock';
  end if;

  insert into public.inventory_movements (
    warehouse_id, variant_id, movement_type, quantity_delta, on_hand_after,
    reason, actor_user_id
  ) values (
    p_warehouse_id, p_variant_id,
    case when p_delta > 0 then 'receipt' else 'adjustment' end,
    p_delta, v_on_hand, pg_catalog.btrim(p_reason), (select auth.uid())
  );
  return v_on_hand;
end;
$$;

revoke all on function private.adjust_inventory(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function private.adjust_inventory(uuid, uuid, integer, text) to service_role;

create or replace function public.adjust_inventory(
  p_warehouse_id uuid,
  p_variant_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.adjust_inventory(p_warehouse_id, p_variant_id, p_delta, p_reason);
$$;

revoke all on function public.adjust_inventory(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_inventory(uuid, uuid, integer, text) to service_role;

create or replace function private.request_return(
  p_order_id uuid,
  p_reason text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_return_request_id uuid;
  v_item record;
  v_order_item_id uuid;
  v_requested_quantity integer;
  v_ordered_quantity integer;
  v_prior_quantity integer;
  v_item_count integer;
  v_distinct_item_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to request a return';
  end if;
  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'A return reason between 10 and 2000 characters is required';
  end if;
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Return items must be an array containing 1 to 50 lines';
  end if;

  select o.* into v_order
    from public.orders o
    where o.id = p_order_id and o.customer_id = v_user_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Delivered order not found for the current customer';
  end if;
  if v_order.status <> 'delivered' or v_order.delivered_at is null
     or v_order.delivered_at > pg_catalog.now()
     or v_order.delivered_at < pg_catalog.now() - interval '30 days' then
    raise exception using errcode = '23514', message = 'Returns are available for 30 days after delivery';
  end if;

  select count(*)::integer,
         count(distinct e.value ->> 'order_item_id')::integer
    into v_item_count, v_distinct_item_count
    from pg_catalog.jsonb_array_elements(p_items) as e(value);
  if v_item_count <> v_distinct_item_count
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_items) as e(value)
       where pg_catalog.jsonb_typeof(e.value) <> 'object'
          or nullif(e.value ->> 'order_item_id', '') is null
          or coalesce(e.value ->> 'quantity', '') !~ '^[1-9][0-9]*$'
     ) then
    raise exception using errcode = '22023', message = 'Each return line needs one order item id and a positive integer quantity';
  end if;

  -- Lock the order first; all return requests for it serialize on this row.
  for v_item in
    select e.value
      from pg_catalog.jsonb_array_elements(p_items) as e(value)
      order by e.value ->> 'order_item_id'
  loop
    v_order_item_id := (v_item.value ->> 'order_item_id')::uuid;
    v_requested_quantity := (v_item.value ->> 'quantity')::integer;
    select oi.quantity into v_ordered_quantity
      from public.order_items oi
      where oi.id = v_order_item_id and oi.order_id = p_order_id
      for update;
    if not found then
      raise exception using errcode = '22023', message = 'A return line does not belong to this order';
    end if;
    select coalesce(sum(ri.quantity), 0)::integer into v_prior_quantity
      from public.return_items ri
      join public.return_requests rr on rr.id = ri.return_request_id
      where ri.order_item_id = v_order_item_id and rr.status <> 'rejected';
    if v_prior_quantity + v_requested_quantity > v_ordered_quantity then
      raise exception using errcode = '23514', message = 'Requested return quantity exceeds the purchased quantity';
    end if;
  end loop;

  insert into public.return_requests (return_number, order_id, customer_id, status, reason)
    values ('', p_order_id, v_user_id, 'requested', pg_catalog.btrim(p_reason))
    returning id into v_return_request_id;

  for v_item in
    select e.value from pg_catalog.jsonb_array_elements(p_items) as e(value)
  loop
    insert into public.return_items (return_request_id, order_item_id, quantity, condition_note)
    values (
      v_return_request_id,
      (v_item.value ->> 'order_item_id')::uuid,
      (v_item.value ->> 'quantity')::integer,
      coalesce(v_item.value ->> 'condition_note', '')
    );
  end loop;

  return v_return_request_id;
end;
$$;

revoke all on function private.request_return(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.request_return(uuid, text, jsonb) to authenticated;

create or replace function public.request_return(
  p_order_id uuid,
  p_reason text,
  p_items jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.request_return(p_order_id, p_reason, p_items);
$$;

revoke all on function public.request_return(uuid, text, jsonb) from public, anon;
grant execute on function public.request_return(uuid, text, jsonb) to authenticated;

create or replace function private.guard_return_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.return_number is distinct from old.return_number
     or new.order_id is distinct from old.order_id
     or new.customer_id is distinct from old.customer_id
     or new.reason is distinct from old.reason
     or new.requested_at is distinct from old.requested_at then
    raise exception using errcode = '23514', message = 'Return request identity and reason are immutable';
  end if;

  if new.status = old.status then
    return new;
  end if;
  if not (
    (old.status = 'requested' and new.status in ('approved', 'rejected'))
    or (old.status = 'approved' and new.status in ('received', 'closed'))
    or (old.status = 'received' and new.status in ('refunded', 'closed'))
    or (old.status = 'refunded' and new.status = 'closed')
  ) then
    raise exception using errcode = '23514', message = 'Invalid return status transition';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_return_request_update() from public, anon, authenticated;

drop trigger if exists return_requests_guard_update on public.return_requests;
create trigger return_requests_guard_update
  before update on public.return_requests
  for each row execute function private.guard_return_request_update();

-- Tighten client policies. RLS remains enabled and all protected writes use an RPC.
drop policy if exists organizations_insert_self on public.organizations;
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
  using ((select private.is_org_admin(id)) or (select private.has_any_staff_role(array['super_admin']::public.app_role[])))
  with check ((select private.org_creator_matches(id, created_by)) or
    (select private.has_any_staff_role(array['super_admin']::public.app_role[])));

drop policy if exists organization_memberships_insert_owner_or_admin on public.organization_memberships;
create policy organization_memberships_insert_owner_or_admin on public.organization_memberships for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and role in ('buyer', 'viewer')
    and ((select private.is_org_admin(organization_id))
      or (select private.has_any_staff_role(array['super_admin']::public.app_role[])))
  );

drop policy if exists organization_memberships_delete_self_or_admin on public.organization_memberships;
create policy organization_memberships_delete_self_or_admin on public.organization_memberships for delete to authenticated
  using (
    role in ('buyer', 'viewer')
    and ((user_id = (select auth.uid()))
      or (select private.is_org_admin(organization_id))
      or (select private.has_any_staff_role(array['super_admin']::public.app_role[])))
  );

drop policy if exists warehouses_staff_only on public.warehouses;
create policy warehouses_staff_read on public.warehouses for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
drop policy if exists inventory_staff_only on public.inventory;
create policy inventory_staff_read on public.inventory for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists orders_manage_staff on public.orders;
drop policy if exists order_items_manage_staff on public.order_items;
drop policy if exists orders_read_owner_or_staff on public.orders;
create policy orders_read_owner_or_staff on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or
    (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])));

drop policy if exists order_items_read_owner_or_staff on public.order_items;
create policy order_items_read_owner_or_staff on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid()) or
       (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])))
  ));

drop policy if exists order_events_read_owner_or_staff on public.order_events;
create policy order_events_read_owner_or_staff on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid()) or
       (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])))
  ));

drop policy if exists payments_staff_only on public.payment_transactions;
create policy payments_read_owner_or_staff on public.payment_transactions for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid()) or
       (select private.has_any_staff_role(array['fulfillment_manager', 'sales_manager', 'super_admin']::public.app_role[])))
  ));

drop policy if exists crm_leads_staff_update on public.crm_leads;

-- The customer-facing return RPC is the only insertion path; staff may change status only.
drop policy if exists return_requests_insert_owner on public.return_requests;
drop policy if exists return_items_insert_owner on public.return_items;
drop policy if exists return_items_manage_staff on public.return_items;
create policy inventory_movements_staff_read on public.inventory_movements for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

revoke insert on public.organizations from anon, authenticated;
revoke update on public.organization_memberships from anon, authenticated;
revoke insert, update, delete on public.organizations, public.organization_memberships
  from anon, service_role;

revoke insert, update, delete on public.warehouses, public.inventory,
  public.orders, public.order_items, public.payment_transactions,
  public.inventory_reservations, public.order_events
  from anon, authenticated, service_role;
grant select on public.warehouses, public.inventory, public.orders, public.order_items,
  public.payment_transactions, public.inventory_reservations, public.order_events
  to authenticated, service_role;

revoke insert, update, delete on public.inventory_movements from anon, authenticated, service_role;
grant select on public.inventory_movements to authenticated, service_role;

revoke insert, delete on public.return_requests from anon, authenticated, service_role;
revoke insert, update, delete on public.return_items from anon, authenticated, service_role;
grant select, update on public.return_requests to authenticated;
grant select on public.return_items to authenticated, service_role;

revoke all on public.crm_leads from anon, authenticated;
grant select on public.crm_leads to authenticated;
grant insert (contact_name, email, phone, company, message, consent_to_contact)
  on public.crm_leads to anon, authenticated;

grant usage on schema private to authenticated, service_role;
