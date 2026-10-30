-- NODRIA — PC Builder Inventory, Attributes & Scoped Sellability Migration
-- 1. Restores the structured pc_builder attribute on the 2 SSD reference variants (ref-storage-mz-v9p1t0bw, ref-storage-snv3sm3-1t0)
--    without removing their commercial nodria_store metadata.
-- 2. Ensures the helper functions and RLS policies allow reading and checking out authorized PC Builder components.
-- 3. Ensures private.place_order allows purchasing variants where (is_published or attributes ? 'pc_builder').
-- 4. Seeds demo inventory (15 units) for all 64 PC builder variants in the active warehouse 'NODRIA-DEMO'.
-- Completely idempotent and safe for repeated execution without altering the 5 official telecom categories or their 52 products.

begin;

-- 1. Restore pc_builder attribute for the 2 storage references
update public.product_variants
set attributes = jsonb_set(
  attributes,
  '{pc_builder}',
  '{"category": "storage", "capacity_tb": 1, "interface": "NVMe PCIe 4.0"}'::jsonb,
  true
),
updated_at = now()
where product_id in ('ref-storage-mz-v9p1t0bw', 'ref-storage-snv3sm3-1t0')
  and not (attributes ? 'pc_builder');

-- 2. Helper functions with SECURITY DEFINER to break RLS recursion between products and product_variants
create schema if not exists private;

create or replace function private.product_has_pc_builder(p_product_id text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.product_variants pv
    where pv.product_id = p_product_id and (pv.attributes ? 'pc_builder')
  );
$$;

revoke all on function private.product_has_pc_builder(text) from public, anon, authenticated;
grant execute on function private.product_has_pc_builder(text) to anon, authenticated, service_role;

create or replace function private.product_is_published(p_product_id text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select p.is_published from public.products p where p.id = p_product_id limit 1),
    false
  );
$$;

revoke all on function private.product_is_published(text) from public, anon, authenticated;
grant execute on function private.product_is_published(text) to anon, authenticated, service_role;

-- 3. Update RLS policies to allow reading authorized PC builder variants and products
-- without exposing them in general catalog queries that filter by is_published = true.

drop policy if exists variants_read_published on public.product_variants;
drop policy if exists product_variants_read_published on public.product_variants;
create policy product_variants_read_published on public.product_variants
  for select to anon, authenticated
  using (
    is_active and (
      (attributes ? 'pc_builder')
      or private.product_is_published(product_id)
    )
  );

drop policy if exists products_read_published on public.products;
create policy products_read_published on public.products
  for select to anon, authenticated
  using (
    is_published
    or private.product_has_pc_builder(id)
  );

-- 4. Update private.place_order to accept authorized PC builder variants
-- while strictly rejecting arbitrary unpublished items.
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
  -- Scoped sellability: accepts published store items OR authorized PC builder components.
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
    if not v_item.is_active or not (v_item.is_published or (v_item.attributes ? 'pc_builder')) then
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
      raise exception using errcode = 'P0001', message = 'Insufficient inventory for variant ' || v_item.sku;
    end if;

    v_subtotal := v_subtotal + round(v_item.current_price * v_item.quantity, 2);
    v_tax_total := v_tax_total + round(v_item.current_price * v_item.quantity * v_item.tax_rate, 2);
  end loop;

  v_grand_total := v_subtotal + v_tax_total;
  v_order_id := gen_random_uuid();
  v_order_number := 'NOD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(v_order_id::text, '-', '') from 1 for 10));

  insert into public.orders (
    id, order_number, customer_id, status, subtotal, tax_total, grand_total,
    currency, shipping_address, billing_address, idempotency_key, checkout_fingerprint
  ) values (
    v_order_id, v_order_number, v_user_id, 'pending_payment', v_subtotal, v_tax_total,
    v_grand_total, v_currency, p_shipping_address, p_billing_address, p_idempotency_key,
    v_checkout_fingerprint
  );

  for v_item in
    select ci.variant_id, ci.quantity, v.sku, v.current_price, v.tax_rate,
           v.title as variant_title, p.name as product_name
      from public.cart_items ci
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      where ci.cart_id = p_cart_id
      order by ci.variant_id
  loop
    v_order_item_id := gen_random_uuid();
    insert into public.order_items (
      id, order_id, variant_id, sku, product_name, variant_title,
      unit_price, quantity, tax_rate, line_subtotal, line_tax, line_total
    ) values (
      v_order_item_id, v_order_id, v_item.variant_id, v_item.sku, v_item.product_name,
      v_item.variant_title, v_item.current_price, v_item.quantity, v_item.tax_rate,
      round(v_item.current_price * v_item.quantity, 2),
      round(v_item.current_price * v_item.quantity * v_item.tax_rate, 2),
      round(v_item.current_price * v_item.quantity * (1 + v_item.tax_rate), 2)
    );

    v_remaining := v_item.quantity;
    for v_stock in
      select i.warehouse_id, (i.on_hand - i.reserved)::integer as available
        from public.inventory i
        join public.warehouses w on w.id = i.warehouse_id
        where i.variant_id = v_item.variant_id and w.is_active and (i.on_hand - i.reserved) > 0
        order by w.code, i.warehouse_id
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_stock.available);
      update public.inventory
        set reserved = reserved + v_take, updated_at = now()
        where warehouse_id = v_stock.warehouse_id and variant_id = v_item.variant_id;
      insert into public.inventory_reservations (order_item_id, warehouse_id, quantity)
        values (v_order_item_id, v_stock.warehouse_id, v_take);
      v_remaining := v_remaining - v_take;
    end loop;
  end loop;

  return query select v_order_id, v_order_number, v_grand_total, v_currency;
end;
$$;

-- 5. Seed demo inventory in warehouse 'NODRIA-DEMO' for all 64 PC builder variants
do $inventory_seed$
declare
  v_warehouse_id uuid;
  v_variant record;
  v_available integer;
begin
  select id into v_warehouse_id from public.warehouses where code = 'NODRIA-DEMO' limit 1;
  if v_warehouse_id is null then
    select id into v_warehouse_id from public.warehouses where is_active limit 1;
  end if;

  if v_warehouse_id is not null then
    for v_variant in
      select id, sku
      from public.product_variants
      where (attributes ? 'pc_builder') and is_active
    loop
      insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
      values (v_warehouse_id, v_variant.id, 0, 0)
      on conflict (warehouse_id, variant_id) do nothing;

      select greatest(0, i.on_hand - i.reserved) into v_available
      from public.inventory i
      where i.warehouse_id = v_warehouse_id and i.variant_id = v_variant.id;

      if v_available < 15 then
        perform private.adjust_inventory(
          v_warehouse_id,
          v_variant.id,
          15 - v_available,
          'Carga de existencias para PC Builder autorizado NODRIA'
        );
      end if;
    end loop;
  end if;
end;
$inventory_seed$;

commit;
