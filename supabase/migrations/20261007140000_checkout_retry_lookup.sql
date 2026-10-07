-- Validate retries against the immutable order fingerprint before the route
-- allocates or mutates another active cart.
create or replace function private.find_checkout_order(
  p_idempotency_key text,
  p_items jsonb,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, status public.order_status, grand_total numeric, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing public.orders%rowtype;
  v_item jsonb;
  v_items jsonb;
  v_count integer;
  v_fingerprint text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to retry an order';
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
  v_count := pg_catalog.jsonb_array_length(p_items);
  if v_count not between 1 and 32 then
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
  if v_count <> (
    select pg_catalog.count(distinct e.value ->> 'variant_id')::integer
    from pg_catalog.jsonb_array_elements(p_items) e(value)
  ) then
    raise exception using errcode = '22023', message = 'Checkout lines must use unique variants';
  end if;

  select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_array((e.value ->> 'variant_id')::uuid::text, (e.value ->> 'quantity')::integer)
           order by e.value ->> 'variant_id'
         )
    into v_items
    from pg_catalog.jsonb_array_elements(p_items) e(value);
  v_fingerprint := private.checkout_payload_fingerprint(v_items, p_shipping_address, p_billing_address);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );
  select o.* into v_existing
    from public.orders o
    where o.customer_id = v_user_id and o.idempotency_key = p_idempotency_key
    for update;
  if not found then return; end if;
  if v_existing.checkout_fingerprint is distinct from v_fingerprint then
    raise exception using errcode = '23505', message = 'Checkout idempotency key was reused with a different payload';
  end if;
  return query select v_existing.id, v_existing.order_number, v_existing.status, v_existing.grand_total, v_existing.currency;
end;
$$;

revoke all on function private.find_checkout_order(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function private.find_checkout_order(text, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.find_checkout_order(
  p_idempotency_key text,
  p_items jsonb,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, status public.order_status, grand_total numeric, currency text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.find_checkout_order(p_idempotency_key, p_items, p_shipping_address, p_billing_address);
$$;

revoke all on function public.find_checkout_order(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.find_checkout_order(text, jsonb, jsonb, jsonb) to authenticated;
