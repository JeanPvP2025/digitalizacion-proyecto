-- Agent-side support and RMA review transitions.
-- All state changes are transaction-scoped RPCs; browser clients cannot write
-- directly to messages, ticket status, or return decisions.

alter table public.support_messages
  add column if not exists idempotency_key uuid,
  add column if not exists idempotency_fingerprint text,
  add column if not exists author_type text not null default 'customer' check (author_type in ('customer', 'agent'));

alter table public.support_tickets
  add column if not exists idempotency_key uuid,
  add column if not exists request_fingerprint text;

create unique index if not exists support_tickets_customer_idempotency_idx
  on public.support_tickets (customer_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists support_messages_author_idempotency_idx
  on public.support_messages (ticket_id, author_id, idempotency_key)
  where idempotency_key is not null;

update public.support_messages m
  set author_type = 'agent'
  where exists (
    select 1 from public.user_role_grants g
    where g.user_id = m.author_id and g.role in ('support_agent', 'super_admin')
  );

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created', 'status_changed')),
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  occurred_at timestamptz not null default now()
);

create index if not exists support_ticket_events_timeline_idx
  on public.support_ticket_events (ticket_id, occurred_at, id);

create table if not exists public.return_request_events (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('requested', 'status_changed')),
  from_status public.return_status,
  to_status public.return_status not null,
  decision_reason text not null default '' check (char_length(decision_reason) <= 1000),
  occurred_at timestamptz not null default now()
);

create index if not exists return_request_events_timeline_idx
  on public.return_request_events (return_request_id, occurred_at, id);

alter table public.return_requests
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists decision_reason text not null default '' check (char_length(decision_reason) <= 1000),
  add column if not exists review_idempotency_key uuid,
  add column if not exists review_fingerprint text;

create unique index if not exists return_requests_review_idempotency_idx
  on public.return_requests (review_idempotency_key)
  where review_idempotency_key is not null;

alter table public.support_ticket_events enable row level security;
alter table public.return_request_events enable row level security;

drop policy if exists support_ticket_events_read_owner_or_staff on public.support_ticket_events;
create policy support_ticket_events_read_owner_or_staff on public.support_ticket_events for select to authenticated
  using (exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id
      and (t.customer_id = (select auth.uid())
        or (t.organization_id is not null and (select private.is_org_member(t.organization_id)))
        or (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])))
  ));

drop policy if exists return_request_events_read_owner_or_staff on public.return_request_events;
create policy return_request_events_read_owner_or_staff on public.return_request_events for select to authenticated
  using (exists (
    select 1 from public.return_requests r
    where r.id = return_request_id
      and (r.customer_id = (select auth.uid())
        or (select private.has_any_staff_role(array['support_agent', 'fulfillment_manager', 'super_admin']::public.app_role[])))
  ));

revoke all on public.support_ticket_events, public.return_request_events from anon, authenticated, service_role;
grant select on public.support_ticket_events, public.return_request_events to authenticated, service_role;

revoke insert, update, delete on public.support_tickets, public.support_messages from anon, authenticated, service_role;
revoke insert, delete on public.return_requests from anon, authenticated, service_role;
grant select on public.support_tickets, public.support_messages, public.return_requests to authenticated, service_role;
grant update on public.return_requests to authenticated;
grant select on public.return_items to authenticated, service_role;

create or replace function private.record_support_ticket_timeline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.support_ticket_events (ticket_id, actor_id, event_type, from_status, to_status, occurred_at)
      values (new.id, (select auth.uid()), 'created', null, new.status, new.created_at);
  elsif new.status is distinct from old.status then
    insert into public.support_ticket_events (ticket_id, actor_id, event_type, from_status, to_status)
      values (new.id, (select auth.uid()), 'status_changed', old.status, new.status);
  end if;
  return new;
end;
$$;

revoke all on function private.record_support_ticket_timeline() from public, anon, authenticated, service_role;
drop trigger if exists support_tickets_record_timeline on public.support_tickets;
create trigger support_tickets_record_timeline
  after insert or update of status on public.support_tickets
  for each row execute function private.record_support_ticket_timeline();

-- Existing rows receive a baseline event at their current status. Earlier
-- transitions cannot be reconstructed because no historical event table existed.
insert into public.support_ticket_events (ticket_id, actor_id, event_type, from_status, to_status, occurred_at)
select t.id, t.customer_id, 'created', null, t.status, t.created_at
from public.support_tickets t
where not exists (
  select 1 from public.support_ticket_events e where e.ticket_id = t.id and e.event_type = 'created'
);

-- Preserve the original four-argument intake RPC and add an explicit retry key.
create or replace function private.create_support_ticket(
  p_subject text,
  p_message text,
  p_order_id uuid,
  p_organization_id uuid,
  p_idempotency_key uuid
)
returns table(ticket_id uuid, ticket_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_existing public.support_tickets%rowtype;
  v_ticket_id uuid;
  v_ticket_number text;
  v_fingerprint text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to open a support ticket';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A support ticket idempotency key is required';
  end if;
  if p_subject is null or pg_catalog.char_length(pg_catalog.btrim(p_subject)) not between 5 and 120 then
    raise exception using errcode = '22023', message = 'A support subject between 5 and 120 characters is required';
  end if;
  if p_message is null or pg_catalog.char_length(pg_catalog.btrim(p_message)) not between 20 and 2400 then
    raise exception using errcode = '22023', message = 'An initial message between 20 and 2400 characters is required';
  end if;

  -- Serialize retries for one customer before looking up the unique key.
  perform 1 from auth.users u where u.id = v_user_id for update;
  if p_organization_id is not null and not private.is_org_member(p_organization_id) then
    raise exception using errcode = 'P0002', message = 'Organization not found for the current user';
  end if;
  if p_order_id is not null then
    select o.* into v_order from public.orders o where o.id = p_order_id for key share;
    if not found or v_order.customer_id <> v_user_id
       or v_order.organization_id is distinct from p_organization_id then
      raise exception using errcode = 'P0002', message = 'Order not found for the current user and organization';
    end if;
    if v_order.organization_id is not null and not private.is_org_member(v_order.organization_id) then
      raise exception using errcode = 'P0002', message = 'Order not found for the current user and organization';
    end if;
  end if;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'subject', pg_catalog.btrim(p_subject),
    'message', pg_catalog.btrim(p_message),
    'order_id', p_order_id,
    'organization_id', p_organization_id
  )::text);
  select t.* into v_existing from public.support_tickets t
    where t.customer_id = v_user_id and t.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '22023', message = 'Support ticket idempotency key was already used with a different request';
    end if;
    return query select v_existing.id, v_existing.ticket_number;
    return;
  end if;

  insert into public.support_tickets (
    customer_id, organization_id, order_id, subject, status, priority, assigned_to,
    idempotency_key, request_fingerprint
  ) values (
    v_user_id, p_organization_id, p_order_id, pg_catalog.btrim(p_subject), 'open', 'normal', null,
    p_idempotency_key, v_fingerprint
  ) returning id, support_tickets.ticket_number into v_ticket_id, v_ticket_number;

  insert into public.support_messages (ticket_id, author_id, body, is_internal, author_type)
    values (v_ticket_id, v_user_id, pg_catalog.btrim(p_message), false, 'customer');

  return query select v_ticket_id, v_ticket_number;
end;
$$;

revoke all on function private.create_support_ticket(text, text, uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.create_support_ticket(text, text, uuid, uuid, uuid) to authenticated;

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
  v_hash text := pg_catalog.md5(
    coalesce((select auth.uid())::text, '') || ':' || coalesce(pg_catalog.btrim(p_subject), '') || ':' ||
    coalesce(pg_catalog.btrim(p_message), '') || ':' || coalesce(p_order_id::text, '') || ':' || coalesce(p_organization_id::text, '')
  );
  v_key uuid;
begin
  v_key := (pg_catalog.substr(v_hash, 1, 8) || '-' || pg_catalog.substr(v_hash, 9, 4) || '-' ||
    pg_catalog.substr(v_hash, 13, 4) || '-' || pg_catalog.substr(v_hash, 17, 4) || '-' ||
    pg_catalog.substr(v_hash, 21, 12))::uuid;
  return query select * from private.create_support_ticket(p_subject, p_message, p_order_id, p_organization_id, v_key);
end;
$$;

revoke all on function private.create_support_ticket(text, text, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.create_support_ticket(text, text, uuid, uuid) to authenticated;

create or replace function public.create_support_ticket(
  p_subject text,
  p_message text,
  p_order_id uuid,
  p_organization_id uuid,
  p_idempotency_key uuid
)
returns table(ticket_id uuid, ticket_number text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_support_ticket(p_subject, p_message, p_order_id, p_organization_id, p_idempotency_key);
$$;

revoke all on function public.create_support_ticket(text, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.create_support_ticket(text, text, uuid, uuid, uuid) to authenticated;

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

create or replace function private.record_return_request_timeline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.return_request_events (
      return_request_id, actor_id, event_type, from_status, to_status, decision_reason, occurred_at
    ) values (new.id, (select auth.uid()), 'requested', null, new.status, '', new.requested_at);
  elsif new.status is distinct from old.status then
    insert into public.return_request_events (
      return_request_id, actor_id, event_type, from_status, to_status, decision_reason
    ) values (
      new.id, (select auth.uid()), 'status_changed', old.status, new.status, new.decision_reason
    );
  end if;
  return new;
end;
$$;

revoke all on function private.record_return_request_timeline() from public, anon, authenticated, service_role;
drop trigger if exists return_requests_record_timeline on public.return_requests;
create trigger return_requests_record_timeline
  after insert or update of status on public.return_requests
  for each row execute function private.record_return_request_timeline();

insert into public.return_request_events (
  return_request_id, actor_id, event_type, from_status, to_status, decision_reason, occurred_at
)
select r.id, r.customer_id, 'requested', null, 'requested', '', r.requested_at
from public.return_requests r
where not exists (
  select 1 from public.return_request_events e where e.return_request_id = r.id and e.event_type = 'requested'
);

insert into public.return_request_events (
  return_request_id, actor_id, event_type, from_status, to_status, decision_reason, occurred_at
)
select r.id, r.reviewed_by, 'status_changed', 'requested', r.status, r.decision_reason, r.updated_at
from public.return_requests r
where r.status <> 'requested'
  and not exists (
    select 1 from public.return_request_events e
    where e.return_request_id = r.id and e.event_type = 'status_changed'
  );

create or replace function private.send_support_message(
  p_ticket_id uuid,
  p_body text,
  p_next_status public.ticket_status,
  p_idempotency_key uuid
)
returns table(message_id uuid, ticket_status public.ticket_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ticket public.support_tickets%rowtype;
  v_message_id uuid;
  v_existing_fingerprint text;
  v_fingerprint text;
  v_is_staff boolean;
  v_next_status public.ticket_status;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to reply to a support ticket';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A message idempotency key is required';
  end if;
  if p_body is null or pg_catalog.char_length(pg_catalog.btrim(p_body)) not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'A support message between 1 and 10000 characters is required';
  end if;

  v_is_staff := private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[]);
  select t.* into v_ticket
    from public.support_tickets t
    where t.id = p_ticket_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Support ticket not found';
  end if;
  if not v_is_staff and not (
    v_ticket.customer_id = v_user_id
    or (v_ticket.organization_id is not null and private.is_org_member(v_ticket.organization_id))
  ) then
    raise exception using errcode = 'P0002', message = 'Support ticket not found';
  end if;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'body', pg_catalog.btrim(p_body),
    'next_status', p_next_status
  )::text);
  select m.id, m.idempotency_fingerprint into v_message_id, v_existing_fingerprint
    from public.support_messages m
    where m.ticket_id = p_ticket_id
      and m.author_id = v_user_id
      and m.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '22023', message = 'Message idempotency key was already used with a different payload';
    end if;
    return query select v_message_id, v_ticket.status;
    return;
  end if;

  if v_is_staff then
    if p_next_status is null then
      v_next_status := v_ticket.status;
    else
      v_next_status := p_next_status;
    end if;
    if v_ticket.status = 'closed'
       or (v_ticket.status = 'resolved' and v_next_status <> 'closed')
       or (v_next_status <> v_ticket.status and not (
         (v_ticket.status = 'open' and v_next_status in ('in_progress', 'waiting_customer', 'resolved', 'closed'))
         or (v_ticket.status = 'in_progress' and v_next_status in ('waiting_customer', 'resolved', 'closed'))
         or (v_ticket.status = 'waiting_customer' and v_next_status in ('in_progress', 'resolved', 'closed'))
         or (v_ticket.status = 'resolved' and v_next_status = 'closed')
       )) then
      raise exception using errcode = '23514', message = 'Invalid support ticket status transition';
    end if;
  else
    if p_next_status is not null then
      raise exception using errcode = '42501', message = 'Only support agents may change ticket status';
    end if;
    if v_ticket.status in ('resolved', 'closed') then
      raise exception using errcode = '23514', message = 'This support ticket no longer accepts replies';
    end if;
    v_next_status := case when v_ticket.status = 'waiting_customer' then 'open'::public.ticket_status else v_ticket.status end;
  end if;

  insert into public.support_messages (ticket_id, author_id, body, is_internal, author_type, idempotency_key, idempotency_fingerprint)
    values (p_ticket_id, v_user_id, pg_catalog.btrim(p_body), false, case when v_is_staff then 'agent' else 'customer' end, p_idempotency_key, v_fingerprint)
    returning id into v_message_id;

  if v_next_status is distinct from v_ticket.status then
    update public.support_tickets set status = v_next_status where id = p_ticket_id;
  end if;

  return query select v_message_id, v_next_status;
end;
$$;

revoke all on function private.send_support_message(uuid, text, public.ticket_status, uuid) from public, anon, authenticated, service_role;
grant execute on function private.send_support_message(uuid, text, public.ticket_status, uuid) to authenticated;

create or replace function public.send_support_message(
  p_ticket_id uuid,
  p_body text,
  p_next_status public.ticket_status,
  p_idempotency_key uuid
)
returns table(message_id uuid, ticket_status public.ticket_status)
language sql
security invoker
set search_path = ''
as $$
  select * from private.send_support_message(p_ticket_id, p_body, p_next_status, p_idempotency_key);
$$;

revoke all on function public.send_support_message(uuid, text, public.ticket_status, uuid) from public, anon;
grant execute on function public.send_support_message(uuid, text, public.ticket_status, uuid) to authenticated;

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
     or new.requested_at is distinct from old.requested_at
     or new.idempotency_key is distinct from old.idempotency_key
     or new.request_fingerprint is distinct from old.request_fingerprint then
    raise exception using errcode = '23514', message = 'Return request identity and reason are immutable';
  end if;

  if new.status = old.status then
    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.decision_reason is distinct from old.decision_reason
       or new.review_idempotency_key is distinct from old.review_idempotency_key
       or new.review_fingerprint is distinct from old.review_fingerprint then
      raise exception using errcode = '23514', message = 'Return review fields can only be set with the initial decision';
    end if;
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

  if old.status = 'requested' and new.status in ('approved', 'rejected') then
    if new.reviewed_by is distinct from (select auth.uid())
       or new.reviewed_at is null
       or new.review_idempotency_key is null
       or new.review_fingerprint is null
       or pg_catalog.current_setting('nodria.support_return_review', true) is distinct from 'on'
       or not private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[]) then
      raise exception using errcode = '42501', message = 'A support agent decision is required';
    end if;
    if new.status = 'rejected' and pg_catalog.char_length(pg_catalog.btrim(new.decision_reason)) not between 10 and 1000 then
      raise exception using errcode = '22023', message = 'A rejection reason between 10 and 1000 characters is required';
    end if;
  elsif new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.decision_reason is distinct from old.decision_reason
     or new.review_idempotency_key is distinct from old.review_idempotency_key
     or new.review_fingerprint is distinct from old.review_fingerprint then
    raise exception using errcode = '23514', message = 'Return review fields are immutable after decision';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_return_request_update() from public, anon, authenticated, service_role;
drop trigger if exists return_requests_guard_update on public.return_requests;
create trigger return_requests_guard_update
  before update on public.return_requests
  for each row execute function private.guard_return_request_update();

create or replace function private.review_return_request(
  p_return_request_id uuid,
  p_decision public.return_status,
  p_decision_reason text,
  p_idempotency_key uuid
)
returns table(return_request_id uuid, return_status public.return_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid;
  v_request public.return_requests%rowtype;
  v_fingerprint text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to review a return';
  end if;
  if not private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'A support agent role is required to review a return';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'A return review decision must be approved or rejected';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A review idempotency key is required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_decision_reason, ''))) > 1000
     or (p_decision = 'rejected' and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_decision_reason, ''))) not between 10 and 1000) then
    raise exception using errcode = '22023', message = 'A rejection reason between 10 and 1000 characters is required';
  end if;

  select r.order_id into v_order_id
    from public.return_requests r where r.id = p_return_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Return request not found';
  end if;
  -- `request_return` locks this same order while validating cumulative units.
  -- Taking the order lock first keeps reviews serialized with concurrent intake.
  perform 1 from public.orders o where o.id = v_order_id for update;
  select r.* into v_request
    from public.return_requests r
    where r.id = p_return_request_id and r.order_id = v_order_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Return request not found';
  end if;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'decision', p_decision,
    'reason', pg_catalog.btrim(coalesce(p_decision_reason, ''))
  )::text);
  if v_request.review_idempotency_key = p_idempotency_key then
    if v_request.review_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '22023', message = 'Review idempotency key was already used with a different decision';
    end if;
    return query select v_request.id, v_request.status;
    return;
  end if;
  if v_request.status <> 'requested' then
    raise exception using errcode = '23514', message = 'This return request already has a decision';
  end if;

  if exists (
    select 1
    from public.return_items ri
    join public.return_requests rr on rr.id = ri.return_request_id
    join public.order_items oi on oi.id = ri.order_item_id and oi.order_id = rr.order_id
    where rr.order_id = v_order_id and rr.status <> 'rejected'
    group by ri.order_item_id
    having pg_catalog.sum(ri.quantity) > pg_catalog.max(oi.quantity)
  ) then
    raise exception using errcode = '23514', message = 'Return quantities exceed the purchased quantity';
  end if;

  perform pg_catalog.set_config('nodria.support_return_review', 'on', true);
  update public.return_requests
    set status = p_decision,
        reviewed_by = v_user_id,
        reviewed_at = pg_catalog.now(),
        decision_reason = pg_catalog.btrim(coalesce(p_decision_reason, '')),
        review_idempotency_key = p_idempotency_key,
        review_fingerprint = v_fingerprint
    where id = v_request.id;

  return query select v_request.id, p_decision;
end;
$$;

revoke all on function private.review_return_request(uuid, public.return_status, text, uuid) from public, anon, authenticated, service_role;
grant execute on function private.review_return_request(uuid, public.return_status, text, uuid) to authenticated;

create or replace function public.review_return_request(
  p_return_request_id uuid,
  p_decision public.return_status,
  p_decision_reason text,
  p_idempotency_key uuid
)
returns table(return_request_id uuid, return_status public.return_status)
language sql
security invoker
set search_path = ''
as $$
  select * from private.review_return_request(p_return_request_id, p_decision, p_decision_reason, p_idempotency_key);
$$;

revoke all on function public.review_return_request(uuid, public.return_status, text, uuid) from public, anon;
grant execute on function public.review_return_request(uuid, public.return_status, text, uuid) to authenticated;
