-- NODRIA — PC Builder Authorized Checkout & Scoped Sellability Migration
-- Authorizes PC Builder components for purchase through explicit variant ID in connected checkout
-- WITHOUT publishing them in the general storefront telecommunications catalog.
-- Does NOT disable is_published globally; restricts purchase exclusively to variants with valid pc_builder attributes.
-- Completely idempotent and safe for repeated execution.

begin;

-- 1. Update RLS policies to allow reading authorized PC builder variants and products
-- without exposing them in general catalog queries that filter by is_published = true.

drop policy if exists product_variants_read_published on public.product_variants;
create policy product_variants_read_published on public.product_variants
  for select to anon, authenticated
  using (
    is_active and (
      exists (select 1 from public.products p where p.id = product_id and p.is_published)
      or (attributes ? 'pc_builder')
    )
  );

drop policy if exists products_read_published on public.products;
create policy products_read_published on public.products
  for select to anon, authenticated
  using (
    is_published
    or exists (
      select 1 from public.product_variants pv
      where pv.product_id = products.id and (pv.attributes ? 'pc_builder')
    )
  );

-- 2. Update private.place_order to accept authorized PC builder variants
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

-- 3. Seed demo inventory for authorized PC builder variants so they can be fulfilled
do $inventory_seed$
declare
  v_warehouse_id uuid;
  v_variant_id uuid;
  v_available integer;
  v_variants uuid[] := array[
    'e407c330-bddd-4f41-8384-87535fefccda'::uuid,
    '2f2df0d6-b3e5-4f07-8d41-69edfe17530f'::uuid,
    '45bb29b8-2460-4241-8883-d70cf7a03e79'::uuid,
    'c8b6bd9f-27d4-45bf-8e28-237e291e13c2'::uuid,
    'e10da377-7888-4c1c-87c3-95013051eb21'::uuid,
    '1283d96b-d242-4158-8d14-355a189364df'::uuid,
    '4593087d-7852-47e0-8ab5-886d6889be0b'::uuid,
    '92ad0c60-5b98-4718-8993-1e04f87ed352'::uuid,
    '34733a01-167c-4544-88d0-3cc15d4f38b2'::uuid,
    'b3e71fd2-f1fc-42ed-863e-1f59c34bbfdf'::uuid,
    '559f703b-5bf7-45b3-85f8-b2ca3c8e5e88'::uuid,
    '63dfa0b7-179a-4ce4-8b46-7949b773c296'::uuid,
    '3f46eab3-6518-4eaa-8594-25ce312ad623'::uuid,
    '1bf9f13c-13c2-47e4-88c9-91cbf28326f4'::uuid,
    'db0b6997-94a4-4a6c-8756-28e0d15bcb96'::uuid,
    '2cbe971c-fd6f-485c-816c-19101f5ab285'::uuid,
    'dc61aa63-aba1-47ab-807a-2a7cc22d4cb0'::uuid,
    'a29d9df4-3d07-4f86-84ef-845bff47f8bf'::uuid,
    'c2aa6a1f-12c8-4263-81e5-03b078047c3f'::uuid,
    'e194b647-85e9-44f7-8729-e660bbd0750f'::uuid,
    '835a5ffe-0c04-4372-8ece-892f976079b3'::uuid,
    '39be5587-da7c-44fe-8c1e-620130b74686'::uuid,
    'b8a99820-08f2-43ec-874f-e213552725c8'::uuid,
    'b3b34393-7eac-4709-89e3-71960ffaef96'::uuid,
    '697ee537-2f4e-4678-8f87-3619fbbe498d'::uuid,
    '8ce15f17-5e33-413a-8127-d53874ec4c37'::uuid,
    'f33d30f1-cd8b-42ff-8162-bd935fc85596'::uuid,
    'c76f4dd0-1517-46e8-8a00-c24bdae212ed'::uuid,
    '3a87bf00-ca0a-4cab-88da-5f218550755b'::uuid,
    '9cce6404-d4dd-4192-88b9-2255cba29eed'::uuid,
    'e397b714-7794-464e-8d8d-105699ebf874'::uuid,
    '2bb906a8-36dd-48b6-87fc-ec7579f6af60'::uuid,
    '327339a1-2f57-4d44-8e71-64cb29a4c371'::uuid,
    '7f15c079-1a31-4a4b-866d-24bac84bc821'::uuid,
    '47e6dbd8-1d72-448a-8763-66b604268303'::uuid,
    '30244b05-0050-48a5-8a97-a12be8e778d9'::uuid,
    'c7a7a91b-faac-4702-808d-c1ce9727aed8'::uuid,
    'bf78137e-8291-49f1-8138-a966caa3d626'::uuid,
    'c183387e-a1f0-4bdd-8292-1128fc44c85b'::uuid,
    '8585d966-4456-44a6-8d29-5473a874ca40'::uuid,
    'b4a246b2-bf30-499a-8587-80390b561505'::uuid,
    '05457ba2-816d-47f7-872a-433cd7d8a740'::uuid,
    'c8bcb1de-3ee5-41ba-8684-ec84f492936c'::uuid,
    '9345dd9c-df8b-4c3e-8b44-1bb4dae76794'::uuid,
    'a3446e33-b8e5-4989-8109-286c56727289'::uuid,
    '1041bdcd-59ac-4fc5-8532-37f698d58869'::uuid,
    'bcc38dec-7742-42e4-855f-7134218d12f3'::uuid,
    '765be57a-89fa-4dcf-8d06-202546391014'::uuid,
    '5879fb26-be8b-4ac2-8e3d-55033d19171c'::uuid,
    'ea6f0682-f2e9-43e3-8d2f-008fc430b6ae'::uuid,
    '0a5c616a-67bf-48db-8cca-6080815ce198'::uuid,
    '2e1aef8c-908b-4210-8c51-65ce2c1538ba'::uuid,
    '275b84cf-4ab4-49c4-8c06-bd2fd229b262'::uuid,
    '90358095-a4f4-4d4b-8db1-df899bdf9a92'::uuid,
    'e0d80ce4-e139-4610-8f5e-5121db093d18'::uuid,
    'ea750122-364a-4a46-80c5-297429428d57'::uuid,
    '4bb464dd-4c60-44cc-8e1a-b41d80018a11'::uuid,
    'dffc70fe-59f5-43aa-8f20-5de8d8b49276'::uuid,
    '4beebbad-5b38-4f7c-86fe-6126c72c31de'::uuid,
    '78e297a8-6b41-482c-8093-6334c0a57408'::uuid,
    '31adb490-a86b-4e77-8762-df38ad84a035'::uuid,
    'f6567903-7def-48ed-864a-6706d2724acb'::uuid,
    '5f701df3-2d18-4e41-8e71-fc1555b31ffa'::uuid,
    'ac60e28b-3393-4b7c-8026-95facfbc4761'::uuid
  ];
begin
  select id into v_warehouse_id from public.warehouses where code = 'ES-MAD-01' limit 1;
  if v_warehouse_id is null then
    select id into v_warehouse_id from public.warehouses limit 1;
  end if;

  if v_warehouse_id is not null then
    foreach v_variant_id in array v_variants
    loop
      insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
      values (v_warehouse_id, v_variant_id, 0, 0)
      on conflict (warehouse_id, variant_id) do nothing;

      select greatest(0, i.on_hand - i.reserved) into v_available
      from public.inventory i
      where i.warehouse_id = v_warehouse_id and i.variant_id = v_variant_id;

      if v_available < 10 then
        perform private.adjust_inventory(
          v_warehouse_id,
          v_variant_id,
          10 - v_available,
          'Alta de existencias para PC Builder autorizado NODRIA'
        );
      end if;
    end loop;
  end if;
end;
$inventory_seed$;

commit;
