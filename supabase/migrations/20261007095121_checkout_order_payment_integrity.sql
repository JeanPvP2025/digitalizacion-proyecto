-- Bind an order idempotency key to the persisted item/address payload and record
-- simulated payment attempts without splitting order/payment/stock transitions.
create extension if not exists pgcrypto with schema extensions;

alter table public.orders add column if not exists checkout_fingerprint text;

create or replace function private.checkout_payload_fingerprint(
  p_items jsonb,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'items', p_items,
          'shipping_address', p_shipping_address,
          'billing_address', p_billing_address
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.checkout_payload_fingerprint(jsonb, jsonb, jsonb) from public, anon, authenticated;

with order_fingerprints as (
  select o.id,
         private.checkout_payload_fingerprint(
           coalesce((
             select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_array(coalesce(oi.variant_id::text, oi.product_id), oi.quantity)
               order by coalesce(oi.variant_id::text, oi.product_id)
             )
             from public.order_items oi
             where oi.order_id = o.id
           ), '[]'::jsonb),
           o.shipping_address,
           o.billing_address
         ) as fingerprint
  from public.orders o
  where o.checkout_fingerprint is null
)
update public.orders o
  set checkout_fingerprint = f.fingerprint
  from order_fingerprints f
  where f.id = o.id;

alter table public.orders alter column checkout_fingerprint set not null;
alter table public.orders add constraint orders_checkout_fingerprint_sha256_check
  check (checkout_fingerprint ~ '^[a-f0-9]{64}$');

create or replace function private.is_checkout_address(p_address jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_typeof(p_address) = 'object'
    and pg_catalog.char_length(pg_catalog.btrim(coalesce(nullif(p_address ->> 'fullName', ''), p_address ->> 'name', ''))) between 2 and 120
    and pg_catalog.char_length(pg_catalog.btrim(coalesce(nullif(p_address ->> 'address', ''), p_address ->> 'street', ''))) between 5 and 200
    and coalesce(nullif(p_address ->> 'postalCode', ''), p_address ->> 'postal_code', '') ~ '^[0-9]{5}$'
    and pg_catalog.char_length(pg_catalog.btrim(coalesce(p_address ->> 'city', ''))) between 2 and 80
    and coalesce(nullif(p_address ->> 'countryCode', ''), p_address ->> 'country_code', '') = 'ES',
    false
  );
$$;

revoke all on function private.is_checkout_address(jsonb) from public, anon, authenticated;

-- Keep the public.place_order signature stable. On replay, compare the database
-- cart lines and address snapshots against the stored SHA-256 fingerprint.
create or replace function private.place_order(
  p_cart_id uuid,
  p_idempotency_key text,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, grand_total numeric, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_cart public.carts%rowtype;
  v_existing public.orders%rowtype;
  v_item record;
  v_stock record;
  v_order_id uuid;
  v_order_number text;
  v_order_item_id uuid;
  v_currency text;
  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_grand_total numeric(12,2);
  v_available integer;
  v_remaining integer;
  v_take integer;
  v_payload_items jsonb;
  v_checkout_fingerprint text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to place an order';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 120 then
    raise exception using errcode = '22023', message = 'A valid checkout idempotency key is required';
  end if;
  if not private.is_checkout_address(p_shipping_address)
     or not private.is_checkout_address(p_billing_address) then
    raise exception using errcode = '22023', message = 'Shipping and billing addresses are incomplete';
  end if;

  -- Serialize retries before reading a cart or an existing order for this key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select c.* into v_cart
    from public.carts c
    where c.id = p_cart_id
      and c.user_id = v_user_id
      and c.status in ('active', 'converted')
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Customer cart not found';
  end if;
  if v_cart.organization_id is not null and not private.is_org_member(v_cart.organization_id) then
    raise exception using errcode = '42501', message = 'The current user is not a member of this organization';
  end if;

  -- Lock the persisted cart lines before deriving the request fingerprint.
  perform ci.id
    from public.cart_items ci
    where ci.cart_id = p_cart_id
    order by ci.variant_id
    for update of ci;
  if not exists (select 1 from public.cart_items ci where ci.cart_id = p_cart_id) then
    raise exception using errcode = '22023', message = 'Cannot place an empty cart';
  end if;
  select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_array(ci.variant_id::text, ci.quantity)
           order by ci.variant_id
         )
    into v_payload_items
    from public.cart_items ci
    where ci.cart_id = p_cart_id;
  v_checkout_fingerprint := private.checkout_payload_fingerprint(
    v_payload_items, p_shipping_address, p_billing_address
  );

  select o.* into v_existing
    from public.orders o
    where o.customer_id = v_user_id and o.idempotency_key = p_idempotency_key
    for update;
  if found then
    if v_existing.checkout_fingerprint is distinct from v_checkout_fingerprint then
      raise exception using errcode = '23505', message = 'Checkout idempotency key was reused with a different payload';
    end if;
    return query select v_existing.id, v_existing.order_number, v_existing.grand_total, v_existing.currency;
    return;
  end if;
  if v_cart.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'Active cart not found';
  end if;

  -- Lock variants and inventory, then verify live publication, price and stock.
  for v_item in
    select ci.variant_id, ci.quantity, v.sku, v.current_price, v.currency, v.tax_rate,
           v.title as variant_title, v.attributes, v.is_active,
           p.id as product_id, p.name as product_name, p.is_published
      from public.cart_items ci
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      where ci.cart_id = p_cart_id
      order by ci.variant_id
      for share of v, p
  loop
    if not v_item.is_active or not v_item.is_published then
      raise exception using errcode = 'P0001', message = 'A cart item is no longer available';
    end if;
    if v_item.currency <> v_cart.currency then
      raise exception using errcode = '22023', message = 'Cart and product currencies do not match';
    end if;
    if v_currency is null then
      v_currency := v_item.currency;
    elsif v_currency <> v_item.currency then
      raise exception using errcode = '22023', message = 'A cart cannot mix currencies';
    end if;

    perform i.warehouse_id
      from public.inventory i
      join public.warehouses w on w.id = i.warehouse_id
      where i.variant_id = v_item.variant_id and w.is_active
      order by w.code, i.warehouse_id
      for update of i;
    select coalesce(sum(i.on_hand - i.reserved), 0)::integer into v_available
      from public.inventory i
      join public.warehouses w on w.id = i.warehouse_id
      where i.variant_id = v_item.variant_id and w.is_active;
    if v_available < v_item.quantity then
      raise exception using errcode = 'P0001', message = 'Insufficient stock for SKU ' || v_item.sku;
    end if;

    v_subtotal := v_subtotal + round(v_item.current_price * v_item.quantity / (1 + v_item.tax_rate), 2);
    v_tax_total := v_tax_total + round(v_item.current_price * v_item.quantity, 2)
      - round(v_item.current_price * v_item.quantity / (1 + v_item.tax_rate), 2);
  end loop;

  if v_currency is null then
    raise exception using errcode = '22023', message = 'Cannot place an empty cart';
  end if;
  v_grand_total := v_subtotal + v_tax_total;
  v_order_number := 'NOD-' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD') || '-' ||
    pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.orders (
    order_number, customer_id, idempotency_key, checkout_fingerprint, organization_id, status, currency,
    subtotal, tax_total, shipping_total, discount_total, grand_total,
    shipping_address, billing_address
  ) values (
    v_order_number, v_user_id, p_idempotency_key, v_checkout_fingerprint, v_cart.organization_id,
    'pending_payment', v_currency, v_subtotal, v_tax_total, 0, 0, v_grand_total,
    p_shipping_address, p_billing_address
  ) returning id into v_order_id;

  for v_item in
    select ci.variant_id, ci.quantity, v.sku, v.current_price, v.currency, v.tax_rate,
           v.title as variant_title, v.attributes,
           p.id as product_id, p.name as product_name
      from public.cart_items ci
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      where ci.cart_id = p_cart_id
      order by ci.variant_id
  loop
    insert into public.order_items (
      order_id, variant_id, product_id, product_name, product_sku,
      variant_title, variant_attributes, quantity, unit_price, currency, tax_rate
    ) values (
      v_order_id, v_item.variant_id, v_item.product_id, v_item.product_name, v_item.sku,
      v_item.variant_title, v_item.attributes, v_item.quantity, v_item.current_price, v_item.currency, v_item.tax_rate
    ) returning id into v_order_item_id;

    v_remaining := v_item.quantity;
    for v_stock in
      select i.warehouse_id, i.on_hand - i.reserved as available
        from public.inventory i
        join public.warehouses w on w.id = i.warehouse_id
        where i.variant_id = v_item.variant_id and w.is_active and i.on_hand > i.reserved
        order by w.code, i.warehouse_id
        for update of i
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_stock.available);
      update public.inventory
        set reserved = reserved + v_take
        where warehouse_id = v_stock.warehouse_id and variant_id = v_item.variant_id;
      insert into public.inventory_reservations (order_item_id, warehouse_id, quantity)
        values (v_order_item_id, v_stock.warehouse_id, v_take);
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then
      raise exception using errcode = 'P0001', message = 'Inventory changed during checkout; retry the order';
    end if;
  end loop;

  insert into public.payment_transactions (order_id, provider, status, amount, currency)
    values (v_order_id, 'checkout', 'pending', v_grand_total, v_currency);
  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
    values (v_order_id, v_user_id, 'order_created', 'Pedido creado; pago pendiente',
      pg_catalog.jsonb_build_object('status', 'pending_payment'));
  update public.carts set status = 'converted' where id = p_cart_id;

  return query select v_order_id, v_order_number, v_grand_total, v_currency;
end;
$$;

-- Atomically replace a customer's cart lines with the validated checkout
-- request before invoking the existing authoritative place_order operation.
create or replace function private.place_order_from_checkout(
  p_cart_id uuid,
  p_idempotency_key text,
  p_items jsonb,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, grand_total numeric, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_cart public.carts%rowtype;
  v_item jsonb;
  v_order_exists boolean;
  v_item_count integer;
  v_distinct_item_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to place an order';
  end if;
  if p_idempotency_key is null or pg_catalog.char_length(p_idempotency_key) not between 8 and 120 then
    raise exception using errcode = '22023', message = 'A valid checkout idempotency key is required';
  end if;
  if not private.is_checkout_address(p_shipping_address)
     or not private.is_checkout_address(p_billing_address) then
    raise exception using errcode = '22023', message = 'Shipping and billing addresses are incomplete';
  end if;
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Checkout lines must be an array';
  end if;
  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count not between 1 and 32 then
    raise exception using errcode = '22023', message = 'Checkout must contain between 1 and 32 lines';
  end if;
  for v_item in select e.value from pg_catalog.jsonb_array_elements(p_items) e(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
       or v_item - 'variant_id' - 'quantity' <> '{}'::jsonb
       or coalesce(v_item ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v_item ->> 'quantity', '') !~ '^(1|2|3|4|5|6|7|8|9|10)$' then
      raise exception using errcode = '22023', message = 'Each checkout line needs a variant id and quantity from 1 to 10';
    end if;
  end loop;
  select pg_catalog.count(distinct e.value ->> 'variant_id')::integer
    into v_distinct_item_count
    from pg_catalog.jsonb_array_elements(p_items) e(value);
  if v_item_count <> v_distinct_item_count then
    raise exception using errcode = '22023', message = 'Checkout lines must use unique variants';
  end if;

  -- Serialize same-key requests before cart mutation. Different keys serialize
  -- on the cart row, keeping each request's lines bound to its own order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );
  select c.* into v_cart
    from public.carts c
    where c.id = p_cart_id and c.user_id = v_user_id and c.status in ('active', 'converted')
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Customer cart not found';
  end if;
  select exists (
    select 1 from public.orders o
    where o.customer_id = v_user_id and o.idempotency_key = p_idempotency_key
  ) into v_order_exists;
  if v_cart.status <> 'active' and not v_order_exists then
    raise exception using errcode = 'P0002', message = 'Active cart not found';
  end if;

  delete from public.cart_items ci where ci.cart_id = p_cart_id;
  insert into public.cart_items (cart_id, variant_id, quantity)
    select p_cart_id, (e.value ->> 'variant_id')::uuid, (e.value ->> 'quantity')::integer
      from pg_catalog.jsonb_array_elements(p_items) e(value)
      order by e.value ->> 'variant_id';

  return query
    select * from private.place_order(p_cart_id, p_idempotency_key, p_shipping_address, p_billing_address);
  update public.carts set status = 'converted' where id = p_cart_id;
end;
$$;

revoke all on function private.place_order_from_checkout(uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.place_order_from_checkout(uuid, text, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.place_order_from_checkout(
  p_cart_id uuid,
  p_idempotency_key text,
  p_items jsonb,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, grand_total numeric, currency text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.place_order_from_checkout(
    p_cart_id, p_idempotency_key, p_items, p_shipping_address, p_billing_address
  );
$$;

revoke all on function public.place_order_from_checkout(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.place_order_from_checkout(uuid, text, jsonb, jsonb, jsonb) to authenticated;

create table private.demo_payment_attempts (
  event_id text primary key check (pg_catalog.char_length(event_id) between 8 and 120),
  order_id uuid not null references public.orders(id) on delete restrict,
  outcome text not null check (outcome in ('approved', 'failed', 'declined', 'insufficient_funds', 'processing', 'temporary_error')),
  result_status public.payment_status not null,
  created_at timestamptz not null default pg_catalog.now()
);
create index demo_payment_attempts_order_idx on private.demo_payment_attempts (order_id, created_at desc);
revoke all on private.demo_payment_attempts from public, anon, authenticated, service_role;

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
  v_attempt private.demo_payment_attempts%rowtype;
  v_status public.payment_status;
  v_event_key text;
  v_note text;
begin
  if p_outcome is null or p_outcome not in ('approved', 'failed', 'declined', 'insufficient_funds', 'processing', 'temporary_error') then
    raise exception using errcode = '22023', message = 'Unsupported simulated payment outcome';
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

  select a.* into v_attempt
    from private.demo_payment_attempts a
    where a.event_id = p_event_id
    for update;
  if found then
    if v_attempt.order_id <> p_order_id or v_attempt.outcome <> p_outcome then
      raise exception using errcode = '23505', message = 'Payment event id was already used for a different order or result';
    end if;
    select pt.status into v_status
      from public.payment_transactions pt
      where pt.order_id = p_order_id
      order by pt.created_at desc, pt.id
      limit 1;
    return coalesce(v_status, v_attempt.result_status);
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception using errcode = '23514', message = 'Only an unpaid order can receive a payment result';
  end if;

  select pt.* into v_payment
    from public.payment_transactions pt
    where pt.order_id = p_order_id and pt.status = 'pending' and pt.provider = 'checkout'
    order by pt.created_at desc, pt.id
    limit 1
    for update;
  if not found or v_payment.amount <> v_order.grand_total or v_payment.currency <> v_order.currency then
    raise exception using errcode = '23514', message = 'Pending payment does not match the persisted order total';
  end if;

  v_status := case
    when p_outcome = 'approved' then 'paid'::public.payment_status
    when p_outcome in ('failed', 'declined', 'insufficient_funds') then 'failed'::public.payment_status
    else 'pending'::public.payment_status
  end;
  insert into private.demo_payment_attempts (event_id, order_id, outcome, result_status)
    values (p_event_id, p_order_id, p_outcome, v_status);

  if p_outcome = 'approved' then
    update public.payment_transactions
      set provider = 'demo', provider_reference = p_event_id,
          status = 'paid', processed_at = pg_catalog.now()
      where id = v_payment.id;
    update public.orders set status = 'paid' where id = p_order_id;
    v_event_key := 'payment_paid';
    v_note := 'Pago ficticio aprobado; reserva mantenida hasta expedición.';
  elsif p_outcome in ('failed', 'declined', 'insufficient_funds') then
    update public.payment_transactions
      set provider = 'demo', provider_reference = p_event_id,
          status = 'failed', processed_at = pg_catalog.now()
      where id = v_payment.id;
    perform private.lock_order_stock_rows(p_order_id);
    update public.inventory_reservations ir
      set released_at = pg_catalog.now()
      from public.order_items oi
      where oi.id = ir.order_item_id and oi.order_id = p_order_id
        and ir.released_at is null and ir.fulfilled_at is null;
    update public.orders set status = 'cancelled' where id = p_order_id;
    v_event_key := 'payment_failed';
    v_note := 'Pago ficticio rechazado; reserva liberada.';
  elsif p_outcome = 'processing' then
    v_event_key := 'payment_processing';
    v_note := 'Pago ficticio en revisión; el pedido y la reserva permanecen pendientes.';
  else
    v_event_key := 'payment_temporary_error';
    v_note := 'Error temporal simulado; el pedido y la reserva permanecen pendientes.';
  end if;

  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
    values (p_order_id, null, v_event_key, v_note,
      pg_catalog.jsonb_build_object('provider', 'demo', 'event_id', p_event_id, 'outcome', p_outcome));

  return v_status;
end;
$$;

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

revoke all on function private.resolve_demo_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function private.resolve_demo_payment(uuid, text, text) to service_role;
revoke all on function public.resolve_demo_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_demo_payment(uuid, text, text) to service_role;
