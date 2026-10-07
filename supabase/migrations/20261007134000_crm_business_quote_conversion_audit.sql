-- An accepted B2B quote can be converted exactly once into an immutable,
-- tenant-scoped conversion record. A formal commerce order is intentionally
-- deferred until its address, payment terms and stock reservation contract is
-- agreed with the commerce owner.

create table public.business_quote_conversions (
  id uuid primary key default gen_random_uuid(),
  conversion_number text not null unique,
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  converted_by uuid not null references auth.users(id) on delete restrict,
  organization_snapshot jsonb not null check (jsonb_typeof(organization_snapshot) = 'object'),
  quote_snapshot jsonb not null check (jsonb_typeof(quote_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  constraint business_quote_conversion_number_format
    check (conversion_number ~ '^NOD-C-[0-9]{8}-[A-F0-9]{8}$')
);

create index business_quote_conversions_org_date_idx
  on public.business_quote_conversions (organization_id, created_at desc);

alter table public.business_quote_conversions enable row level security;

create policy business_quote_conversions_read_member
  on public.business_quote_conversions for select to authenticated
  using ((select private.is_org_member(organization_id))
    or (select private.has_any_staff_role(array['super_admin']::public.app_role[])));

revoke all on public.business_quote_conversions from public, anon, authenticated;
grant select on public.business_quote_conversions to authenticated;

create or replace function private.convert_accepted_business_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
  v_conversion public.business_quote_conversions%rowtype;
  v_organization public.organizations%rowtype;
  v_lines jsonb;
  v_conversion_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required';
  end if;
  if p_quote_id is null then
    raise exception using errcode = '22023', message = 'A quote id is required';
  end if;

  select q.* into v_quote
    from public.quotes q
    where q.id = p_quote_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Business quote not found';
  end if;
  if not (select private.is_org_admin(v_quote.organization_id)) then
    raise exception using errcode = '42501', message = 'Only an organization owner or admin can convert an accepted quote';
  end if;

  select c.* into v_conversion
    from public.business_quote_conversions c
    where c.quote_id = p_quote_id;
  if found then
    return v_conversion.id;
  end if;
  if v_quote.status <> 'accepted' then
    raise exception using errcode = '23514', message = 'Only an accepted quote can be converted';
  end if;

  select o.* into v_organization
    from public.organizations o
    where o.id = v_quote.organization_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Quote organization not found';
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
  ) into v_lines
  from public.quote_items qi
  where qi.quote_id = p_quote_id;
  if coalesce(pg_catalog.jsonb_array_length(v_lines), 0) = 0 then
    raise exception using errcode = '23514', message = 'An accepted quote needs at least one item';
  end if;

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
    pg_catalog.jsonb_build_object(
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
      'items', v_lines
    )
  ) returning id into v_conversion_id;

  insert into public.crm_activities (
    organization_id, quote_id, actor_user_id, event_key, title,
    subject_name, company_snapshot, body, visibility, details
  ) values (
    v_quote.organization_id, v_quote.id, v_user_id, 'quote_conversion_recorded',
    'Conversión de propuesta registrada', v_quote.requester_name,
    v_quote.organization_name_snapshot,
    'Registro auditable creado. La emisión de un pedido formal queda pendiente de definir dirección, pago y reserva de stock.',
    'organization',
    pg_catalog.jsonb_build_object(
      'conversion_id', v_conversion_id,
      'conversion_number', (select c.conversion_number from public.business_quote_conversions c where c.id = v_conversion_id),
      'grand_total', v_quote.grand_total,
      'currency', v_quote.currency
    )
  );

  return v_conversion_id;
end;
$$;

revoke all on function private.convert_accepted_business_quote(uuid) from public, anon, authenticated;
grant execute on function private.convert_accepted_business_quote(uuid) to authenticated;

create or replace function public.convert_accepted_business_quote(p_quote_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.convert_accepted_business_quote(p_quote_id);
$$;

revoke all on function public.convert_accepted_business_quote(uuid) from public, anon;
grant execute on function public.convert_accepted_business_quote(uuid) to authenticated;
