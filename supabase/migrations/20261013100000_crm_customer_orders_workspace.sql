-- Shopify-inspired CRM read models. Sales can see customer/order context, but
-- only through these minimal, role-checked functions; direct table grants and
-- the existing order RLS policy remain unchanged.

create or replace function public.crm_customer_directory(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  customer_id uuid,
  display_name text,
  email text,
  phone text,
  created_at timestamptz,
  order_count bigint,
  latest_order_id uuid,
  latest_order_number text,
  latest_order_status text,
  latest_payment_status text,
  latest_order_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.left(pg_catalog.btrim(coalesce(p_query, '')), 100);
begin
  if auth.uid() is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'CRM customer access is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'Invalid customer directory pagination';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.email,
    p.phone,
    p.created_at,
    coalesce(order_stats.order_count, 0)::bigint,
    latest_order.id,
    latest_order.order_number,
    latest_order.status,
    latest_payment.status,
    latest_order.placed_at,
    pg_catalog.count(*) over ()::bigint
  from public.profiles p
  left join lateral (
    select count(*)::bigint as order_count
    from public.orders o
    where o.customer_id = p.id
  ) order_stats on true
  left join lateral (
    select o.id, o.order_number, o.status::text as status, o.placed_at
    from public.orders o
    where o.customer_id = p.id
    order by o.placed_at desc, o.created_at desc, o.id
    limit 1
  ) latest_order on true
  left join lateral (
    select pt.status::text as status
    from public.payment_transactions pt
    where pt.order_id = latest_order.id
    order by pt.created_at desc, pt.id desc
    limit 1
  ) latest_payment on true
  where not exists (
      select 1 from public.user_role_grants g where g.user_id = p.id
    )
    and (
      v_query = ''
      or pg_catalog.strpos(pg_catalog.lower(p.display_name), pg_catalog.lower(v_query)) > 0
      or pg_catalog.strpos(pg_catalog.lower(p.email), pg_catalog.lower(v_query)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(p.phone, '')), pg_catalog.lower(v_query)) > 0
      or exists (
        select 1
        from public.orders o
        where o.customer_id = p.id
          and pg_catalog.strpos(pg_catalog.lower(o.order_number), pg_catalog.lower(v_query)) > 0
      )
    )
  order by latest_order.placed_at desc nulls last, p.created_at desc, p.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.crm_customer_directory(text, integer, integer) from public, anon;
grant execute on function public.crm_customer_directory(text, integer, integer) to authenticated;

create or replace function public.crm_customer_profile(p_customer_id uuid)
returns table (
  customer_id uuid,
  display_name text,
  email text,
  phone text,
  created_at timestamptz,
  order_count bigint,
  latest_order_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'CRM customer access is required';
  end if;

  return query
  select p.id, p.display_name, p.email, p.phone, p.created_at,
    (select pg_catalog.count(*)::bigint from public.orders o where o.customer_id = p.id),
    (select pg_catalog.max(o.placed_at) from public.orders o where o.customer_id = p.id)
  from public.profiles p
  where p.id = p_customer_id
    and not exists (select 1 from public.user_role_grants g where g.user_id = p.id);
end;
$$;

revoke all on function public.crm_customer_profile(uuid) from public, anon;
grant execute on function public.crm_customer_profile(uuid) to authenticated;

create or replace function public.crm_orders(
  p_customer_id uuid default null,
  p_query text default null,
  p_order_status text default null,
  p_payment_status text default null,
  p_fulfillment_status text default null,
  p_return_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  order_id uuid,
  order_number text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  organization_name text,
  order_status text,
  payment_status text,
  fulfillment_status text,
  return_status text,
  grand_total numeric,
  currency text,
  placed_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := pg_catalog.left(pg_catalog.btrim(coalesce(p_query, '')), 100);
begin
  if auth.uid() is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'CRM order access is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 or p_offset > 100000 then
    raise exception using errcode = '22023', message = 'Invalid order pagination';
  end if;
  if p_order_status is not null and p_order_status not in ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception using errcode = '22023', message = 'Invalid order status filter';
  end if;
  if p_payment_status is not null and p_payment_status not in ('pending', 'authorized', 'paid', 'failed', 'partially_refunded', 'refunded') then
    raise exception using errcode = '22023', message = 'Invalid payment status filter';
  end if;
  if p_fulfillment_status is not null and p_fulfillment_status not in ('not_started', 'pending', 'picking', 'packed', 'shipped', 'delivered', 'cancelled', 'not_required') then
    raise exception using errcode = '22023', message = 'Invalid fulfillment status filter';
  end if;
  if p_return_status is not null and p_return_status not in ('requested', 'approved', 'rejected', 'received', 'refunded', 'closed') then
    raise exception using errcode = '22023', message = 'Invalid return status filter';
  end if;

  return query
  with classified as (
    select
      o.id,
      o.order_number,
      o.customer_id,
      coalesce(nullif(p.display_name, ''), 'Cliente') as customer_name,
      p.email as customer_email,
      org.display_name as organization_name,
      o.status::text as order_status,
      latest_payment.status as payment_status,
      case
        when o.status = 'cancelled' then 'cancelled'
        when o.status = 'refunded' then 'not_required'
        when coalesce(event_flags.was_delivered, false) then 'delivered'
        when o.status = 'shipped' or coalesce(event_flags.was_shipped, false) then 'shipped'
        when coalesce(event_flags.was_packed, false) then 'packed'
        when coalesce(event_flags.was_picking, false) then 'picking'
        when o.status in ('paid', 'processing') then 'pending'
        else 'not_started'
      end as fulfillment_status,
      latest_return.status as return_status,
      o.grand_total,
      o.currency,
      o.placed_at
    from public.orders o
    join public.profiles p on p.id = o.customer_id
    left join public.organizations org on org.id = o.organization_id
    left join lateral (
      select pt.status::text as status
      from public.payment_transactions pt
      where pt.order_id = o.id
      order by pt.created_at desc, pt.id desc
      limit 1
    ) latest_payment on true
    left join lateral (
      select
        pg_catalog.bool_or(e.event_key = 'order_picking_started') as was_picking,
        pg_catalog.bool_or(e.event_key = 'order_packed') as was_packed,
        pg_catalog.bool_or(e.event_key = 'order_shipped') as was_shipped,
        pg_catalog.bool_or(e.event_key = 'order_delivered') as was_delivered
      from public.order_events e
      where e.order_id = o.id
    ) event_flags on true
    left join lateral (
      select rr.status::text as status
      from public.return_requests rr
      where rr.order_id = o.id
      order by rr.requested_at desc, rr.id desc
      limit 1
    ) latest_return on true
    where not exists (
        select 1 from public.user_role_grants g where g.user_id = p.id
      )
      and (p_customer_id is null or o.customer_id = p_customer_id)
      and (p_order_status is null or o.status::text = p_order_status)
      and (p_payment_status is null or latest_payment.status = p_payment_status)
      and (p_return_status is null or latest_return.status = p_return_status)
      and (p_fulfillment_status is null or
        case
          when o.status = 'cancelled' then 'cancelled'
          when o.status = 'refunded' then 'not_required'
          when coalesce(event_flags.was_delivered, false) then 'delivered'
          when o.status = 'shipped' or coalesce(event_flags.was_shipped, false) then 'shipped'
          when coalesce(event_flags.was_packed, false) then 'packed'
          when coalesce(event_flags.was_picking, false) then 'picking'
          when o.status in ('paid', 'processing') then 'pending'
          else 'not_started'
        end = p_fulfillment_status)
      and (
        v_query = ''
        or pg_catalog.strpos(pg_catalog.lower(o.order_number), pg_catalog.lower(v_query)) > 0
        or pg_catalog.strpos(pg_catalog.lower(p.display_name), pg_catalog.lower(v_query)) > 0
        or pg_catalog.strpos(pg_catalog.lower(p.email), pg_catalog.lower(v_query)) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(org.display_name, '')), pg_catalog.lower(v_query)) > 0
        or exists (
          select 1 from public.order_items oi
          where oi.order_id = o.id
            and (pg_catalog.strpos(pg_catalog.lower(oi.product_name), pg_catalog.lower(v_query)) > 0
              or pg_catalog.strpos(pg_catalog.lower(oi.product_sku), pg_catalog.lower(v_query)) > 0)
        )
      )
  )
  select
    c.id, c.order_number, c.customer_id, c.customer_name, c.customer_email,
    c.organization_name, c.order_status, c.payment_status, c.fulfillment_status,
    c.return_status, c.grand_total, c.currency, c.placed_at,
    pg_catalog.count(*) over ()::bigint
  from classified c
  order by c.placed_at desc, c.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.crm_orders(uuid, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.crm_orders(uuid, text, text, text, text, text, integer, integer) to authenticated;

create or replace function public.crm_order_detail(p_order_id uuid)
returns table (
  order_id uuid,
  order_number text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  organization_name text,
  order_status text,
  payment_status text,
  fulfillment_status text,
  return_status text,
  subtotal numeric,
  tax_total numeric,
  shipping_total numeric,
  discount_total numeric,
  grand_total numeric,
  currency text,
  placed_at timestamptz,
  items jsonb,
  timeline jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'CRM order access is required';
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.customer_id,
    coalesce(nullif(p.display_name, ''), 'Cliente'),
    p.email,
    org.display_name,
    o.status::text,
    latest_payment.status,
    case
      when o.status = 'cancelled' then 'cancelled'
      when o.status = 'refunded' then 'not_required'
      when coalesce(event_flags.was_delivered, false) then 'delivered'
      when o.status = 'shipped' or coalesce(event_flags.was_shipped, false) then 'shipped'
      when coalesce(event_flags.was_packed, false) then 'packed'
      when coalesce(event_flags.was_picking, false) then 'picking'
      when o.status in ('paid', 'processing') then 'pending'
      else 'not_started'
    end,
    latest_return.status,
    o.subtotal,
    o.tax_total,
    o.shipping_total,
    o.discount_total,
    o.grand_total,
    o.currency,
    o.placed_at,
    coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'productName', oi.product_name,
        'sku', oi.product_sku,
        'variantTitle', oi.variant_title,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'lineTotal', oi.line_total,
        'currency', oi.currency
      ) order by oi.created_at, oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'eventKey', e.event_key,
        'note', e.note,
        'occurredAt', e.occurred_at
      ) order by e.occurred_at desc, e.id desc)
      from (
        select oe.id, oe.event_key, oe.note, oe.occurred_at
        from public.order_events oe
        where oe.order_id = o.id
        order by oe.occurred_at desc, oe.id desc
        limit 40
      ) e
    ), '[]'::jsonb)
  from public.orders o
  join public.profiles p on p.id = o.customer_id
  left join public.organizations org on org.id = o.organization_id
  left join lateral (
    select pt.status::text as status
    from public.payment_transactions pt
    where pt.order_id = o.id
    order by pt.created_at desc, pt.id desc
    limit 1
  ) latest_payment on true
  left join lateral (
    select
      pg_catalog.bool_or(e.event_key = 'order_picking_started') as was_picking,
      pg_catalog.bool_or(e.event_key = 'order_packed') as was_packed,
      pg_catalog.bool_or(e.event_key = 'order_shipped') as was_shipped,
      pg_catalog.bool_or(e.event_key = 'order_delivered') as was_delivered
    from public.order_events e
    where e.order_id = o.id
  ) event_flags on true
  left join lateral (
    select rr.status::text as status
    from public.return_requests rr
    where rr.order_id = o.id
    order by rr.requested_at desc, rr.id desc
    limit 1
  ) latest_return on true
  where o.id = p_order_id
    and not exists (select 1 from public.user_role_grants g where g.user_id = p.id);
end;
$$;

revoke all on function public.crm_order_detail(uuid) from public, anon;
grant execute on function public.crm_order_detail(uuid) to authenticated;
