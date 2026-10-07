-- Persist picking and packing before the existing inventory-consuming dispatch transition.
-- Each action is serialized on its order row and may be safely replayed.

create unique index if not exists order_events_fulfillment_stage_once_idx
  on public.order_events (order_id, event_key)
  where event_key in (
    'order_picking_started',
    'order_packed',
    'order_shipped'
  );

create or replace function private.require_fulfillment_actor(p_actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.user_role_grants g
    where g.user_id = p_actor_user_id
      and g.role in ('fulfillment_manager', 'super_admin')
  ) then
    raise exception using errcode = '42501', message = 'An authorized fulfillment actor is required';
  end if;
end;
$$;

revoke all on function private.require_fulfillment_actor(uuid) from public, anon, authenticated, service_role;

create or replace function private.assert_order_fulfillment_ready(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.payment_transactions pt
    where pt.order_id = p_order_id and pt.status = 'paid'
  ) then
    raise exception using errcode = '23514', message = 'Only a confirmed paid order can be fulfilled';
  end if;

  if not exists (
    select 1 from public.order_items oi where oi.order_id = p_order_id
  ) then
    raise exception using errcode = '23514', message = 'An order without items cannot be fulfilled';
  end if;

  if exists (
    select oi.id
    from public.order_items oi
    left join public.inventory_reservations ir on ir.order_item_id = oi.id
    where oi.order_id = p_order_id
    group by oi.id, oi.quantity
    having coalesce(sum(ir.quantity) filter (
      where ir.released_at is null and ir.fulfilled_at is null
    ), 0) <> oi.quantity
  ) then
    raise exception using errcode = '23514', message = 'Active reservations do not match the order quantities';
  end if;

  if exists (
    select 1
    from public.inventory i
    where exists (
      select 1
      from public.inventory_reservations target_ir
      join public.order_items target_oi on target_oi.id = target_ir.order_item_id
      where target_oi.order_id = p_order_id
        and target_ir.warehouse_id = i.warehouse_id
        and target_ir.variant_id = i.variant_id
        and target_ir.released_at is null
        and target_ir.fulfilled_at is null
    )
      and i.reserved <> coalesce((
        select sum(ir.quantity)
        from public.inventory_reservations ir
        where ir.warehouse_id = i.warehouse_id
          and ir.variant_id = i.variant_id
          and ir.released_at is null
          and ir.fulfilled_at is null
      ), 0)
  ) then
    raise exception using errcode = '23514', message = 'Inventory reservation balance is inconsistent';
  end if;
end;
$$;

revoke all on function private.assert_order_fulfillment_ready(uuid) from public, anon, authenticated, service_role;

create or replace function public.start_order_picking(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform private.require_fulfillment_actor(p_actor_user_id);

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  if exists (
    select 1 from public.order_events e
    where e.order_id = p_order_id and e.event_key = 'order_picking_started'
  ) then
    return 'picking';
  end if;

  if v_order.status not in ('paid', 'processing') then
    raise exception using errcode = '23514', message = 'Only a paid order can start picking';
  end if;

  perform private.lock_order_stock_rows(p_order_id);
  perform private.assert_order_fulfillment_ready(p_order_id);

  if exists (
    select 1 from public.order_events e
    where e.order_id = p_order_id and e.event_key in ('order_packed', 'order_shipped')
  ) then
    raise exception using errcode = '23514', message = 'Picking cannot start after packing or dispatch';
  end if;

  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
  values (
    p_order_id,
    p_actor_user_id,
    'order_picking_started',
    'Picking iniciado; pago y reservas verificados.',
    '{"stage":"picking"}'::jsonb
  );

  return 'picking';
end;
$$;

revoke all on function public.start_order_picking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_order_picking(uuid, uuid) to service_role;

create or replace function public.pack_order(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  perform private.require_fulfillment_actor(p_actor_user_id);

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  if exists (
    select 1 from public.order_events e
    where e.order_id = p_order_id and e.event_key = 'order_packed'
  ) then
    return 'packed';
  end if;

  if v_order.status not in ('paid', 'processing')
     or not exists (
       select 1 from public.order_events e
       where e.order_id = p_order_id and e.event_key = 'order_picking_started'
     ) then
    raise exception using errcode = '23514', message = 'An order must be picked before it can be packed';
  end if;

  perform private.lock_order_stock_rows(p_order_id);
  perform private.assert_order_fulfillment_ready(p_order_id);

  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
  values (
    p_order_id,
    p_actor_user_id,
    'order_packed',
    'Pedido empaquetado; pago y reservas verificados.',
    '{"stage":"packed"}'::jsonb
  );

  return 'packed';
end;
$$;

revoke all on function public.pack_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pack_order(uuid, uuid) to service_role;

create or replace function public.dispatch_order(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_status public.order_status;
begin
  perform private.require_fulfillment_actor(p_actor_user_id);

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  if v_order.status = 'shipped' and exists (
    select 1 from public.order_events e
    where e.order_id = p_order_id and e.event_key = 'order_shipped'
  ) then
    return 'shipped'::public.order_status;
  end if;

  if v_order.status not in ('paid', 'processing')
     or not exists (
       select 1 from public.order_events e
       where e.order_id = p_order_id and e.event_key = 'order_picking_started'
     )
     or not exists (
       select 1 from public.order_events e
       where e.order_id = p_order_id and e.event_key = 'order_packed'
     ) then
    raise exception using errcode = '23514', message = 'An order must be picked and packed before dispatch';
  end if;

  perform private.lock_order_stock_rows(p_order_id);
  perform private.assert_order_fulfillment_ready(p_order_id);

  -- Keep the existing transaction that consumes the reservation and writes the sale ledger.
  v_status := private.fulfill_order(p_order_id);
  update public.order_events e
  set actor_user_id = p_actor_user_id
  where e.id = (
    select shipped.id
    from public.order_events shipped
    where shipped.order_id = p_order_id and shipped.event_key = 'order_shipped'
    order by shipped.occurred_at desc, shipped.id desc
    limit 1
  ) and e.actor_user_id is null;

  return v_status;
end;
$$;

revoke all on function public.dispatch_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dispatch_order(uuid, uuid) to service_role;

create or replace function public.confirm_order_delivery(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_status public.order_status;
begin
  perform private.require_fulfillment_actor(p_actor_user_id);

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;
  if v_order.status = 'delivered' then
    return 'delivered'::public.order_status;
  end if;
  if v_order.status <> 'shipped' then
    raise exception using errcode = '23514', message = 'Only a shipped order can be confirmed as delivered';
  end if;

  v_status := private.mark_order_delivered(p_order_id);
  update public.order_events e
  set actor_user_id = p_actor_user_id
  where e.id = (
    select delivered.id
    from public.order_events delivered
    where delivered.order_id = p_order_id and delivered.event_key = 'order_delivered'
    order by delivered.occurred_at desc, delivered.id desc
    limit 1
  ) and e.actor_user_id is null;

  return v_status;
end;
$$;

revoke all on function public.confirm_order_delivery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_order_delivery(uuid, uuid) to service_role;
