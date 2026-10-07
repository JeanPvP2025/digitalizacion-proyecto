-- NODRIA commerce foundation for Supabase/PostgreSQL.
-- Generated with `supabase migration new nodria_commerce_foundation` (CLI 2.120.0).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

do $$ begin
  create type public.app_role as enum (
    'catalog_manager', 'fulfillment_manager', 'support_agent', 'sales_manager', 'super_admin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_role as enum ('owner', 'admin', 'buyer', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cart_status as enum ('active', 'converted', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'partially_refunded', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quote_status as enum ('requested', 'in_review', 'sent', 'accepted', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.return_status as enum ('requested', 'approved', 'rejected', 'received', 'refunded', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '' check (char_length(display_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  locale text not null default 'es-ES' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_role_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  legal_name text not null check (char_length(legal_name) between 2 and 180),
  display_name text not null check (char_length(display_name) between 2 and 120),
  tax_id text check (tax_id is null or char_length(tax_id) <= 32),
  billing_email text check (billing_email is null or char_length(billing_email) <= 254),
  created_by uuid not null references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  added_by uuid not null references auth.users(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx on public.organization_memberships (user_id, organization_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku text not null unique check (sku = upper(sku) and char_length(sku) <= 64),
  name text not null check (char_length(name) between 2 and 180),
  brand text not null check (char_length(brand) between 1 and 80),
  summary text not null default '' check (char_length(summary) <= 500),
  description text not null default '',
  image_url text,
  image_alt text not null default '' check (char_length(image_alt) <= 300),
  badge text check (badge is null or char_length(badge) <= 80),
  rating_average numeric(2,1) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  is_featured boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_public_idx on public.products (is_published, is_featured, name);

create table if not exists public.product_categories (
  product_id text not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_idx on public.product_categories (category_id, product_id);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  sku text not null unique check (sku = upper(sku) and char_length(sku) <= 64),
  barcode text unique,
  title text not null default 'Estándar' check (char_length(title) <= 120),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  current_price numeric(12,2) not null check (current_price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= current_price),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  tax_rate numeric(5,4) not null default 0.21 check (tax_rate between 0 and 1),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants (product_id, is_active);

create table if not exists public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  value text not null check (char_length(value) between 1 and 500),
  sort_order integer not null default 0,
  unique (product_id, label)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 2 and 32),
  name text not null check (char_length(name) between 2 and 120),
  city text not null check (char_length(city) <= 100),
  country_code text not null default 'ES' check (country_code ~ '^[A-Z]{2}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, variant_id)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  status public.cart_status not null default 'active',
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists carts_one_active_per_user_idx on public.carts (user_id) where status = 'active';
create index if not exists carts_organization_idx on public.carts (organization_id) where organization_id is not null;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 50),
  added_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  organization_id uuid references public.organizations(id) on delete set null,
  status public.order_status not null default 'pending_payment',
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  grand_total numeric(12,2) not null check (grand_total >= 0),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  billing_address jsonb not null check (jsonb_typeof(billing_address) = 'object'),
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grand_total = subtotal + tax_total + shipping_total - discount_total)
);

create unique index if not exists orders_customer_idempotency_idx on public.orders (customer_id, idempotency_key);

create index if not exists orders_customer_date_idx on public.orders (customer_id, placed_at desc);
create index if not exists orders_organization_date_idx on public.orders (organization_id, placed_at desc) where organization_id is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  product_sku text not null,
  variant_title text not null default 'Estándar',
  variant_attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(variant_attributes) = 'object'),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  tax_rate numeric(5,4) not null default 0.21 check (tax_rate between 0 and 1),
  -- Catalog and fixture prices are consumer-facing IVA-inclusive amounts.
  line_subtotal numeric(12,2) generated always as (round(unit_price * quantity / (1 + tax_rate), 2)) stored,
  tax_amount numeric(12,2) generated always as (round(unit_price * quantity, 2) - round(unit_price * quantity / (1 + tax_rate), 2)) stored,
  line_total numeric(12,2) generated always as (round(unit_price * quantity, 2)) stored,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (char_length(provider) between 2 and 64),
  provider_reference text,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create index if not exists payment_transactions_order_idx on public.payment_transactions (order_id, created_at desc);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  released_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_item_id, warehouse_id),
  check (released_at is null or fulfilled_at is null)
);

create index if not exists inventory_reservations_warehouse_idx on public.inventory_reservations (warehouse_id, created_at);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_key text not null check (char_length(event_key) between 2 and 80),
  note text not null default '' check (char_length(note) <= 1000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, occurred_at);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique,
  requested_by uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  status public.quote_status not null default 'requested',
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  request_note text not null default '' check (char_length(request_note) <= 2000),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_requester_date_idx on public.quotes (requested_by, created_at desc);
create index if not exists quotes_organization_idx on public.quotes (organization_id, created_at desc) where organization_id is not null;

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 10000),
  requested_unit_price numeric(12,2) check (requested_unit_price is null or requested_unit_price >= 0),
  offered_unit_price numeric(12,2) check (offered_unit_price is null or offered_unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (quote_id, variant_id)
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  email text not null check (email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  company text check (company is null or char_length(company) <= 180),
  source text not null default 'website' check (char_length(source) <= 64),
  message text not null check (char_length(message) between 10 and 4000),
  consent_to_contact boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists crm_leads_email_idx on public.crm_leads (email, created_at desc);

do $$ begin
  create type public.prospect_status as enum ('new', 'qualified', 'contacted', 'converted', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.quote_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  email text not null check (email = lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  company text check (company is null or char_length(company) <= 180),
  message text not null check (char_length(message) between 10 and 4000),
  consent_to_contact boolean not null default false,
  status public.prospect_status not null default 'new',
  source text not null default 'website' check (char_length(source) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_inquiries_status_date_idx on public.quote_inquiries (status, created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 180),
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'normal',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_customer_date_idx on public.support_tickets (customer_id, created_at desc);
create index if not exists support_tickets_queue_idx on public.support_tickets (status, priority, created_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_date_idx on public.support_messages (ticket_id, created_at);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  status public.return_status not null default 'requested',
  reason text not null check (char_length(reason) between 10 and 2000),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists return_requests_customer_date_idx on public.return_requests (customer_id, requested_at desc);
create index if not exists return_requests_order_idx on public.return_requests (order_id);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  condition_note text not null default '' check (char_length(condition_note) <= 1000),
  created_at timestamptz not null default now(),
  unique (return_request_id, order_item_id)
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text not null,
  changed_columns text[] not null default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_entity_idx on public.audit_events (entity_type, entity_id, occurred_at desc);
create index if not exists audit_events_actor_idx on public.audit_events (actor_user_id, occurred_at desc) where actor_user_id is not null;

create or replace function private.set_quote_inquiry_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists quote_inquiries_set_creator on public.quote_inquiries;
create trigger quote_inquiries_set_creator before insert on public.quote_inquiries
  for each row execute function private.set_quote_inquiry_creator();

create or replace function private.has_any_staff_role(allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role_grants as grants
    where grants.user_id = (select auth.uid())
      and grants.role = any (allowed_roles)
  );
$$;

create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as memberships
    where memberships.organization_id = target_organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_org_creator(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations as organizations
    where organizations.id = target_organization_id
      and organizations.created_by = (select auth.uid())
  );
$$;

create or replace function private.org_creator_matches(target_organization_id uuid, proposed_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations as organizations
    where organizations.id = target_organization_id
      and organizations.created_by = proposed_creator_id
  );
$$;

revoke all on function private.has_any_staff_role(public.app_role[]) from public;
revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.is_org_admin(uuid) from public;
revoke all on function private.is_org_creator(uuid) from public;
revoke all on function private.org_creator_matches(uuid, uuid) from public;
grant execute on function private.has_any_staff_role(public.app_role[]) to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.is_org_creator(uuid) to authenticated;
grant execute on function private.org_creator_matches(uuid, uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    pg_catalog.lower(coalesce(new.email, '')),
    pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public;
revoke all on function private.set_quote_inquiry_creator() from public;
revoke all on function private.set_updated_at() from public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert or update of email on auth.users
  for each row execute function private.create_profile_for_auth_user();

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_id text;
  changed text[];
begin
  if tg_op = 'INSERT' then
    new_row := pg_catalog.to_jsonb(new);
    row_id := case tg_table_name
      when 'inventory' then (new_row ->> 'warehouse_id') || ':' || (new_row ->> 'variant_id')
      when 'organization_memberships' then (new_row ->> 'organization_id') || ':' || (new_row ->> 'user_id')
      else new_row ->> 'id'
    end;
    select coalesce(pg_catalog.array_agg(fields.key order by fields.key), '{}'::text[])
      into changed
      from pg_catalog.jsonb_each(new_row) as fields(key, value);
  elsif tg_op = 'DELETE' then
    old_row := pg_catalog.to_jsonb(old);
    row_id := case tg_table_name
      when 'inventory' then (old_row ->> 'warehouse_id') || ':' || (old_row ->> 'variant_id')
      when 'organization_memberships' then (old_row ->> 'organization_id') || ':' || (old_row ->> 'user_id')
      else old_row ->> 'id'
    end;
    select coalesce(pg_catalog.array_agg(fields.key order by fields.key), '{}'::text[])
      into changed
      from pg_catalog.jsonb_each(old_row) as fields(key, value);
  else
    old_row := pg_catalog.to_jsonb(old);
    new_row := pg_catalog.to_jsonb(new);
    row_id := case tg_table_name
      when 'inventory' then (new_row ->> 'warehouse_id') || ':' || (new_row ->> 'variant_id')
      when 'organization_memberships' then (new_row ->> 'organization_id') || ':' || (new_row ->> 'user_id')
      else new_row ->> 'id'
    end;
    select coalesce(pg_catalog.array_agg(fields.key order by fields.key), '{}'::text[])
      into changed
      from pg_catalog.jsonb_each(new_row) as fields(key, value)
      where old_row -> fields.key is distinct from fields.value;
  end if;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, changed_columns)
  values ((select auth.uid()), tg_op, tg_table_name, row_id, changed);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.audit_row_change() from public;

create or replace function private.ticket_number_for_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'SUP-' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD') || '-' ||
      pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

create or replace function private.return_number_for_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.return_number is null or new.return_number = '' then
    new.return_number := 'RET-' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD') || '-' ||
      pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

revoke all on function private.ticket_number_for_insert() from public;
revoke all on function private.return_number_for_insert() from public;

-- Checkout is exposed through the SECURITY INVOKER wrapper below. This narrowly scoped
-- definer performs the multi-row stock reservation and immutable order snapshot atomically.
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
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required to place an order';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 120 then
    raise exception using errcode = '22023', message = 'A valid checkout idempotency key is required';
  end if;
  if jsonb_typeof(p_shipping_address) is distinct from 'object'
     or jsonb_typeof(p_billing_address) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Shipping and billing addresses must be JSON objects';
  end if;

  -- Serialize retries for the same customer/key before checking existing orders.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );
  select o.* into v_existing
    from public.orders as o
    where o.customer_id = v_user_id and o.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_existing.order_number, v_existing.grand_total, v_existing.currency;
    return;
  end if;

  select c.* into v_cart
    from public.carts as c
    where c.id = p_cart_id and c.user_id = v_user_id and c.status = 'active'
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Active cart not found';
  end if;
  if v_cart.organization_id is not null and not private.is_org_member(v_cart.organization_id) then
    raise exception using errcode = '42501', message = 'The current user is not a member of this organization';
  end if;

  -- Lock cart lines so their quantities cannot change while checkout is being priced.
  perform ci.id
    from public.cart_items as ci
    where ci.cart_id = p_cart_id
    order by ci.variant_id
    for update of ci;
  if not exists (select 1 from public.cart_items as ci where ci.cart_id = p_cart_id) then
    raise exception using errcode = '22023', message = 'Cannot place an empty cart';
  end if;

  -- Lock variants and their inventory rows, then verify live publication, price and stock.
  for v_item in
    select ci.variant_id, ci.quantity, v.sku, v.current_price, v.currency, v.tax_rate,
           v.title as variant_title, v.attributes, v.is_active,
           p.id as product_id, p.name as product_name, p.is_published
      from public.cart_items as ci
      join public.product_variants as v on v.id = ci.variant_id
      join public.products as p on p.id = v.product_id
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
      from public.inventory as i
      join public.warehouses as w on w.id = i.warehouse_id
      where i.variant_id = v_item.variant_id and w.is_active
      order by w.code, i.warehouse_id
      for update of i;
    select coalesce(sum(i.on_hand - i.reserved), 0)::integer into v_available
      from public.inventory as i
      join public.warehouses as w on w.id = i.warehouse_id
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
    order_number, customer_id, idempotency_key, organization_id, status, currency,
    subtotal, tax_total, shipping_total, discount_total, grand_total,
    shipping_address, billing_address
  ) values (
    v_order_number, v_user_id, p_idempotency_key, v_cart.organization_id, 'pending_payment', v_currency,
    v_subtotal, v_tax_total, 0, 0, v_grand_total, p_shipping_address, p_billing_address
  ) returning id into v_order_id;

  for v_item in
    select ci.variant_id, ci.quantity, v.sku, v.current_price, v.currency, v.tax_rate,
           v.title as variant_title, v.attributes,
           p.id as product_id, p.name as product_name
      from public.cart_items as ci
      join public.product_variants as v on v.id = ci.variant_id
      join public.products as p on p.id = v.product_id
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
        from public.inventory as i
        join public.warehouses as w on w.id = i.warehouse_id
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
    values (v_order_id, v_user_id, 'order_created', 'Pedido creado; pago pendiente', jsonb_build_object('status', 'pending_payment'));
  update public.carts set status = 'converted' where id = p_cart_id;

  return query select v_order_id, v_order_number, v_grand_total, v_currency;
end;
$$;

revoke all on function private.place_order(uuid, text, jsonb, jsonb) from public;
grant execute on function private.place_order(uuid, text, jsonb, jsonb) to authenticated;

-- This invoker wrapper is the only checkout function exposed to the Data API.
create or replace function public.place_order(
  p_cart_id uuid,
  p_idempotency_key text,
  p_shipping_address jsonb,
  p_billing_address jsonb
)
returns table(order_id uuid, order_number text, grand_total numeric, currency text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.place_order(p_cart_id, p_idempotency_key, p_shipping_address, p_billing_address);
$$;

revoke all on function public.place_order(uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, jsonb, jsonb) to authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function private.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants for each row execute function private.set_updated_at();
drop trigger if exists warehouses_set_updated_at on public.warehouses;
create trigger warehouses_set_updated_at before update on public.warehouses for each row execute function private.set_updated_at();
drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at before update on public.inventory for each row execute function private.set_updated_at();
drop trigger if exists carts_set_updated_at on public.carts;
create trigger carts_set_updated_at before update on public.carts for each row execute function private.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function private.set_updated_at();
drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at before update on public.quotes for each row execute function private.set_updated_at();
drop trigger if exists quote_inquiries_set_updated_at on public.quote_inquiries;
create trigger quote_inquiries_set_updated_at before update on public.quote_inquiries for each row execute function private.set_updated_at();
drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function private.set_updated_at();
drop trigger if exists return_requests_set_updated_at on public.return_requests;
create trigger return_requests_set_updated_at before update on public.return_requests for each row execute function private.set_updated_at();

drop trigger if exists support_tickets_assign_number on public.support_tickets;
create trigger support_tickets_assign_number before insert on public.support_tickets for each row execute function private.ticket_number_for_insert();
drop trigger if exists return_requests_assign_number on public.return_requests;
create trigger return_requests_assign_number before insert on public.return_requests for each row execute function private.return_number_for_insert();

drop trigger if exists products_audit on public.products;
create trigger products_audit after insert or update or delete on public.products for each row execute function private.audit_row_change();
drop trigger if exists product_variants_audit on public.product_variants;
create trigger product_variants_audit after insert or update or delete on public.product_variants for each row execute function private.audit_row_change();
drop trigger if exists organization_memberships_audit on public.organization_memberships;
create trigger organization_memberships_audit after insert or update or delete on public.organization_memberships for each row execute function private.audit_row_change();
drop trigger if exists inventory_audit on public.inventory;
create trigger inventory_audit after insert or update or delete on public.inventory for each row execute function private.audit_row_change();
drop trigger if exists orders_audit on public.orders;
create trigger orders_audit after insert or update or delete on public.orders for each row execute function private.audit_row_change();
drop trigger if exists payment_transactions_audit on public.payment_transactions;
create trigger payment_transactions_audit after insert or update or delete on public.payment_transactions for each row execute function private.audit_row_change();
drop trigger if exists inventory_reservations_audit on public.inventory_reservations;
create trigger inventory_reservations_audit after insert or update or delete on public.inventory_reservations for each row execute function private.audit_row_change();

alter table public.profiles enable row level security;
alter table public.user_role_grants enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_specifications enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.crm_leads enable row level security;
alter table public.quote_inquiries enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists role_grants_read_self_or_admin on public.user_role_grants;
create policy role_grants_read_self_or_admin on public.user_role_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_any_staff_role(array['super_admin']::public.app_role[])));

drop policy if exists organizations_read_member on public.organizations;
create policy organizations_read_member on public.organizations for select to authenticated
  using ((select private.is_org_member(id)) or (select private.has_any_staff_role(array['super_admin', 'sales_manager']::public.app_role[])));
drop policy if exists organizations_insert_self on public.organizations;
create policy organizations_insert_self on public.organizations for insert to authenticated
  with check (created_by = (select auth.uid()));
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for update to authenticated
  using ((select private.is_org_admin(id)) or (select private.has_any_staff_role(array['super_admin', 'sales_manager']::public.app_role[])))
  with check ((select private.org_creator_matches(id, created_by)) or
    (select private.has_any_staff_role(array['super_admin', 'sales_manager']::public.app_role[])));

drop policy if exists organization_memberships_read_member on public.organization_memberships;
create policy organization_memberships_read_member on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_org_admin(organization_id)) or
    (select private.has_any_staff_role(array['super_admin', 'sales_manager']::public.app_role[])));
drop policy if exists organization_memberships_insert_owner_or_admin on public.organization_memberships;
create policy organization_memberships_insert_owner_or_admin on public.organization_memberships for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and added_by = (select auth.uid()) and role = 'owner' and (select private.is_org_creator(organization_id)))
    or (added_by = (select auth.uid()) and role <> 'owner' and (select private.is_org_admin(organization_id)))
    or (select private.has_any_staff_role(array['super_admin', 'sales_manager']::public.app_role[]))
  );
drop policy if exists organization_memberships_delete_self_or_admin on public.organization_memberships;
create policy organization_memberships_delete_self_or_admin on public.organization_memberships for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (role <> 'owner' and (select private.is_org_admin(organization_id)))
    or (select private.has_any_staff_role(array['super_admin', 'sales_manager']::public.app_role[]))
  );

drop policy if exists categories_read_active on public.categories;
create policy categories_read_active on public.categories for select to anon, authenticated using (is_active);
drop policy if exists categories_read_staff on public.categories;
create policy categories_read_staff on public.categories for select to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));
drop policy if exists categories_manage_staff on public.categories;
create policy categories_manage_staff on public.categories for all to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));

drop policy if exists products_read_published on public.products;
create policy products_read_published on public.products for select to anon, authenticated using (is_published);
drop policy if exists products_read_staff on public.products;
create policy products_read_staff on public.products for select to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));
drop policy if exists products_manage_staff on public.products;
create policy products_manage_staff on public.products for all to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));

drop policy if exists product_categories_read_published on public.product_categories;
create policy product_categories_read_published on public.product_categories for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_published) and
    exists (select 1 from public.categories c where c.id = category_id and c.is_active));
drop policy if exists product_categories_read_staff on public.product_categories;
create policy product_categories_read_staff on public.product_categories for select to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));
drop policy if exists product_categories_manage_staff on public.product_categories;
create policy product_categories_manage_staff on public.product_categories for all to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));

drop policy if exists variants_read_published on public.product_variants;
create policy variants_read_published on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_published));
drop policy if exists variants_read_staff on public.product_variants;
create policy variants_read_staff on public.product_variants for select to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));
drop policy if exists variants_manage_staff on public.product_variants;
create policy variants_manage_staff on public.product_variants for all to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));

drop policy if exists specifications_read_published on public.product_specifications;
create policy specifications_read_published on public.product_specifications for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_published));
drop policy if exists specifications_read_staff on public.product_specifications;
create policy specifications_read_staff on public.product_specifications for select to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));
drop policy if exists specifications_manage_staff on public.product_specifications;
create policy specifications_manage_staff on public.product_specifications for all to authenticated
  using ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[])));

drop policy if exists warehouses_staff_only on public.warehouses;
create policy warehouses_staff_only on public.warehouses for all to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));
drop policy if exists inventory_staff_only on public.inventory;
create policy inventory_staff_only on public.inventory for all to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists carts_read_own on public.carts;
create policy carts_read_own on public.carts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists carts_insert_own on public.carts;
create policy carts_insert_own on public.carts for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active' and
    (organization_id is null or (select private.is_org_member(organization_id))));
drop policy if exists carts_delete_own on public.carts;
create policy carts_delete_own on public.carts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists cart_items_read_own on public.cart_items;
create policy cart_items_read_own on public.cart_items for select to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
drop policy if exists cart_items_insert_own on public.cart_items;
create policy cart_items_insert_own on public.cart_items for insert to authenticated
  with check (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()) and c.status = 'active')
    and exists (
      select 1 from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = variant_id and v.is_active and p.is_published
    )
  );
drop policy if exists cart_items_update_own on public.cart_items;
create policy cart_items_update_own on public.cart_items for update to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()) and c.status = 'active'))
  with check (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()) and c.status = 'active')
    and exists (
      select 1 from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = variant_id and v.is_active and p.is_published
    )
  );
drop policy if exists cart_items_delete_own on public.cart_items;
create policy cart_items_delete_own on public.cart_items for delete to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

drop policy if exists orders_read_owner_or_staff on public.orders;
create policy orders_read_owner_or_staff on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'sales_manager', 'super_admin']::public.app_role[])));
drop policy if exists orders_manage_staff on public.orders;
create policy orders_manage_staff on public.orders for all to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists order_events_read_owner_or_staff on public.order_events;
create policy order_events_read_owner_or_staff on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and
    (o.customer_id = (select auth.uid()) or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'sales_manager', 'super_admin']::public.app_role[])))));

drop policy if exists order_items_read_owner_or_staff on public.order_items;
create policy order_items_read_owner_or_staff on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and
      (o.customer_id = (select auth.uid()) or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'sales_manager', 'super_admin']::public.app_role[])))
  ));
drop policy if exists order_items_manage_staff on public.order_items;
create policy order_items_manage_staff on public.order_items for all to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists payments_staff_only on public.payment_transactions;
create policy payments_staff_only on public.payment_transactions for all to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'sales_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'sales_manager', 'super_admin']::public.app_role[])));

drop policy if exists inventory_reservations_staff_only on public.inventory_reservations;
create policy inventory_reservations_staff_only on public.inventory_reservations for select to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists quotes_read_owner_or_staff on public.quotes;
create policy quotes_read_owner_or_staff on public.quotes for select to authenticated
  using (requested_by = (select auth.uid()) or (organization_id is not null and (select private.is_org_member(organization_id))) or
    (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));
drop policy if exists quotes_insert_customer on public.quotes;
create policy quotes_insert_customer on public.quotes for insert to authenticated
  with check (requested_by = (select auth.uid()) and status = 'requested' and valid_until is null and
    (organization_id is null or (select private.is_org_member(organization_id))));
drop policy if exists quotes_manage_staff on public.quotes;
create policy quotes_manage_staff on public.quotes for update to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));

drop policy if exists quote_items_read_owner_or_staff on public.quote_items;
create policy quote_items_read_owner_or_staff on public.quote_items for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and
    (q.requested_by = (select auth.uid()) or (q.organization_id is not null and (select private.is_org_member(q.organization_id))) or
     (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))));
drop policy if exists quote_items_insert_customer on public.quote_items;
create policy quote_items_insert_customer on public.quote_items for insert to authenticated
  with check (requested_unit_price is null and offered_unit_price is null and exists (
    select 1 from public.quotes q where q.id = quote_id and q.requested_by = (select auth.uid()) and q.status = 'requested'
  ) and exists (
    select 1 from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = variant_id and v.is_active and p.is_published
  ));
drop policy if exists quote_items_update_staff on public.quote_items;
create policy quote_items_update_staff on public.quote_items for update to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));
drop policy if exists quote_items_delete_staff on public.quote_items;
create policy quote_items_delete_staff on public.quote_items for delete to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));

drop policy if exists crm_leads_public_submit on public.crm_leads;
create policy crm_leads_public_submit on public.crm_leads for insert to anon
  with check (submitted_by is null and consent_to_contact = true);
drop policy if exists crm_leads_customer_submit on public.crm_leads;
create policy crm_leads_customer_submit on public.crm_leads for insert to authenticated
  with check ((submitted_by is null or submitted_by = (select auth.uid())) and consent_to_contact = true);
drop policy if exists crm_leads_staff_read on public.crm_leads;
create policy crm_leads_staff_read on public.crm_leads for select to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));
drop policy if exists crm_leads_staff_update on public.crm_leads;
create policy crm_leads_staff_update on public.crm_leads for update to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));

drop policy if exists quote_inquiries_public_submit on public.quote_inquiries;
create policy quote_inquiries_public_submit on public.quote_inquiries for insert to anon, authenticated
  with check (consent_to_contact and status = 'new');
drop policy if exists quote_inquiries_staff_read on public.quote_inquiries;
create policy quote_inquiries_staff_read on public.quote_inquiries for select to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));
drop policy if exists quote_inquiries_staff_update on public.quote_inquiries;
create policy quote_inquiries_staff_update on public.quote_inquiries for update to authenticated
  using ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])));

drop policy if exists support_tickets_read_customer_or_staff on public.support_tickets;
create policy support_tickets_read_customer_or_staff on public.support_tickets for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])));
drop policy if exists support_tickets_insert_customer on public.support_tickets;
create policy support_tickets_insert_customer on public.support_tickets for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'open' and priority = 'normal' and assigned_to is null and
    (organization_id is null or (select private.is_org_member(organization_id))) and
    (order_id is null or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))));
drop policy if exists support_tickets_manage_staff on public.support_tickets;
create policy support_tickets_manage_staff on public.support_tickets for update to authenticated
  using ((select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])));

drop policy if exists support_messages_read_customer_or_staff on public.support_messages;
create policy support_messages_read_customer_or_staff on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and
    ((t.customer_id = (select auth.uid()) and not is_internal) or
     (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])))));
drop policy if exists support_messages_insert_customer on public.support_messages;
create policy support_messages_insert_customer on public.support_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and not is_internal and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.customer_id = (select auth.uid()) and t.status not in ('resolved', 'closed')
  ));
drop policy if exists support_messages_insert_staff on public.support_messages;
create policy support_messages_insert_staff on public.support_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.has_any_staff_role(array['support_agent', 'super_admin']::public.app_role[])) and exists (
    select 1 from public.support_tickets t where t.id = ticket_id
  ));

drop policy if exists return_requests_read_owner_or_staff on public.return_requests;
create policy return_requests_read_owner_or_staff on public.return_requests for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])));
drop policy if exists return_requests_insert_owner on public.return_requests;
create policy return_requests_insert_owner on public.return_requests for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'requested' and exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid()) and o.status = 'delivered'
      and o.placed_at >= pg_catalog.now() - interval '30 days'
  ));
drop policy if exists return_requests_update_staff on public.return_requests;
create policy return_requests_update_staff on public.return_requests for update to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists return_items_read_owner_or_staff on public.return_items;
create policy return_items_read_owner_or_staff on public.return_items for select to authenticated
  using (exists (select 1 from public.return_requests r where r.id = return_request_id and
    (r.customer_id = (select auth.uid()) or (select private.has_any_staff_role(array['fulfillment_manager', 'support_agent', 'super_admin']::public.app_role[])))));
drop policy if exists return_items_insert_owner on public.return_items;
create policy return_items_insert_owner on public.return_items for insert to authenticated
  with check (exists (
    select 1 from public.return_requests r
    join public.order_items oi on oi.id = order_item_id and oi.order_id = r.order_id
    where r.id = return_request_id and r.customer_id = (select auth.uid()) and r.status = 'requested'
      and quantity <= oi.quantity
  ));
drop policy if exists return_items_manage_staff on public.return_items;
create policy return_items_manage_staff on public.return_items for all to authenticated
  using ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])))
  with check ((select private.has_any_staff_role(array['fulfillment_manager', 'super_admin']::public.app_role[])));

drop policy if exists audit_events_staff_read on public.audit_events;
create policy audit_events_staff_read on public.audit_events for select to authenticated
  using ((select private.has_any_staff_role(array['super_admin']::public.app_role[])));

-- Least-privilege Data API grants. Writes to orders, payments, stock, and role grants are server-side.
grant usage on schema public to anon, authenticated, service_role;

revoke all on public.profiles, public.user_role_grants, public.organizations, public.organization_memberships,
  public.categories, public.products, public.product_categories, public.product_variants, public.product_specifications,
  public.warehouses, public.inventory, public.carts, public.cart_items, public.orders, public.order_items, public.order_events,
  public.payment_transactions, public.inventory_reservations, public.quotes, public.quote_items, public.crm_leads, public.quote_inquiries,
  public.support_tickets, public.support_messages, public.return_requests, public.return_items, public.audit_events
  from anon, authenticated;

grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, phone, locale) on public.profiles to authenticated;
grant select on public.user_role_grants to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, delete on public.organization_memberships to authenticated;
grant select on public.categories, public.products, public.product_categories, public.product_variants, public.product_specifications to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_categories, public.product_variants, public.product_specifications to authenticated;
grant select, insert, update, delete on public.warehouses, public.inventory to authenticated;
grant select, insert, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select on public.order_events to authenticated;
grant select, insert, update, delete on public.payment_transactions to authenticated;
grant select on public.inventory_reservations to authenticated;
grant select, insert, update, delete on public.quotes, public.quote_items to authenticated;
grant insert on public.crm_leads to anon, authenticated;
grant select, insert, update on public.crm_leads to authenticated;
grant insert (contact_name, email, phone, company, message, consent_to_contact) on public.quote_inquiries to anon, authenticated;
grant select, update on public.quote_inquiries to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant select, insert, update on public.return_requests to authenticated;
grant select, insert, update, delete on public.return_items to authenticated;
grant select on public.audit_events to authenticated;

grant all privileges on public.profiles, public.user_role_grants, public.organizations, public.organization_memberships,
  public.categories, public.products, public.product_categories, public.product_variants, public.product_specifications,
  public.warehouses, public.inventory, public.carts, public.cart_items, public.orders, public.order_items, public.order_events,
  public.payment_transactions, public.inventory_reservations, public.quotes, public.quote_items, public.crm_leads, public.quote_inquiries, public.support_tickets,
  public.support_messages, public.return_requests, public.return_items, public.audit_events to service_role;
