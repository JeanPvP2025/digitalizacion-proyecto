-- Approved returns create a simulated refund and put the reported units into
-- pending inspection. They do not change physical stock before warehouse QA.

alter table public.return_items
  add column if not exists inventory_disposition text not null default 'not_applicable'
    check (inventory_disposition in ('not_applicable', 'pending_inspection', 'restocked', 'disposed')),
  add column if not exists inspection_quantity integer not null default 0
    check (inspection_quantity >= 0 and inspection_quantity <= quantity);

create table if not exists public.return_refunds (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null unique references public.return_requests(id) on delete restrict,
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'simulated' check (status = 'simulated'),
  idempotency_key uuid not null unique,
  request_fingerprint text not null,
  processed_by uuid not null references auth.users(id) on delete restrict,
  processed_at timestamptz not null default now()
);

create index if not exists return_refunds_payment_idx
  on public.return_refunds (payment_transaction_id, processed_at desc);
create index if not exists return_refunds_actor_idx
  on public.return_refunds (processed_by, processed_at desc);

alter table public.return_refunds enable row level security;
drop policy if exists return_refunds_owner_or_staff_read on public.return_refunds;
create policy return_refunds_owner_or_staff_read on public.return_refunds for select to authenticated
  using (exists (
    select 1 from public.return_requests r
    where r.id = return_request_id
      and (r.customer_id = (select auth.uid())
        or (select private.has_any_staff_role(array['support_agent', 'fulfillment_manager', 'super_admin']::public.app_role[])))
  ));
revoke all on public.return_refunds from anon, authenticated, service_role;
grant select on public.return_refunds to authenticated, service_role;

alter table public.return_request_events
  add column if not exists details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object');
alter table public.return_request_events
  drop constraint if exists return_request_events_event_type_check;
alter table public.return_request_events
  add constraint return_request_events_event_type_check
    check (event_type in ('requested', 'status_changed', 'business_effects_recorded'));

create or replace function private.guard_return_item_disposition_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.inventory_disposition is distinct from old.inventory_disposition
     or new.inspection_quantity is distinct from old.inspection_quantity then
    if old.inventory_disposition <> 'not_applicable'
       or old.inspection_quantity <> 0
       or new.inventory_disposition <> 'pending_inspection'
       or new.inspection_quantity <> new.quantity
       or pg_catalog.current_setting('nodria.support_return_review', true) is distinct from 'on'
       or not private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])
       or not exists (
         select 1 from public.return_requests r
         where r.id = new.return_request_id and r.status = 'approved'
       ) then
      raise exception using errcode = '42501', message = 'Approved returns can only be placed in pending inspection by support';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_return_item_disposition_update() from public, anon, authenticated, service_role;
drop trigger if exists return_items_guard_disposition_update on public.return_items;
create trigger return_items_guard_disposition_update
  before update on public.return_items
  for each row execute function private.guard_return_item_disposition_update();

drop function if exists public.review_return_request(uuid, public.return_status, text, uuid);
drop function if exists private.review_return_request(uuid, public.return_status, text, uuid);

create function private.review_return_request(
  p_return_request_id uuid,
  p_decision public.return_status,
  p_decision_reason text,
  p_idempotency_key uuid
)
returns table(
  return_request_id uuid,
  return_status public.return_status,
  refund_amount numeric(12,2),
  refund_currency text,
  inventory_pending_inspection_quantity integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_request public.return_requests%rowtype;
  v_payment public.payment_transactions%rowtype;
  v_fingerprint text;
  v_gross_return numeric(12,2);
  v_merchandise_total numeric(12,2);
  v_refund_amount numeric(12,2);
  v_previously_refunded numeric(12,2);
  v_return_quantity integer;
  v_pending_quantity integer;
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

  -- request_return takes this order lock as well, so eligibility and cumulative
  -- unit checks cannot race an approval for the same order.
  select o.* into v_order from public.orders o where o.id = v_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Return order not found';
  end if;
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
    select f.amount, f.currency into refund_amount, refund_currency
      from public.return_refunds f where f.return_request_id = v_request.id;
    select coalesce(sum(ri.inspection_quantity), 0)::integer into inventory_pending_inspection_quantity
      from public.return_items ri
      where ri.return_request_id = v_request.id and ri.inventory_disposition = 'pending_inspection';
    return_request_id := v_request.id;
    return_status := v_request.status;
    replayed := true;
    return next;
    return;
  end if;
  if v_request.status <> 'requested' then
    raise exception using errcode = '23514', message = 'This return request already has a decision';
  end if;

  if p_decision = 'approved' then
    if v_order.status <> 'delivered' or v_order.delivered_at is null or v_order.delivered_at > pg_catalog.now() then
      raise exception using errcode = '23514', message = 'Only a delivered order can be approved for return';
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

    select
      coalesce(sum(oi.unit_price * ri.quantity), 0)::numeric(12,2),
      coalesce(sum(oi.line_total), 0)::numeric(12,2),
      coalesce(sum(ri.quantity), 0)::integer
      into v_gross_return, v_merchandise_total, v_return_quantity
      from public.return_items ri
      join public.order_items oi on oi.id = ri.order_item_id
      where ri.return_request_id = v_request.id and oi.order_id = v_order_id;
    if v_return_quantity < 1 then
      raise exception using errcode = '23514', message = 'A return must contain purchased units';
    end if;

    select pt.* into v_payment
      from public.payment_transactions pt
      where pt.order_id = v_order_id and pt.status = 'paid' and pt.provider = 'demo'
      order by pt.processed_at desc nulls last, pt.created_at desc, pt.id
      limit 1
      for update;
    if not found or v_payment.amount <> v_order.grand_total or v_payment.currency <> v_order.currency then
      raise exception using errcode = '23514', message = 'A matching confirmed demo payment is required before approving the return';
    end if;

    -- Prices are the IVA-inclusive order snapshots. Any order-level discount is
    -- allocated proportionally across merchandise; shipping is never refunded.
    v_refund_amount := case
      when v_merchandise_total <= 0 then 0
      else greatest(0, round(
        v_gross_return * greatest(0, v_order.subtotal + v_order.tax_total - v_order.discount_total)
        / v_merchandise_total,
        2
      ))::numeric(12,2)
    end;
    select coalesce(sum(f.amount), 0)::numeric(12,2) into v_previously_refunded
      from public.return_refunds f
      where f.payment_transaction_id = v_payment.id;
    if v_refund_amount > v_payment.amount - v_previously_refunded then
      raise exception using errcode = '23514', message = 'The simulated refund would exceed the amount paid';
    end if;
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

  if p_decision = 'approved' then
    insert into public.return_refunds (
      return_request_id, payment_transaction_id, amount, currency,
      idempotency_key, request_fingerprint, processed_by
    ) values (
      v_request.id, v_payment.id, v_refund_amount, v_order.currency,
      p_idempotency_key, v_fingerprint, v_user_id
    );

    update public.return_items as ri
      set inventory_disposition = 'pending_inspection', inspection_quantity = ri.quantity
      where ri.return_request_id = v_request.id;

    select coalesce(sum(ri.inspection_quantity), 0)::integer into v_pending_quantity
      from public.return_items ri
      where ri.return_request_id = v_request.id and ri.inventory_disposition = 'pending_inspection';
    insert into public.return_request_events (
      return_request_id, actor_id, event_type, from_status, to_status, decision_reason, details
    ) values (
      v_request.id, v_user_id, 'business_effects_recorded', 'requested', 'approved',
      pg_catalog.btrim(coalesce(p_decision_reason, '')),
      pg_catalog.jsonb_build_object(
        'refund_amount', v_refund_amount,
        'refund_currency', v_order.currency,
        'returned_quantity', v_return_quantity,
        'inventory_disposition', 'pending_inspection'
      )
    );
  else
    v_refund_amount := null;
    v_pending_quantity := 0;
  end if;

  return query select v_request.id, p_decision, v_refund_amount,
    case when p_decision = 'approved' then v_order.currency else null end,
    coalesce(v_pending_quantity, 0), false;
end;
$$;

revoke all on function private.review_return_request(uuid, public.return_status, text, uuid) from public, anon, authenticated, service_role;
grant execute on function private.review_return_request(uuid, public.return_status, text, uuid) to authenticated;

create function public.review_return_request(
  p_return_request_id uuid,
  p_decision public.return_status,
  p_decision_reason text,
  p_idempotency_key uuid
)
returns table(
  return_request_id uuid,
  return_status public.return_status,
  refund_amount numeric(12,2),
  refund_currency text,
  inventory_pending_inspection_quantity integer,
  replayed boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.review_return_request(p_return_request_id, p_decision, p_decision_reason, p_idempotency_key);
$$;

revoke all on function public.review_return_request(uuid, public.return_status, text, uuid) from public, anon;
grant execute on function public.review_return_request(uuid, public.return_status, text, uuid) to authenticated;
