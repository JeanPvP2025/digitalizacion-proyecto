-- Support intake and return request invariants.
-- Public support requests remain local-demo only because support_tickets is
-- owned by an authenticated account and the schema has no verified public identity.

-- Ticket creation must always include its initial customer message. Revoke the
-- direct insert path and expose a narrowly-scoped transactional RPC instead.
revoke insert on public.support_tickets from anon, authenticated, service_role;

drop policy if exists support_tickets_read_customer_or_staff on public.support_tickets;
create policy support_tickets_read_customer_or_staff on public.support_tickets for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (organization_id is not null and (select private.is_org_member(organization_id)))
    or (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[]))
  );

drop policy if exists support_tickets_insert_customer on public.support_tickets;
create policy support_tickets_insert_customer on public.support_tickets for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'open'
    and priority = 'normal'
    and assigned_to is null
    and (organization_id is null or (select private.is_org_member(organization_id)))
    and (
      order_id is null
      or exists (
        select 1
        from public.orders o
        where o.id = support_tickets.order_id
          and o.customer_id = (select auth.uid())
          and o.organization_id is not distinct from support_tickets.organization_id
      )
    )
  );

drop policy if exists support_messages_read_customer_or_staff on public.support_messages;
create policy support_messages_read_customer_or_staff on public.support_messages for select to authenticated
  using (exists (
    select 1 from public.support_tickets t where t.id = ticket_id and
      ((t.customer_id = (select auth.uid()) and not is_internal)
       or (t.organization_id is not null and not is_internal and (select private.is_org_member(t.organization_id)))
       or (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])))
  ));

drop policy if exists support_messages_insert_customer on public.support_messages;
drop policy if exists support_messages_insert_staff on public.support_messages;
create policy support_messages_insert_customer_or_staff on public.support_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.support_tickets t where t.id = support_messages.ticket_id and
        ((not is_internal and t.status not in ('resolved', 'closed') and
          (t.customer_id = (select auth.uid()) or
           (t.organization_id is not null and (select private.is_org_member(t.organization_id)))))
         or (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])))
    )
  );

create or replace function private.create_support_ticket(
  p_subject text,
  p_message text,
  p_order_id uuid,
  p_organization_id uuid
)
returns table(ticket_id uuid, ticket_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to open a support ticket';
  end if;
  if p_subject is null or pg_catalog.char_length(pg_catalog.btrim(p_subject)) not between 5 and 120 then
    raise exception using errcode = '22023', message = 'A support subject between 5 and 120 characters is required';
  end if;
  if p_message is null or pg_catalog.char_length(pg_catalog.btrim(p_message)) not between 20 and 2400 then
    raise exception using errcode = '22023', message = 'An initial message between 20 and 2400 characters is required';
  end if;
  if p_organization_id is not null and not private.is_org_member(p_organization_id) then
    raise exception using errcode = 'P0002', message = 'Organization not found for the current user';
  end if;

  if p_order_id is not null then
    select o.* into v_order
      from public.orders o
      where o.id = p_order_id
      for key share;
    if not found or v_order.customer_id <> v_user_id
       or v_order.organization_id is distinct from p_organization_id then
      raise exception using errcode = 'P0002', message = 'Order not found for the current user and organization';
    end if;
    if v_order.organization_id is not null and not private.is_org_member(v_order.organization_id) then
      raise exception using errcode = 'P0002', message = 'Order not found for the current user and organization';
    end if;
  end if;

  return query
  with created_ticket as (
    insert into public.support_tickets (
      customer_id, organization_id, order_id, subject, status, priority, assigned_to
    ) values (
      v_user_id, p_organization_id, p_order_id, pg_catalog.btrim(p_subject), 'open', 'normal', null
    )
    returning id, support_tickets.ticket_number
  ), created_message as (
    insert into public.support_messages (ticket_id, author_id, body, is_internal)
    select created_ticket.id, v_user_id, pg_catalog.btrim(p_message), false
      from created_ticket
    returning support_messages.ticket_id
  )
  select created_ticket.id, created_ticket.ticket_number
    from created_ticket
    join created_message on created_message.ticket_id = created_ticket.id;
end;
$$;

revoke all on function private.create_support_ticket(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function private.create_support_ticket(text, text, uuid, uuid) to authenticated;

create or replace function public.create_support_ticket(
  p_subject text,
  p_message text,
  p_order_id uuid default null,
  p_organization_id uuid default null
)
returns table(ticket_id uuid, ticket_number text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_support_ticket(p_subject, p_message, p_order_id, p_organization_id);
$$;

revoke all on function public.create_support_ticket(text, text, uuid, uuid) from public, anon;
grant execute on function public.create_support_ticket(text, text, uuid, uuid) to authenticated;

alter table public.return_requests
  add column if not exists idempotency_key uuid,
  add column if not exists request_fingerprint text;

create unique index if not exists return_requests_customer_idempotency_idx
  on public.return_requests (customer_id, idempotency_key)
  where idempotency_key is not null;

create or replace function private.request_return(
  p_order_id uuid,
  p_reason text,
  p_items jsonb,
  p_idempotency_key uuid
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
  v_existing_fingerprint text;
  v_fingerprint text;
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
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A return idempotency key is required';
  end if;
  if p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'A return reason between 10 and 2000 characters is required';
  end if;
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'Return items must be an array containing 1 to 50 lines';
  end if;

  -- Serializes quantity checks and same-order retries.
  select o.* into v_order
    from public.orders o
    where o.id = p_order_id and o.customer_id = v_user_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found for the current customer';
  end if;
  if v_order.organization_id is not null and not private.is_org_member(v_order.organization_id) then
    raise exception using errcode = 'P0002', message = 'Order not found for the current customer';
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
          or pg_catalog.char_length(coalesce(e.value ->> 'condition_note', '')) > 1000
     ) then
    raise exception using errcode = '22023', message = 'Each return line needs one order item id and a positive integer quantity';
  end if;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'order_id', p_order_id,
    'reason', pg_catalog.btrim(p_reason),
    'items', p_items
  )::text);

  select rr.id, rr.request_fingerprint
    into v_return_request_id, v_existing_fingerprint
    from public.return_requests rr
    where rr.customer_id = v_user_id and rr.idempotency_key = p_idempotency_key;
  if found then
    if v_return_request_id is null or v_existing_fingerprint is distinct from v_fingerprint
       or not exists (
         select 1 from public.return_requests rr
         where rr.id = v_return_request_id and rr.order_id = p_order_id
       ) then
      raise exception using errcode = '22023', message = 'Return idempotency key was already used with a different request';
    end if;
    return v_return_request_id;
  end if;

  -- The eligibility window is 30 calendar days elapsed from delivery, not order placement.
  if v_order.status <> 'delivered' or v_order.delivered_at is null
     or v_order.delivered_at > pg_catalog.now()
     or v_order.delivered_at < pg_catalog.now() - interval '30 days' then
    raise exception using errcode = '23514', message = 'Returns are available for 30 days after delivery';
  end if;

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

  insert into public.return_requests (
    return_number, order_id, customer_id, status, reason, idempotency_key, request_fingerprint
  ) values (
    '', p_order_id, v_user_id, 'requested', pg_catalog.btrim(p_reason), p_idempotency_key, v_fingerprint
  )
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

-- Keep the existing three-argument RPC compatible. New callers supply a stable
-- request key through the four-argument overload above.
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
  v_hash text := pg_catalog.md5(
    coalesce((select auth.uid())::text, '') || ':' ||
    coalesce(p_order_id::text, '') || ':' ||
    coalesce(pg_catalog.btrim(p_reason), '') || ':' ||
    coalesce(p_items::text, 'null')
  );
  v_idempotency_key uuid;
begin
  v_idempotency_key := (
    pg_catalog.substr(v_hash, 1, 8) || '-' ||
    pg_catalog.substr(v_hash, 9, 4) || '-' ||
    pg_catalog.substr(v_hash, 13, 4) || '-' ||
    pg_catalog.substr(v_hash, 17, 4) || '-' ||
    pg_catalog.substr(v_hash, 21, 12)
  )::uuid;
  return private.request_return(p_order_id, p_reason, p_items, v_idempotency_key);
end;
$$;

revoke all on function private.request_return(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.request_return(uuid, text, jsonb) to authenticated;
revoke all on function private.request_return(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function private.request_return(uuid, text, jsonb, uuid) to authenticated;

create or replace function public.request_return(
  p_order_id uuid,
  p_reason text,
  p_items jsonb,
  p_idempotency_key uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.request_return(p_order_id, p_reason, p_items, p_idempotency_key);
$$;

revoke all on function public.request_return(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.request_return(uuid, text, jsonb, uuid) to authenticated;
