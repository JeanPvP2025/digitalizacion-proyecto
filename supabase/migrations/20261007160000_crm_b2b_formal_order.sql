-- Convert an accepted business quote to a formal, pending-payment order in one
-- transaction. The B2C checkout RPC and its price authority remain unchanged.

create table public.business_quote_orders (
  order_id uuid primary key references public.orders(id) on delete restrict,
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  conversion_id uuid not null unique references public.business_quote_conversions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  organization_snapshot jsonb not null check (jsonb_typeof(organization_snapshot) = 'object'),
  quote_snapshot jsonb not null check (jsonb_typeof(quote_snapshot) = 'object'),
  payment_terms_code text not null check (payment_terms_code = 'prepaid_before_dispatch'),
  payment_terms_snapshot text not null check (char_length(payment_terms_snapshot) between 2 and 500),
  delivery_terms_snapshot text not null check (char_length(delivery_terms_snapshot) between 2 and 500),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default pg_catalog.now()
);

create index business_quote_orders_org_date_idx
  on public.business_quote_orders (organization_id, created_at desc);

alter table public.business_quote_orders enable row level security;

create policy business_quote_orders_read_member
  on public.business_quote_orders for select to authenticated
  using ((select private.is_org_member(organization_id))
    or (select private.has_any_staff_role(array['super_admin']::public.app_role[])));

revoke all on public.business_quote_orders from public, anon, authenticated;
grant select on public.business_quote_orders to authenticated;

-- Formal B2B orders are visible to their organization. Viewer membership is
-- read-only; all order creation still goes through the checked quote RPC below.
drop policy if exists orders_read_owner_or_staff on public.orders;
create policy orders_read_owner_or_staff on public.orders for select to authenticated
  using (customer_id = (select auth.uid())
    or (organization_id is not null and (select private.is_org_member(organization_id)))
    or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])));

drop policy if exists order_items_read_owner_or_staff on public.order_items;
create policy order_items_read_owner_or_staff on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid())
       or (o.organization_id is not null and (select private.is_org_member(o.organization_id)))
       or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])))
  ));

drop policy if exists order_events_read_owner_or_staff on public.order_events;
create policy order_events_read_owner_or_staff on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid())
       or (o.organization_id is not null and (select private.is_org_member(o.organization_id)))
       or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])))
  ));

drop policy if exists payments_read_owner_or_staff on public.payment_transactions;
create policy payments_read_owner_or_staff on public.payment_transactions for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid())
       or (o.organization_id is not null and (select private.is_org_member(o.organization_id)))
       or (select private.has_any_staff_role(array['fulfillment_manager', 'sales_manager', 'super_admin']::public.app_role[])))
  ));

create or replace function private.create_business_order_from_accepted_quote(
  p_quote_id uuid,
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
  v_quote public.quotes%rowtype;
  v_organization public.organizations%rowtype;
  v_conversion public.business_quote_conversions%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_order_status public.order_status;
  v_order_total numeric(12,2);
  v_order_currency text;
  v_request_fingerprint text;
  v_checkout_fingerprint text;
  v_items_payload jsonb;
  v_quote_lines jsonb;
  v_quote_snapshot jsonb;
  v_conversion_id uuid;
  v_item record;
  v_stock record;
  v_order_item_id uuid;
  v_available integer;
  v_remaining integer;
  v_take integer;
  v_existing_fingerprint text;
  v_payment_terms_code constant text := 'prepaid_before_dispatch';
  v_payment_terms_snapshot constant text := 'Pago anticipado antes de expedición. El portal no procesa pagos ni solicita datos de tarjeta.';
  v_delivery_terms_snapshot constant text := 'Entrega en la dirección indicada. El coste de transporte queda excluido del total y se cotizará por separado.';
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to create a business order';
  end if;
  if p_quote_id is null then
    raise exception using errcode = '22023', message = 'A business quote id is required';
  end if;
  if p_shipping_address is null or p_billing_address is null
     or pg_catalog.jsonb_typeof(p_shipping_address) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_billing_address) is distinct from 'object'
     or pg_catalog.octet_length(p_shipping_address::text) > 4096
     or pg_catalog.octet_length(p_billing_address::text) > 4096
     or p_shipping_address - 'fullName' - 'address' - 'postalCode' - 'city' - 'countryCode' <> '{}'::jsonb
     or p_billing_address - 'fullName' - 'address' - 'postalCode' - 'city' - 'countryCode' <> '{}'::jsonb
     or not private.is_checkout_address(p_shipping_address)
     or not private.is_checkout_address(p_billing_address) then
    raise exception using errcode = '22023', message = 'Shipping and billing addresses must be complete Spanish addresses';
  end if;

  select q.* into v_quote
    from public.quotes q
    where q.id = p_quote_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Business quote not found';
  end if;
  if not (select private.is_org_admin(v_quote.organization_id)) then
    raise exception using errcode = '42501', message = 'Only an organization owner or admin can create an order from a quote';
  end if;
  if v_quote.status <> 'accepted' then
    raise exception using errcode = '23514', message = 'Only an accepted business quote can become an order';
  end if;

  v_request_fingerprint := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'quote_id', v_quote.id,
          'shipping_address', p_shipping_address,
          'billing_address', p_billing_address,
          'payment_terms_code', v_payment_terms_code,
          'payment_terms_snapshot', v_payment_terms_snapshot,
          'delivery_terms_snapshot', v_delivery_terms_snapshot
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select bqo.request_fingerprint, o.id, o.order_number, o.status, o.grand_total, o.currency
    into v_existing_fingerprint, v_order_id, v_order_number, v_order_status, v_order_total, v_order_currency
    from public.business_quote_orders bqo
    join public.orders o on o.id = bqo.order_id
    where bqo.quote_id = p_quote_id
    for update of bqo, o;
  if found then
    if v_existing_fingerprint is distinct from v_request_fingerprint then
      raise exception using errcode = '23505', message = 'An order already exists for this quote with different addresses or terms';
    end if;
    return query select v_order_id, v_order_number, v_order_status, v_order_total, v_order_currency;
    return;
  end if;

  select o.* into v_organization
    from public.organizations o
    where o.id = v_quote.organization_id and o.is_active;
  if not found then
    raise exception using errcode = '23514', message = 'The quote organization is not active';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'quote_item_id', qi.id,
      'product_id', qi.product_id,
      'product_name', qi.product_name,
      'sku', qi.product_sku,
      'variant_title', qi.variant_title,
      'variant_attributes', qi.variant_attributes,
      'quantity', qi.quantity,
      'unit_price', coalesce(qi.offered_unit_price, qi.requested_unit_price),
      'tax_rate', qi.tax_rate,
      'currency', qi.currency,
      'line_subtotal', qi.line_subtotal,
      'line_tax', qi.line_tax,
      'line_total', qi.line_total
    ) order by qi.created_at, qi.id
  ) into v_quote_lines
  from public.quote_items qi
  where qi.quote_id = p_quote_id;
  if coalesce(pg_catalog.jsonb_array_length(v_quote_lines), 0) = 0
     or exists (select 1 from public.quote_items qi where qi.quote_id = p_quote_id and qi.currency <> v_quote.currency)
     or v_quote.grand_total is distinct from (select coalesce(sum(qi.line_total), 0)::numeric(12,2) from public.quote_items qi where qi.quote_id = p_quote_id)
     or v_quote.subtotal is distinct from (select coalesce(sum(qi.line_subtotal), 0)::numeric(12,2) from public.quote_items qi where qi.quote_id = p_quote_id)
     or v_quote.tax_total is distinct from (select coalesce(sum(qi.line_tax), 0)::numeric(12,2) from public.quote_items qi where qi.quote_id = p_quote_id) then
    raise exception using errcode = '23514', message = 'Accepted quote lines and totals are inconsistent';
  end if;

  select pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_array(qi.variant_id::text, qi.quantity)
           order by qi.variant_id
         )
    into v_items_payload
    from public.quote_items qi
    where qi.quote_id = p_quote_id;
  v_checkout_fingerprint := private.checkout_payload_fingerprint(
    v_items_payload, p_shipping_address, p_billing_address
  );
  v_quote_snapshot := pg_catalog.jsonb_build_object(
    'quote_id', v_quote.id,
    'quote_number', v_quote.quote_number,
    'requester_name', v_quote.requester_name,
    'requester_email', v_quote.requester_email,
    'organization_name', v_quote.organization_name_snapshot,
    'request_note', v_quote.request_note,
    'currency', v_quote.currency,
    'subtotal', v_quote.subtotal,
    'tax_total', v_quote.tax_total,
    'grand_total', v_quote.grand_total,
    'accepted_at', v_quote.updated_at,
    'items', v_quote_lines
  );

  select c.* into v_conversion
    from public.business_quote_conversions c
    where c.quote_id = p_quote_id;
  if found then
    v_conversion_id := v_conversion.id;
  else
    insert into public.business_quote_conversions (
      conversion_number, quote_id, organization_id, converted_by,
      organization_snapshot, quote_snapshot
    ) values (
      'NOD-C-' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD') || '-' ||
        pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)),
      v_quote.id, v_quote.organization_id, v_user_id,
      pg_catalog.jsonb_build_object(
        'organization_id', v_organization.id,
        'display_name', v_organization.display_name,
        'legal_name', v_organization.legal_name,
        'tax_id', v_organization.tax_id,
        'billing_email', v_organization.billing_email,
        'slug', v_organization.slug
      ),
      v_quote_snapshot
    ) returning id into v_conversion_id;

    insert into public.crm_activities (
      organization_id, quote_id, actor_user_id, event_key, title,
      subject_name, company_snapshot, body, visibility, details
    ) values (
      v_quote.organization_id, v_quote.id, v_user_id, 'quote_conversion_recorded',
      'Conversión de propuesta registrada', v_quote.requester_name,
      v_quote.organization_name_snapshot,
      'Se ha guardado el snapshot de la propuesta aceptada como parte de la emisión del pedido empresarial.',
      'organization',
      pg_catalog.jsonb_build_object(
        'conversion_id', v_conversion_id,
        'grand_total', v_quote.grand_total,
        'currency', v_quote.currency
      )
    );
  end if;

  v_order_number := 'NOD-B-' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD') || '-' ||
    pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.orders (
    order_number, customer_id, idempotency_key, checkout_fingerprint, organization_id,
    status, currency, subtotal, tax_total, shipping_total, discount_total, grand_total,
    shipping_address, billing_address
  ) values (
    v_order_number, v_user_id, 'b2b_quote:' || v_quote.id::text, v_checkout_fingerprint, v_quote.organization_id,
    'pending_payment', v_quote.currency, v_quote.subtotal, v_quote.tax_total, 0, 0, v_quote.grand_total,
    p_shipping_address, p_billing_address
  ) returning id into v_order_id;

  for v_item in
    select qi.variant_id, qi.product_id, qi.product_name, qi.product_sku,
           qi.variant_title, qi.variant_attributes, qi.quantity,
           coalesce(qi.offered_unit_price, qi.requested_unit_price) as unit_price,
           qi.tax_rate, qi.currency
      from public.quote_items qi
      where qi.quote_id = p_quote_id
      order by qi.variant_id
  loop
    insert into public.order_items (
      order_id, variant_id, product_id, product_name, product_sku,
      variant_title, variant_attributes, quantity, unit_price, currency, tax_rate
    ) values (
      v_order_id, v_item.variant_id, v_item.product_id, v_item.product_name, v_item.product_sku,
      v_item.variant_title, v_item.variant_attributes, v_item.quantity, v_item.unit_price, v_item.currency, v_item.tax_rate
    ) returning id into v_order_item_id;

    perform i.warehouse_id
      from public.inventory i
      join public.warehouses w on w.id = i.warehouse_id
      where i.variant_id = v_item.variant_id and w.is_active
      order by w.code, i.warehouse_id
      for update of i;
    select coalesce(sum(i.on_hand - i.reserved), 0)::integer
      into v_available
      from public.inventory i
      join public.warehouses w on w.id = i.warehouse_id
      where i.variant_id = v_item.variant_id and w.is_active;
    if v_available < v_item.quantity then
      raise exception using errcode = 'P0001', message = 'Insufficient stock for accepted quote SKU ' || v_item.product_sku;
    end if;

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
      raise exception using errcode = 'P0001', message = 'Inventory changed while the business order was being created';
    end if;
  end loop;

  insert into public.payment_transactions (order_id, provider, status, amount, currency)
    values (v_order_id, 'checkout', 'pending', v_quote.grand_total, v_quote.currency);
  insert into public.order_events (order_id, actor_user_id, event_key, note, details)
    values (
      v_order_id, v_user_id, 'business_order_created',
      'Pedido empresarial emitido desde una propuesta aceptada. Pago anticipado pendiente; el transporte se cotizará por separado.',
      pg_catalog.jsonb_build_object(
        'quote_id', v_quote.id,
        'quote_number', v_quote.quote_number,
        'conversion_id', v_conversion_id,
        'payment_terms_code', v_payment_terms_code,
        'delivery_terms_snapshot', v_delivery_terms_snapshot,
        'grand_total', v_quote.grand_total,
        'currency', v_quote.currency
      )
    );

  insert into public.business_quote_orders (
    order_id, quote_id, conversion_id, organization_id, created_by,
    organization_snapshot, quote_snapshot, payment_terms_code,
    payment_terms_snapshot, delivery_terms_snapshot, request_fingerprint
  ) values (
    v_order_id, v_quote.id, v_conversion_id, v_quote.organization_id, v_user_id,
    (select c.organization_snapshot from public.business_quote_conversions c where c.id = v_conversion_id),
    (select c.quote_snapshot from public.business_quote_conversions c where c.id = v_conversion_id),
    v_payment_terms_code, v_payment_terms_snapshot, v_delivery_terms_snapshot, v_request_fingerprint
  );

  insert into public.crm_activities (
    organization_id, quote_id, actor_user_id, event_key, title,
    subject_name, company_snapshot, body, visibility, details
  ) values (
    v_quote.organization_id, v_quote.id, v_user_id, 'business_order_created',
    'Pedido empresarial formal emitido', v_quote.requester_name,
    v_quote.organization_name_snapshot,
    'Pedido ' || v_order_number || ' creado con el precio aceptado. Pago anticipado pendiente; el transporte se cotizará por separado.',
    'organization',
    pg_catalog.jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'conversion_id', v_conversion_id,
      'payment_terms_code', v_payment_terms_code,
      'grand_total', v_quote.grand_total,
      'currency', v_quote.currency
    )
  );

  return query select v_order_id, v_order_number, 'pending_payment'::public.order_status, v_quote.grand_total, v_quote.currency;
end;
$$;

revoke all on function private.create_business_order_from_accepted_quote(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function private.create_business_order_from_accepted_quote(uuid, jsonb, jsonb) to authenticated;

create or replace function public.create_business_order_from_accepted_quote(
  p_quote_id uuid,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, status public.order_status, grand_total numeric, currency text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_business_order_from_accepted_quote(
    p_quote_id, p_shipping_address, p_billing_address
  );
$$;

revoke all on function public.create_business_order_from_accepted_quote(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_business_order_from_accepted_quote(uuid, jsonb, jsonb) to authenticated;
