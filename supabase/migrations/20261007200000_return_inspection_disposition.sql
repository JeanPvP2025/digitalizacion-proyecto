-- A warehouse disposition is the only transition that may move approved
-- return quantities from pending inspection into the physical stock ledger.

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
    check (movement_type in ('receipt', 'adjustment', 'sale', 'return_restock'));
alter table public.inventory_movements
  add column if not exists return_request_id uuid references public.return_requests(id) on delete restrict,
  add column if not exists return_item_id uuid references public.return_items(id) on delete restrict,
  add constraint inventory_movements_return_source_pair_check
    check ((return_request_id is null) = (return_item_id is null));
create unique index if not exists inventory_movements_return_item_unique_idx
  on public.inventory_movements (return_item_id)
  where return_item_id is not null;

create table if not exists private.return_inspection_attempts (
  idempotency_key uuid primary key,
  return_request_id uuid not null references public.return_requests(id) on delete restrict,
  return_item_id uuid not null unique references public.return_items(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  request_fingerprint text not null,
  disposition text not null check (disposition in ('restocked', 'disposed')),
  quantity integer not null check (quantity > 0),
  movement_id bigint references public.inventory_movements(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 500),
  inspected_by uuid not null references auth.users(id) on delete restrict,
  inspected_at timestamptz not null default now(),
  constraint return_inspection_attempts_movement_check
    check ((disposition = 'restocked') = (movement_id is not null))
);

revoke all on private.return_inspection_attempts from public, anon, authenticated, service_role;

create or replace function private.guard_return_item_disposition_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.inventory_disposition is distinct from old.inventory_disposition
     or new.inspection_quantity is distinct from old.inspection_quantity then
    if old.inventory_disposition = 'not_applicable' then
      if new.inventory_disposition <> 'pending_inspection'
         or old.inspection_quantity <> 0
         or new.inspection_quantity <> new.quantity
         or pg_catalog.current_setting('nodria.support_return_review', true) is distinct from 'on'
         or not private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])
         or not exists (
           select 1 from public.return_requests r
           where r.id = new.return_request_id and r.status = 'approved'
         ) then
        raise exception using errcode = '42501', message = 'Support approval is the only path to pending inspection';
      end if;
    elsif old.inventory_disposition = 'pending_inspection' then
      if new.inventory_disposition not in ('restocked', 'disposed')
         or new.inspection_quantity is distinct from old.inspection_quantity
         or new.inspection_quantity < 1
         or pg_catalog.current_setting('nodria.warehouse_return_inspection', true) is distinct from 'on'
         or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])
         or not exists (
           select 1 from public.return_requests r
           where r.id = new.return_request_id and r.status = 'approved'
         ) then
        raise exception using errcode = '42501', message = 'Warehouse inspection is required to dispose returned units';
      end if;
    else
      raise exception using errcode = '23514', message = 'A completed return disposition cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_return_item_disposition_update() from public, anon, authenticated, service_role;

create or replace function private.guard_return_request_close_after_inspection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'approved' and new.status = 'closed' then
    if pg_catalog.current_setting('nodria.warehouse_return_inspection', true) is distinct from 'on'
       or not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])
       or exists (
         select 1 from public.return_items ri
         where ri.return_request_id = old.id
           and ri.inventory_disposition not in ('restocked', 'disposed')
       ) then
      raise exception using errcode = '42501', message = 'Only a completed warehouse inspection can close an approved return';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_return_request_close_after_inspection() from public, anon, authenticated, service_role;
drop trigger if exists return_requests_guard_close_after_inspection on public.return_requests;
create trigger return_requests_guard_close_after_inspection
  before update of status on public.return_requests
  for each row execute function private.guard_return_request_close_after_inspection();

create or replace function private.inspect_return_item(
  p_return_request_id uuid,
  p_return_item_id uuid,
  p_warehouse_id uuid,
  p_disposition text,
  p_quantity integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (
  return_request_id uuid,
  return_item_id uuid,
  disposition text,
  quantity integer,
  inventory_movement_id bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.return_requests%rowtype;
  v_return_item public.return_items%rowtype;
  v_order_item public.order_items%rowtype;
  v_existing private.return_inspection_attempts%rowtype;
  v_fingerprint text;
  v_on_hand integer;
  v_movement_id bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to inspect returned items';
  end if;
  if not private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'Warehouse staff access is required to inspect returned items';
  end if;
  if p_idempotency_key is null or p_disposition not in ('restocked', 'disposed')
     or p_quantity is null or p_quantity < 1
     or p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'Inspection disposition, quantity, reason and idempotency key are required';
  end if;
  if not exists (select 1 from public.warehouses w where w.id = p_warehouse_id and w.is_active) then
    raise exception using errcode = 'P0002', message = 'Active inspection warehouse not found';
  end if;

  select r.* into v_request
    from public.return_requests r
    where r.id = p_return_request_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Return request not found';
  end if;

  select ri.* into v_return_item
    from public.return_items ri
    where ri.id = p_return_item_id and ri.return_request_id = v_request.id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Return item not found in this request';
  end if;
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'return_request_id', v_request.id,
    'return_item_id', v_return_item.id,
    'warehouse_id', p_warehouse_id,
    'disposition', p_disposition,
    'quantity', p_quantity,
    'reason', pg_catalog.btrim(p_reason)
  )::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text, 0));
  select a.* into v_existing
    from private.return_inspection_attempts a
    where a.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'Inspection idempotency key was reused with different data';
    end if;
    return query select v_existing.return_request_id, v_existing.return_item_id,
      v_existing.disposition, v_existing.quantity, v_existing.movement_id, true;
    return;
  end if;
  if v_request.status <> 'approved' then
    raise exception using errcode = '23514', message = 'Only approved returns can be inspected';
  end if;
  if exists (
    select 1 from private.return_inspection_attempts a
    where a.return_item_id = v_return_item.id
  ) then
    raise exception using errcode = '23505', message = 'This return item already has a completed inspection';
  end if;
  if v_return_item.inventory_disposition <> 'pending_inspection'
     or p_quantity <> v_return_item.inspection_quantity
     or p_quantity > v_return_item.quantity then
    raise exception using errcode = '23514', message = 'Inspection quantity must equal the approved quantity still pending';
  end if;

  select oi.* into v_order_item
    from public.order_items oi
    where oi.id = v_return_item.order_item_id and oi.order_id = v_request.order_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Original order line not found';
  end if;

  if p_disposition = 'restocked' then
    if v_order_item.variant_id is null then
      raise exception using errcode = '23514', message = 'This historical order line has no sellable variant to restock';
    end if;
    update public.inventory i
      set on_hand = i.on_hand + p_quantity
      where i.warehouse_id = p_warehouse_id and i.variant_id = v_order_item.variant_id
      returning i.on_hand into v_on_hand;
    if not found then
      raise exception using errcode = 'P0002', message = 'No inventory row exists for this variant and warehouse';
    end if;
    insert into public.inventory_movements (
      warehouse_id, variant_id, movement_type, quantity_delta, on_hand_after, reason,
      actor_user_id, order_id, order_item_id, idempotency_key, request_fingerprint,
      return_request_id, return_item_id
    ) values (
      p_warehouse_id, v_order_item.variant_id, 'return_restock', p_quantity, v_on_hand,
      'Devolución inspeccionada: ' || pg_catalog.btrim(p_reason),
      v_user_id, v_request.order_id, v_order_item.id, p_idempotency_key, v_fingerprint,
      v_request.id, v_return_item.id
    ) returning id into v_movement_id;
  end if;

  insert into private.return_inspection_attempts (
    idempotency_key, return_request_id, return_item_id, warehouse_id,
    request_fingerprint, disposition, quantity, movement_id, reason, inspected_by
  ) values (
    p_idempotency_key, v_request.id, v_return_item.id, p_warehouse_id,
    v_fingerprint, p_disposition, p_quantity, v_movement_id, pg_catalog.btrim(p_reason), v_user_id
  );

  perform pg_catalog.set_config('nodria.warehouse_return_inspection', 'on', true);
  update public.return_items
    set inventory_disposition = p_disposition
    where id = v_return_item.id;
  insert into public.return_request_events (
    return_request_id, actor_id, event_type, from_status, to_status, decision_reason, details
  ) values (
    v_request.id, v_user_id, 'inspection_completed', 'approved', 'approved', pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object(
      'return_item_id', v_return_item.id,
      'warehouse_id', p_warehouse_id,
      'disposition', p_disposition,
      'quantity', p_quantity,
      'inventory_movement_id', v_movement_id
    )
  );
  if not exists (
    select 1 from public.return_items ri
    where ri.return_request_id = v_request.id
      and ri.inventory_disposition not in ('restocked', 'disposed')
  ) then
    update public.return_requests
      set status = 'closed'
      where id = v_request.id;
  end if;
  return query select v_request.id, v_return_item.id, p_disposition, p_quantity, v_movement_id, false;
end;
$$;

revoke all on function private.inspect_return_item(uuid, uuid, uuid, text, integer, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.inspect_return_item(uuid, uuid, uuid, text, integer, text, uuid)
  to authenticated;

create function public.inspect_return_item(
  p_return_request_id uuid,
  p_return_item_id uuid,
  p_warehouse_id uuid,
  p_disposition text,
  p_quantity integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (
  return_request_id uuid,
  return_item_id uuid,
  disposition text,
  quantity integer,
  inventory_movement_id bigint,
  replayed boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.inspect_return_item(
    p_return_request_id, p_return_item_id, p_warehouse_id,
    p_disposition, p_quantity, p_reason, p_idempotency_key
  );
$$;

revoke all on function public.inspect_return_item(uuid, uuid, uuid, text, integer, text, uuid) from public, anon;
grant execute on function public.inspect_return_item(uuid, uuid, uuid, text, integer, text, uuid) to authenticated;

alter table public.return_request_events
  drop constraint if exists return_request_events_event_type_check;
alter table public.return_request_events
  add constraint return_request_events_event_type_check
    check (event_type in ('requested', 'status_changed', 'business_effects_recorded', 'inspection_completed'));
