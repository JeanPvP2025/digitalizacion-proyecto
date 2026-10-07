-- Simulate the agreed B2B advance without collecting card data or using the
-- B2C checkout client flow. Only an owner/admin of the order's organization
-- may resolve this demo payment.

create or replace function private.resolve_business_order_demo_payment(
  p_order_id uuid,
  p_outcome text,
  p_idempotency_key uuid
)
returns table(payment_status public.payment_status, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_business_order public.business_quote_orders%rowtype;
  v_payment public.payment_transactions%rowtype;
  v_event_id text;
  v_status public.payment_status;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to record a business advance';
  end if;
  if p_outcome not in ('approved', 'failed') or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'A demo payment outcome and idempotency key are required';
  end if;

  select o.* into v_order
    from public.orders o
    join public.business_quote_orders bqo on bqo.order_id = o.id
    where o.id = p_order_id
    for update of o;
  if not found then
    raise exception using errcode = 'P0002', message = 'Business order not found';
  end if;
  select bqo.* into v_business_order
    from public.business_quote_orders bqo
    where bqo.order_id = p_order_id;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = v_business_order.organization_id
      and m.user_id = v_user_id and m.role in ('owner', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'Only an organization owner or admin can resolve its advance payment';
  end if;

  v_event_id := 'b2b-demo:' || p_order_id::text || ':' || p_idempotency_key::text;
  select pt.* into v_payment
    from public.payment_transactions pt
    where pt.provider = 'demo' and pt.provider_reference = v_event_id
    for update;
  if found then
    if v_payment.order_id <> p_order_id
       or (p_outcome = 'approved' and v_payment.status <> 'paid')
       or (p_outcome = 'failed' and v_payment.status <> 'failed') then
      raise exception using errcode = '23505', message = 'Payment idempotency key was reused with a different order or outcome';
    end if;
    return query select v_payment.status, true;
    return;
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception using errcode = '23514', message = 'Only a pending business order can receive its advance payment';
  end if;
  v_status := private.resolve_demo_payment(p_order_id, p_outcome, v_event_id);
  select pt.* into v_payment
    from public.payment_transactions pt
    where pt.provider = 'demo' and pt.provider_reference = v_event_id;
  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
  values (
    p_order_id, v_user_id,
    case when p_outcome = 'approved' then 'business_advance_paid' else 'business_advance_declined' end,
    case when p_outcome = 'approved'
      then 'Anticipo B2B ficticio aprobado; el pedido ya puede pasar a fulfillment.'
      else 'Anticipo B2B ficticio rechazado; pedido cancelado y reserva liberada.' end,
    pg_catalog.jsonb_build_object(
      'payment_transaction_id', v_payment.id,
      'provider', 'demo', 'outcome', p_outcome,
      'amount', v_payment.amount, 'currency', v_payment.currency,
      'event_id', v_event_id
    )
  );
  insert into public.crm_activities (
    organization_id, quote_id, actor_user_id, event_key, title,
    subject_name, company_snapshot, body, visibility, details
  ) values (
    v_business_order.organization_id, v_business_order.quote_id, v_user_id,
    case when p_outcome = 'approved' then 'business_advance_paid' else 'business_advance_declined' end,
    case when p_outcome = 'approved' then 'Anticipo B2B registrado' else 'Anticipo B2B rechazado' end,
    v_business_order.organization_snapshot->>'display_name',
    v_business_order.organization_snapshot->>'display_name',
    case when p_outcome = 'approved'
      then 'El anticipo demo fue aprobado; el pedido empresarial puede pasar a preparación.'
      else 'El anticipo demo fue rechazado; se canceló el pedido y se liberó la reserva.' end,
    'organization',
    pg_catalog.jsonb_build_object(
      'order_id', p_order_id, 'payment_transaction_id', v_payment.id,
      'outcome', p_outcome, 'amount', v_payment.amount,
      'currency', v_payment.currency
    )
  );
  return query select v_status, false;
end;
$$;

revoke all on function private.resolve_business_order_demo_payment(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.resolve_business_order_demo_payment(uuid, text, uuid)
  to authenticated;

create or replace function public.resolve_business_order_demo_payment(
  p_order_id uuid,
  p_outcome text,
  p_idempotency_key uuid
)
returns table(payment_status public.payment_status, replayed boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from private.resolve_business_order_demo_payment(p_order_id, p_outcome, p_idempotency_key);
$$;

revoke all on function public.resolve_business_order_demo_payment(uuid, text, uuid) from public, anon;
grant execute on function public.resolve_business_order_demo_payment(uuid, text, uuid) to authenticated;
