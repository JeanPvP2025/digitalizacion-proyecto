-- CRM/B2B workflow contract. Tenant membership and quote operations are exposed
-- through checked RPCs; sales staff only see the unassigned queue and quotes
-- explicitly assigned to their own user.

create sequence if not exists private.quote_number_seq;
select pg_catalog.setval(
  'private.quote_number_seq'::pg_catalog.regclass,
  coalesce(max(pg_catalog.split_part(q.quote_number, '-', 3)::bigint), 1),
  coalesce(max(pg_catalog.split_part(q.quote_number, '-', 3)::bigint), 0) > 0
)
from public.quotes q
where q.quote_number ~ '^NOD-[0-9]{4}-[0-9]+$';

alter table public.quotes
  add column if not exists requester_name text not null default 'Contacto de empresa',
  add column if not exists requester_email text not null default '',
  add column if not exists organization_name_snapshot text not null default 'Organización',
  add column if not exists sales_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  add column if not exists tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  add column if not exists grand_total numeric(12,2) not null default 0 check (grand_total >= 0),
  add column if not exists sent_at timestamptz;

update public.quotes q
set requester_name = coalesce(
      (select nullif(p.display_name, '') from public.profiles p where p.id = u.id),
      nullif(u.email, ''), 'Contacto de empresa'
    ),
    requester_email = coalesce(u.email, ''),
    organization_name_snapshot = coalesce(
      (select o.display_name from public.organizations o where o.id = q.organization_id),
      'Organización'
    )
from auth.users u
where q.requested_by = u.id;

alter table public.quotes
  drop constraint if exists quotes_total_matches_parts_check;
alter table public.quotes
  add constraint quotes_total_matches_parts_check
  check (grand_total = subtotal + tax_total);

alter table public.quote_items
  alter column variant_id drop not null,
  add column if not exists product_id text references public.products(id) on delete set null,
  add column if not exists product_name text,
  add column if not exists product_sku text,
  add column if not exists variant_title text,
  add column if not exists variant_attributes jsonb not null default '{}'::jsonb,
  add column if not exists tax_rate numeric(5,4),
  add column if not exists currency text;

alter table public.quote_items
  drop constraint if exists quote_items_variant_id_fkey;
alter table public.quote_items
  add constraint quote_items_variant_id_fkey
  foreign key (variant_id) references public.product_variants(id) on delete set null;

update public.quote_items qi
set product_id = v.product_id,
    product_name = p.name,
    product_sku = v.sku,
    variant_title = v.title,
    variant_attributes = v.attributes,
    requested_unit_price = coalesce(qi.requested_unit_price, v.current_price),
    tax_rate = v.tax_rate,
    currency = v.currency
from public.product_variants v
join public.products p on p.id = v.product_id
where qi.variant_id = v.id;

alter table public.quote_items
  alter column product_name set not null,
  alter column product_sku set not null,
  alter column variant_title set not null,
  alter column tax_rate set default 0.21,
  alter column tax_rate set not null,
  alter column currency set default 'EUR',
  alter column currency set not null,
  alter column requested_unit_price set not null,
  add constraint quote_items_variant_attributes_object_check
    check (jsonb_typeof(variant_attributes) = 'object');

alter table public.quote_items
  add column if not exists line_subtotal numeric(12,2)
    generated always as (round(coalesce(offered_unit_price, requested_unit_price) * quantity / (1 + tax_rate), 2)) stored,
  add column if not exists line_tax numeric(12,2)
    generated always as (round(coalesce(offered_unit_price, requested_unit_price) * quantity, 2) - round(coalesce(offered_unit_price, requested_unit_price) * quantity / (1 + tax_rate), 2)) stored,
  add column if not exists line_total numeric(12,2)
    generated always as (round(coalesce(offered_unit_price, requested_unit_price) * quantity, 2)) stored;

update public.quotes q
set subtotal = totals.subtotal,
    tax_total = totals.tax_total,
    grand_total = totals.grand_total
from (
  select quote_id, sum(line_subtotal)::numeric(12,2) as subtotal,
    sum(line_tax)::numeric(12,2) as tax_total,
    sum(line_total)::numeric(12,2) as grand_total
  from public.quote_items
  group by quote_id
) totals
where totals.quote_id = q.id;

create index if not exists quotes_sales_queue_idx
  on public.quotes (sales_owner_id, status, created_at desc);

create table if not exists public.crm_activities (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete cascade,
  crm_lead_id uuid references public.crm_leads(id) on delete cascade,
  quote_inquiry_id uuid references public.quote_inquiries(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_key text not null check (char_length(event_key) between 2 and 80),
  title text not null check (char_length(title) between 2 and 160),
  subject_name text not null default '' check (char_length(subject_name) <= 160),
  company_snapshot text not null default '' check (char_length(company_snapshot) <= 180),
  body text not null default '' check (char_length(body) <= 2000),
  visibility text not null default 'internal' check (visibility in ('internal', 'organization')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  constraint crm_activities_target_check
    check (organization_id is not null or quote_id is not null or crm_lead_id is not null or quote_inquiry_id is not null)
);

create index if not exists crm_activities_org_date_idx
  on public.crm_activities (organization_id, created_at desc);
create index if not exists crm_activities_quote_date_idx
  on public.crm_activities (quote_id, created_at desc);
create index if not exists crm_activities_lead_date_idx
  on public.crm_activities (crm_lead_id, created_at desc);
create index if not exists crm_activities_inquiry_date_idx
  on public.crm_activities (quote_inquiry_id, created_at desc);

insert into public.crm_activities (
  quote_id, organization_id, actor_user_id, event_key, title, subject_name,
  company_snapshot, body, visibility, details, created_at
)
select q.id, q.organization_id, q.requested_by, 'quote_requested', 'Solicitud de presupuesto creada',
  q.requester_name, q.organization_name_snapshot, q.request_note, 'organization',
  pg_catalog.jsonb_build_object('status', q.status, 'currency', q.currency, 'grand_total', q.grand_total), q.created_at
from public.quotes q
where not exists (select 1 from public.crm_activities a where a.quote_id = q.id and a.event_key = 'quote_requested');

insert into public.crm_activities (
  quote_inquiry_id, actor_user_id, event_key, title, subject_name,
  company_snapshot, body, visibility, details, created_at
)
select qi.id, qi.created_by, 'inquiry_received', 'Nueva solicitud de presupuesto',
  qi.contact_name, coalesce(qi.company, ''), qi.message, 'internal',
  pg_catalog.jsonb_build_object('source', qi.source, 'status', qi.status), qi.created_at
from public.quote_inquiries qi
where not exists (select 1 from public.crm_activities a where a.quote_inquiry_id = qi.id and a.event_key = 'inquiry_received');

insert into public.crm_activities (
  crm_lead_id, actor_user_id, event_key, title, subject_name,
  company_snapshot, body, visibility, details, created_at
)
select l.id, l.submitted_by, 'lead_received', 'Nuevo contacto',
  l.contact_name, coalesce(l.company, ''), l.message, 'internal',
  pg_catalog.jsonb_build_object('source', l.source), l.created_at
from public.crm_leads l
where not exists (select 1 from public.crm_activities a where a.crm_lead_id = l.id and a.event_key = 'lead_received');

insert into public.crm_activities (
  organization_id, actor_user_id, event_key, title, subject_name,
  company_snapshot, visibility, details, created_at
)
select o.id, o.created_by, 'organization_created', 'Organización creada',
  o.display_name, o.display_name, 'organization',
  pg_catalog.jsonb_build_object('slug', o.slug), o.created_at
from public.organizations o
where not exists (select 1 from public.crm_activities a where a.organization_id = o.id and a.event_key = 'organization_created');

insert into public.crm_activities (
  organization_id, actor_user_id, event_key, title, subject_name,
  visibility, details, created_at
)
select m.organization_id, m.added_by, 'organization_member_added', 'Miembro añadido',
  coalesce(p.display_name, ''), 'organization',
  pg_catalog.jsonb_build_object('member_user_id', m.user_id, 'role', m.role), m.joined_at
from public.organization_memberships m
left join public.profiles p on p.id = m.user_id
where not exists (
  select 1 from public.crm_activities a
  where a.organization_id = m.organization_id and a.event_key = 'organization_member_added'
    and a.details ->> 'member_user_id' = m.user_id::text
);

alter table public.crm_activities enable row level security;

create or replace function private.assign_quote_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quote_number is null then
    new.quote_number := 'NOD-' || pg_catalog.to_char(pg_catalog.now(), 'YYYY') || '-' ||
      pg_catalog.lpad(pg_catalog.nextval('private.quote_number_seq'::pg_catalog.regclass)::text, 6, '0');
  end if;
  return new;
end;
$$;
revoke all on function private.assign_quote_number() from public, anon, authenticated;

drop trigger if exists quotes_assign_number on public.quotes;
create trigger quotes_assign_number before insert on public.quotes
  for each row execute function private.assign_quote_number();

create or replace function private.guard_business_quote_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.quote_number is distinct from old.quote_number
     or new.requested_by is distinct from old.requested_by
     or new.organization_id is distinct from old.organization_id
     or new.currency is distinct from old.currency
     or new.request_note is distinct from old.request_note
     or new.requester_name is distinct from old.requester_name
     or new.requester_email is distinct from old.requester_email
     or new.organization_name_snapshot is distinct from old.organization_name_snapshot
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', message = 'Business quote request snapshots are immutable';
  end if;

  if new.sales_owner_id is distinct from old.sales_owner_id
     and (old.sales_owner_id is not null or new.sales_owner_id is distinct from (select auth.uid())) then
    raise exception using errcode = '23514', message = 'A quote can only be claimed once by the acting salesperson';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'requested' and new.status = 'in_review')
    or (old.status = 'in_review' and new.status = 'sent')
    or (old.status = 'sent' and new.status in ('accepted', 'rejected', 'expired'))
  ) then
    raise exception using errcode = '23514', message = 'Invalid business quote status transition';
  end if;

  if new.status = 'sent' and (new.valid_until is null or new.sent_at is null or new.grand_total <= 0) then
    raise exception using errcode = '23514', message = 'A sent quote needs a validity date and a priced offer';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_business_quote_update() from public, anon, authenticated;

drop trigger if exists quotes_guard_business_update on public.quotes;
create trigger quotes_guard_business_update before update on public.quotes
  for each row execute function private.guard_business_quote_update();

create or replace function private.guard_business_quote_item_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.quote_id is distinct from old.quote_id
     or new.variant_id is distinct from old.variant_id
     or new.product_id is distinct from old.product_id
     or new.product_name is distinct from old.product_name
     or new.product_sku is distinct from old.product_sku
     or new.variant_title is distinct from old.variant_title
     or new.variant_attributes is distinct from old.variant_attributes
     or new.quantity is distinct from old.quantity
     or new.requested_unit_price is distinct from old.requested_unit_price
     or new.tax_rate is distinct from old.tax_rate
     or new.currency is distinct from old.currency
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', message = 'Business quote line snapshots are immutable';
  end if;

  if new.offered_unit_price is distinct from old.offered_unit_price and not exists (
    select 1 from public.quotes q
    where q.id = old.quote_id and q.status = 'in_review'
      and (q.sales_owner_id = (select auth.uid())
        or (select private.has_any_staff_role(array['super_admin']::public.app_role[])))
  ) then
    raise exception using errcode = '42501', message = 'Only the assigned salesperson can price an in-review quote';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_business_quote_item_update() from public, anon, authenticated;

drop trigger if exists quote_items_guard_business_update on public.quote_items;
create trigger quote_items_guard_business_update before update on public.quote_items
  for each row execute function private.guard_business_quote_item_update();

create or replace function private.log_crm_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_member_id uuid;
  v_subject text;
  v_org_id uuid;
begin
  if tg_table_name = 'organizations' and tg_op = 'INSERT' then
    insert into public.crm_activities (
      organization_id, actor_user_id, event_key, title, subject_name,
      company_snapshot, visibility, details
    ) values (
      new.id, coalesce(v_actor, new.created_by), 'organization_created', 'Organización creada',
      new.display_name, new.display_name, 'organization',
      pg_catalog.jsonb_build_object('slug', new.slug)
    );
    return new;
  end if;

  if tg_table_name = 'quotes' then
    if tg_op = 'INSERT' then
      insert into public.crm_activities (
        organization_id, quote_id, actor_user_id, event_key, title,
        subject_name, company_snapshot, body, visibility, details
      ) values (
        new.organization_id, new.id, v_actor, 'quote_requested', 'Solicitud de presupuesto creada',
        new.requester_name, new.organization_name_snapshot, new.request_note, 'organization',
        pg_catalog.jsonb_build_object('status', new.status, 'currency', new.currency, 'grand_total', new.grand_total)
      );
    elsif new.status is distinct from old.status then
      insert into public.crm_activities (
        organization_id, quote_id, actor_user_id, event_key, title,
        subject_name, company_snapshot, body, visibility, details
      ) values (
        new.organization_id, new.id, v_actor, 'quote_' || new.status::text,
        case new.status
          when 'in_review' then 'Cotización asignada a ventas'
          when 'sent' then 'Propuesta enviada a la empresa'
          when 'accepted' then 'Propuesta aceptada'
          when 'rejected' then 'Propuesta rechazada'
          when 'expired' then 'Propuesta caducada'
          else 'Estado de cotización actualizado'
        end,
        new.requester_name, new.organization_name_snapshot,
        case when new.status = 'sent' then 'Importe propuesto: ' || new.currency || ' ' || pg_catalog.to_char(new.grand_total, 'FM999999999990.00') else '' end,
        case when new.status in ('sent', 'accepted', 'rejected', 'expired') then 'organization' else 'internal' end,
        pg_catalog.jsonb_build_object('from_status', old.status, 'to_status', new.status, 'currency', new.currency, 'grand_total', new.grand_total)
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'quote_inquiries' then
    if tg_op = 'INSERT' then
      insert into public.crm_activities (
        quote_inquiry_id, actor_user_id, event_key, title,
        subject_name, company_snapshot, body, visibility, details
      ) values (
        new.id, v_actor, 'inquiry_received', 'Nueva solicitud de presupuesto',
        new.contact_name, coalesce(new.company, ''), new.message, 'internal',
        pg_catalog.jsonb_build_object('source', new.source, 'status', new.status)
      );
    elsif new.status is distinct from old.status then
      insert into public.crm_activities (
        quote_inquiry_id, actor_user_id, event_key, title,
        subject_name, company_snapshot, body, visibility, details
      ) values (
        new.id, v_actor, 'inquiry_status_changed', 'Etapa de solicitud actualizada',
        new.contact_name, coalesce(new.company, ''), '', 'internal',
        pg_catalog.jsonb_build_object('from_status', old.status, 'to_status', new.status)
      );
    end if;
    return new;
  end if;

  if tg_table_name = 'crm_leads' and tg_op = 'INSERT' then
    insert into public.crm_activities (
      crm_lead_id, actor_user_id, event_key, title,
      subject_name, company_snapshot, body, visibility, details
    ) values (
      new.id, v_actor, 'lead_received', 'Nuevo contacto',
      new.contact_name, coalesce(new.company, ''), new.message, 'internal',
      pg_catalog.jsonb_build_object('source', new.source)
    );
    return new;
  end if;

  if tg_table_name = 'organization_memberships' then
    if tg_op = 'DELETE' then
      v_member_id := old.user_id;
      v_org_id := old.organization_id;
      v_subject := '';
    else
      v_member_id := new.user_id;
      v_org_id := new.organization_id;
      v_subject := '';
    end if;
    select coalesce(p.display_name, '') into v_subject from public.profiles p where p.id = v_member_id;
    insert into public.crm_activities (
      organization_id, actor_user_id, event_key, title, subject_name, visibility, details
    ) values (
      v_org_id, v_actor,
      case when tg_op = 'INSERT' then 'organization_member_added' when tg_op = 'DELETE' then 'organization_member_removed' else 'organization_member_role_changed' end,
      case when tg_op = 'INSERT' then 'Miembro añadido' when tg_op = 'DELETE' then 'Miembro retirado' else 'Rol de miembro actualizado' end,
      coalesce(v_subject, ''), 'organization',
      pg_catalog.jsonb_build_object('member_user_id', v_member_id,
        'role', case when tg_op = 'DELETE' then old.role else new.role end)
    );
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  return null;
end;
$$;
revoke all on function private.log_crm_activity() from public, anon, authenticated;

drop trigger if exists quote_inquiries_crm_activity_insert on public.quote_inquiries;
create trigger quote_inquiries_crm_activity_insert after insert on public.quote_inquiries
  for each row execute function private.log_crm_activity();
drop trigger if exists quote_inquiries_crm_activity_status on public.quote_inquiries;
create trigger quote_inquiries_crm_activity_status after update of status on public.quote_inquiries
  for each row execute function private.log_crm_activity();
drop trigger if exists crm_leads_crm_activity_insert on public.crm_leads;
create trigger crm_leads_crm_activity_insert after insert on public.crm_leads
  for each row execute function private.log_crm_activity();
drop trigger if exists organizations_crm_activity_insert on public.organizations;
create trigger organizations_crm_activity_insert after insert on public.organizations
  for each row execute function private.log_crm_activity();
drop trigger if exists quotes_crm_activity_insert on public.quotes;
drop trigger if exists quotes_crm_activity_status on public.quotes;
create trigger quotes_crm_activity_status after update of status on public.quotes
  for each row execute function private.log_crm_activity();
drop trigger if exists organization_memberships_crm_activity on public.organization_memberships;
create trigger organization_memberships_crm_activity after insert or update or delete on public.organization_memberships
  for each row execute function private.log_crm_activity();

create or replace function private.add_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.organization_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.organization_role;
  v_member_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'Authentication is required';
  end if;
  select m.role into v_actor_role from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = v_actor;
  if not found and not (select private.has_any_staff_role(array['super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'Organization membership administration is not allowed';
  end if;
  if p_role not in ('admin', 'buyer', 'viewer') then
    raise exception using errcode = '22023', message = 'A member cannot be assigned the owner role';
  end if;
  if coalesce(v_actor_role::text, '') = 'admin' and p_role not in ('buyer', 'viewer') then
    raise exception using errcode = '42501', message = 'An organization admin can add buyers or viewers only';
  end if;
  if v_actor_role not in ('owner', 'admin')
     and not (select private.has_any_staff_role(array['super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'Only an owner or admin can add organization members';
  end if;
  if p_email is null or pg_catalog.length(pg_catalog.btrim(p_email)) not between 3 and 254 then
    raise exception using errcode = '22023', message = 'A valid account email is required';
  end if;
  select u.id into v_member_id from auth.users u
    where pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
    order by u.created_at limit 1;
  if v_member_id is null then
    raise exception using errcode = 'P0002', message = 'No registered account matches this email';
  end if;
  if v_member_id = v_actor then
    raise exception using errcode = '23505', message = 'The acting user is already represented in this organization';
  end if;
  insert into public.organization_memberships (organization_id, user_id, role, added_by)
    values (p_organization_id, v_member_id, p_role, v_actor);
  return v_member_id;
end;
$$;
revoke all on function private.add_organization_member(uuid, text, public.organization_role) from public, anon, authenticated;
grant execute on function private.add_organization_member(uuid, text, public.organization_role) to authenticated;

create or replace function public.add_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.organization_role
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.add_organization_member(p_organization_id, p_email, p_role); $$;
revoke all on function public.add_organization_member(uuid, text, public.organization_role) from public, anon;
grant execute on function public.add_organization_member(uuid, text, public.organization_role) to authenticated;

create or replace function private.list_organization_members(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.organization_role,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (
    (select private.is_org_member(p_organization_id))
    or (select private.has_any_staff_role(array['super_admin']::public.app_role[]))
  ) then
    raise exception using errcode = '42501', message = 'Organization membership is required';
  end if;
  return query
    select m.user_id, coalesce(u.email, '')::text, coalesce(p.display_name, ''), m.role, m.joined_at
    from public.organization_memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.organization_id = p_organization_id
    order by case m.role when 'owner' then 1 when 'admin' then 2 when 'buyer' then 3 else 4 end, m.joined_at;
end;
$$;
revoke all on function private.list_organization_members(uuid) from public, anon, authenticated;
grant execute on function private.list_organization_members(uuid) to authenticated;

create or replace function public.list_organization_members(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.organization_role,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_organization_members(p_organization_id); $$;
revoke all on function public.list_organization_members(uuid) from public, anon;
grant execute on function public.list_organization_members(uuid) to authenticated;

create or replace function private.set_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.organization_role;
  v_target_role public.organization_role;
begin
  select m.role into v_actor_role from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = v_actor;
  select m.role into v_target_role from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Organization member not found';
  end if;
  if v_actor is null or (v_actor_role not in ('owner', 'admin')
     and not (select private.has_any_staff_role(array['super_admin']::public.app_role[]))) then
    raise exception using errcode = '42501', message = 'Only an owner or admin can change member roles';
  end if;
  if v_target_role = 'owner' or p_role = 'owner' then
    raise exception using errcode = '42501', message = 'The owner role is immutable through member management';
  end if;
  if v_actor_role = 'admin' and (v_target_role not in ('buyer', 'viewer') or p_role not in ('buyer', 'viewer')) then
    raise exception using errcode = '42501', message = 'An organization admin can only manage buyers or viewers';
  end if;
  if p_role not in ('admin', 'buyer', 'viewer') then
    raise exception using errcode = '22023', message = 'Unsupported organization role';
  end if;
  update public.organization_memberships set role = p_role
    where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;
revoke all on function private.set_organization_member_role(uuid, uuid, public.organization_role) from public, anon, authenticated;
grant execute on function private.set_organization_member_role(uuid, uuid, public.organization_role) to authenticated;

create or replace function public.set_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role
)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.set_organization_member_role(p_organization_id, p_user_id, p_role); $$;
revoke all on function public.set_organization_member_role(uuid, uuid, public.organization_role) from public, anon;
grant execute on function public.set_organization_member_role(uuid, uuid, public.organization_role) to authenticated;

create or replace function private.remove_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.organization_role;
  v_target_role public.organization_role;
begin
  select m.role into v_actor_role from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = v_actor;
  select m.role into v_target_role from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Organization member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception using errcode = '42501', message = 'The organization owner cannot be removed';
  end if;
  if v_actor is null or (v_actor <> p_user_id and v_actor_role not in ('owner', 'admin')
     and not (select private.has_any_staff_role(array['super_admin']::public.app_role[]))) then
    raise exception using errcode = '42501', message = 'Organization member removal is not allowed';
  end if;
  if v_actor_role = 'admin' and v_target_role not in ('buyer', 'viewer') then
    raise exception using errcode = '42501', message = 'An organization admin can remove buyers or viewers only';
  end if;
  delete from public.organization_memberships where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;
revoke all on function private.remove_organization_member(uuid, uuid) from public, anon, authenticated;
grant execute on function private.remove_organization_member(uuid, uuid) to authenticated;

create or replace function public.remove_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.remove_organization_member(p_organization_id, p_user_id); $$;
revoke all on function public.remove_organization_member(uuid, uuid) from public, anon;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;

create or replace function private.create_business_quote(
  p_organization_id uuid,
  p_request_note text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_membership_role public.organization_role;
  v_currency text;
  v_quote_id uuid;
  v_line record;
  v_variant record;
  v_variant_id uuid;
  v_quantity integer;
  v_display_name text;
  v_email text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required';
  end if;
  select m.role into v_membership_role from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = v_user_id;
  if v_membership_role is null or v_membership_role not in ('owner', 'admin', 'buyer') then
    raise exception using errcode = '42501', message = 'Only organization buyers and admins can request a quote';
  end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines) <> 'array'
     or pg_catalog.jsonb_array_length(p_lines) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'A quote must have between 1 and 30 product lines';
  end if;
  if p_request_note is null or pg_catalog.char_length(pg_catalog.btrim(p_request_note)) > 2000 then
    raise exception using errcode = '22023', message = 'The quote note must be 2000 characters or fewer';
  end if;

  for v_line in select e.value from pg_catalog.jsonb_array_elements(p_lines) as e(value) loop
    if pg_catalog.jsonb_typeof(v_line.value) <> 'object'
       or v_line.value - array['variant_id', 'quantity'] <> '{}'::jsonb
       or coalesce(v_line.value ->> 'variant_id', '') !~* '^[0-9a-f-]{36}$'
       or coalesce(v_line.value ->> 'quantity', '') !~ '^[1-9][0-9]{0,4}$' then
      raise exception using errcode = '22023', message = 'Each quote line needs only a valid variant id and positive quantity';
    end if;
    v_variant_id := (v_line.value ->> 'variant_id')::uuid;
    v_quantity := (v_line.value ->> 'quantity')::integer;
    if v_quantity > 10000 then
      raise exception using errcode = '22023', message = 'Quote line quantity exceeds 10000';
    end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(p_lines) x(value)
      where x.value ->> 'variant_id' = v_variant_id::text
      group by x.value ->> 'variant_id' having count(*) > 1) then
      raise exception using errcode = '22023', message = 'A variant can only appear once in a quote';
    end if;
    select v.id, v.product_id, v.sku, v.title, v.attributes, v.current_price,
      v.currency, v.tax_rate, p.name
      into v_variant
      from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = v_variant_id and v.is_active and p.is_published;
    if not found then
      raise exception using errcode = 'P0002', message = 'A requested product is not available';
    end if;
    if v_currency is null then v_currency := v_variant.currency;
    elsif v_currency <> v_variant.currency then
      raise exception using errcode = '23514', message = 'A quote cannot mix product currencies';
    end if;
  end loop;

  select coalesce(nullif(p.display_name, ''), u.email, 'Contacto de empresa'), u.email
    into v_display_name, v_email
    from auth.users u left join public.profiles p on p.id = u.id where u.id = v_user_id;
  insert into public.quotes (
    requested_by, organization_id, status, currency, request_note,
    requester_name, requester_email, organization_name_snapshot
  )
  select v_user_id, o.id, 'requested', v_currency, pg_catalog.btrim(p_request_note),
    v_display_name, coalesce(v_email, ''), o.display_name
  from public.organizations o where o.id = p_organization_id
  returning id into v_quote_id;
  if v_quote_id is null then
    raise exception using errcode = 'P0002', message = 'Organization not found';
  end if;

  for v_line in select e.value from pg_catalog.jsonb_array_elements(p_lines) as e(value) loop
    v_variant_id := (v_line.value ->> 'variant_id')::uuid;
    v_quantity := (v_line.value ->> 'quantity')::integer;
    select v.id, v.product_id, v.sku, v.title, v.attributes, v.current_price,
      v.currency, v.tax_rate, p.name
      into v_variant
      from public.product_variants v join public.products p on p.id = v.product_id
      where v.id = v_variant_id and v.is_active and p.is_published
      for share of v, p;
    if not found then
      raise exception using errcode = 'P0002', message = 'A requested product is no longer available';
    end if;
    insert into public.quote_items (
      quote_id, variant_id, product_id, product_name, product_sku,
      variant_title, variant_attributes, quantity, requested_unit_price,
      offered_unit_price, tax_rate, currency
    ) values (
      v_quote_id, v_variant.id, v_variant.product_id, v_variant.name,
      v_variant.sku, v_variant.title, v_variant.attributes, v_quantity,
      v_variant.current_price, null, v_variant.tax_rate, v_variant.currency
    );
  end loop;

  update public.quotes q set
    subtotal = totals.subtotal,
    tax_total = totals.tax_total,
    grand_total = totals.grand_total
  from (
    select sum(qi.line_subtotal)::numeric(12,2) as subtotal,
      sum(qi.line_tax)::numeric(12,2) as tax_total,
      sum(qi.line_total)::numeric(12,2) as grand_total
    from public.quote_items qi where qi.quote_id = v_quote_id
  ) totals
  where q.id = v_quote_id;
  insert into public.crm_activities (
    organization_id, quote_id, actor_user_id, event_key, title,
    subject_name, company_snapshot, body, visibility, details
  )
  select q.organization_id, q.id, v_user_id, 'quote_requested', 'Solicitud de presupuesto creada',
    q.requester_name, q.organization_name_snapshot, q.request_note, 'organization',
    pg_catalog.jsonb_build_object('status', q.status, 'currency', q.currency, 'grand_total', q.grand_total)
  from public.quotes q where q.id = v_quote_id;
  return v_quote_id;
end;
$$;
revoke all on function private.create_business_quote(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.create_business_quote(uuid, text, jsonb) to authenticated;

create or replace function public.create_business_quote(
  p_organization_id uuid,
  p_request_note text,
  p_lines jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.create_business_quote(p_organization_id, p_request_note, p_lines); $$;
revoke all on function public.create_business_quote(uuid, text, jsonb) from public, anon;
grant execute on function public.create_business_quote(uuid, text, jsonb) to authenticated;

create or replace function private.claim_business_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
begin
  if v_user_id is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'Sales authorization is required';
  end if;
  select q.* into v_quote from public.quotes q where q.id = p_quote_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Quote not found'; end if;
  if v_quote.status <> 'requested' or v_quote.sales_owner_id is not null then
    raise exception using errcode = '23514', message = 'Quote is no longer available to claim';
  end if;
  update public.quotes set sales_owner_id = v_user_id, status = 'in_review' where id = p_quote_id;
  return p_quote_id;
end;
$$;
revoke all on function private.claim_business_quote(uuid) from public, anon, authenticated;
grant execute on function private.claim_business_quote(uuid) to authenticated;

create or replace function public.claim_business_quote(p_quote_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.claim_business_quote(p_quote_id); $$;
revoke all on function public.claim_business_quote(uuid) from public, anon;
grant execute on function public.claim_business_quote(uuid) to authenticated;

create or replace function private.send_business_quote(
  p_quote_id uuid,
  p_offers jsonb,
  p_valid_until timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
  v_offer record;
  v_item_id uuid;
  v_price numeric(12,2);
begin
  if v_user_id is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'Sales authorization is required';
  end if;
  select q.* into v_quote from public.quotes q where q.id = p_quote_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Quote not found'; end if;
  if v_quote.status <> 'in_review' or (v_quote.sales_owner_id <> v_user_id
     and not (select private.has_any_staff_role(array['super_admin']::public.app_role[]))) then
    raise exception using errcode = '42501', message = 'This quote is not assigned to the acting salesperson';
  end if;
  if p_valid_until is null or p_valid_until <= pg_catalog.now()
     or p_valid_until > pg_catalog.now() + interval '1 year' then
    raise exception using errcode = '22023', message = 'Quote validity must be within the next year';
  end if;
  if p_offers is null or pg_catalog.jsonb_typeof(p_offers) <> 'array'
     or pg_catalog.jsonb_array_length(p_offers) = 0 then
    raise exception using errcode = '22023', message = 'A quote offer requires a price for every line';
  end if;
  if pg_catalog.jsonb_array_length(p_offers) <> (select count(*) from public.quote_items qi where qi.quote_id = p_quote_id) then
    raise exception using errcode = '22023', message = 'The offer must include every quote line exactly once';
  end if;
  for v_offer in select e.value from pg_catalog.jsonb_array_elements(p_offers) as e(value) loop
    if pg_catalog.jsonb_typeof(v_offer.value) <> 'object'
       or v_offer.value - array['item_id', 'unit_price'] <> '{}'::jsonb
       or coalesce(v_offer.value ->> 'item_id', '') !~* '^[0-9a-f-]{36}$'
       or coalesce(v_offer.value ->> 'unit_price', '') !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$' then
      raise exception using errcode = '22023', message = 'Each offer line requires a valid item id and a price with up to two decimals';
    end if;
    v_item_id := (v_offer.value ->> 'item_id')::uuid;
    v_price := (v_offer.value ->> 'unit_price')::numeric(12,2);
    if v_price < 0 then raise exception using errcode = '22023', message = 'Offer prices cannot be negative'; end if;
    update public.quote_items set offered_unit_price = v_price
      where id = v_item_id and quote_id = p_quote_id;
    if not found then raise exception using errcode = '22023', message = 'Offer contains an item outside this quote'; end if;
  end loop;
  if exists (select 1 from public.quote_items qi where qi.quote_id = p_quote_id and qi.offered_unit_price is null) then
    raise exception using errcode = '22023', message = 'The offer must price every line';
  end if;
  update public.quotes q set
    status = 'sent', valid_until = p_valid_until, sent_at = pg_catalog.now(),
    subtotal = totals.subtotal, tax_total = totals.tax_total, grand_total = totals.grand_total
  from (
    select sum(qi.line_subtotal)::numeric(12,2) as subtotal,
      sum(qi.line_tax)::numeric(12,2) as tax_total,
      sum(qi.line_total)::numeric(12,2) as grand_total
    from public.quote_items qi where qi.quote_id = p_quote_id
  ) totals
  where q.id = p_quote_id;
  return p_quote_id;
end;
$$;
revoke all on function private.send_business_quote(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function private.send_business_quote(uuid, jsonb, timestamptz) to authenticated;

create or replace function public.send_business_quote(
  p_quote_id uuid,
  p_offers jsonb,
  p_valid_until timestamptz
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.send_business_quote(p_quote_id, p_offers, p_valid_until); $$;
revoke all on function public.send_business_quote(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.send_business_quote(uuid, jsonb, timestamptz) to authenticated;

create or replace function private.respond_to_business_quote(
  p_quote_id uuid,
  p_decision public.quote_status
)
returns public.quote_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'Authentication is required'; end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception using errcode = '22023', message = 'A business quote decision must be accepted or rejected';
  end if;
  select q.* into v_quote from public.quotes q where q.id = p_quote_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Quote not found'; end if;
  if not (select private.is_org_admin(v_quote.organization_id)) then
    raise exception using errcode = '42501', message = 'Only an organization owner or admin can decide a quote';
  end if;
  if v_quote.status <> 'sent' then
    raise exception using errcode = '23514', message = 'Only a sent quote can be accepted or rejected';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < pg_catalog.now() then
    update public.quotes set status = 'expired' where id = p_quote_id;
    return 'expired'::public.quote_status;
  end if;
  update public.quotes set status = p_decision where id = p_quote_id;
  return p_decision;
end;
$$;
revoke all on function private.respond_to_business_quote(uuid, public.quote_status) from public, anon, authenticated;
grant execute on function private.respond_to_business_quote(uuid, public.quote_status) to authenticated;

create or replace function public.respond_to_business_quote(
  p_quote_id uuid,
  p_decision public.quote_status
)
returns public.quote_status
language sql
security invoker
set search_path = ''
as $$ select private.respond_to_business_quote(p_quote_id, p_decision); $$;
revoke all on function public.respond_to_business_quote(uuid, public.quote_status) from public, anon;
grant execute on function public.respond_to_business_quote(uuid, public.quote_status) to authenticated;

create or replace function private.update_quote_inquiry_status(
  p_inquiry_id uuid,
  p_status public.prospect_status
)
returns public.prospect_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current public.prospect_status;
begin
  if v_user_id is null or not (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])) then
    raise exception using errcode = '42501', message = 'Sales authorization is required';
  end if;
  select qi.status into v_current from public.quote_inquiries qi where qi.id = p_inquiry_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Quote inquiry not found'; end if;
  if p_status = v_current then return v_current; end if;
  if not (
    (v_current = 'new' and p_status in ('qualified', 'contacted', 'closed'))
    or (v_current = 'qualified' and p_status in ('contacted', 'converted', 'closed'))
    or (v_current = 'contacted' and p_status in ('qualified', 'converted', 'closed'))
    or (v_current = 'converted' and p_status = 'closed')
  ) then
    raise exception using errcode = '23514', message = 'Invalid quote inquiry status transition';
  end if;
  update public.quote_inquiries set status = p_status where id = p_inquiry_id;
  return p_status;
end;
$$;
revoke all on function private.update_quote_inquiry_status(uuid, public.prospect_status) from public, anon, authenticated;
grant execute on function private.update_quote_inquiry_status(uuid, public.prospect_status) to authenticated;

create or replace function public.update_quote_inquiry_status(
  p_inquiry_id uuid,
  p_status public.prospect_status
)
returns public.prospect_status
language sql
security invoker
set search_path = ''
as $$ select private.update_quote_inquiry_status(p_inquiry_id, p_status); $$;
revoke all on function public.update_quote_inquiry_status(uuid, public.prospect_status) from public, anon;
grant execute on function public.update_quote_inquiry_status(uuid, public.prospect_status) to authenticated;

drop policy if exists organizations_read_member on public.organizations;
create policy organizations_read_member on public.organizations for select to authenticated
  using ((select private.is_org_member(id)) or
    (select private.has_any_staff_role(array['super_admin']::public.app_role[])));

drop policy if exists organization_memberships_read_member on public.organization_memberships;
create policy organization_memberships_read_member on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_org_admin(organization_id)) or
    (select private.has_any_staff_role(array['super_admin']::public.app_role[])));

drop policy if exists quotes_read_owner_or_staff on public.quotes;
create policy quotes_read_owner_or_staff on public.quotes for select to authenticated
  using (
    (organization_id is not null and (select private.is_org_member(organization_id)))
    or (sales_owner_id = (select auth.uid()) and
      (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
    or (sales_owner_id is null and status = 'requested' and
      (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
    or (select private.has_any_staff_role(array['super_admin']::public.app_role[]))
  );
drop policy if exists quotes_insert_customer on public.quotes;
drop policy if exists quotes_manage_staff on public.quotes;

drop policy if exists quote_items_read_owner_or_staff on public.quote_items;
create policy quote_items_read_owner_or_staff on public.quote_items for select to authenticated
  using (exists (
    select 1 from public.quotes q where q.id = quote_id and (
      (q.organization_id is not null and (select private.is_org_member(q.organization_id)))
      or (q.sales_owner_id = (select auth.uid()) and
        (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
      or (q.sales_owner_id is null and q.status = 'requested' and
        (select private.has_any_staff_role(array['sales_manager', 'super_admin']::public.app_role[])))
      or (select private.has_any_staff_role(array['super_admin']::public.app_role[]))
    )
  ));
drop policy if exists quote_items_insert_customer on public.quote_items;
drop policy if exists quote_items_update_staff on public.quote_items;
drop policy if exists quote_items_delete_staff on public.quote_items;

create policy crm_activities_read_staff_or_tenant on public.crm_activities for select to authenticated
  using (
    (select private.has_any_staff_role(array['super_admin']::public.app_role[]))
    or (crm_lead_id is not null and
      (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
    or (quote_inquiry_id is not null and
      (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
    or (quote_id is not null and exists (
      select 1 from public.quotes q where q.id = quote_id and (
        (visibility = 'organization' and (select private.is_org_member(q.organization_id)))
        or (q.sales_owner_id = (select auth.uid()) and
          (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
        or (q.sales_owner_id is null and q.status = 'requested' and
          (select private.has_any_staff_role(array['sales_manager']::public.app_role[])))
      )
    ))
    or (organization_id is not null and visibility = 'organization' and
      (select private.is_org_member(organization_id)))
  );

-- Sales can work the public inbound inbox but does not gain global access to
-- organizations or memberships. Formal quote rows become private when claimed.
revoke insert, update, delete on public.organizations,
  public.quotes, public.quote_items, public.crm_activities
  from anon, authenticated, service_role;
revoke insert, update on public.organization_memberships from anon, authenticated, service_role;
revoke delete on public.organization_memberships from anon, service_role;
revoke all on public.crm_activities from anon, authenticated, service_role;
grant select on public.organizations, public.organization_memberships,
  public.quotes, public.quote_items to authenticated;
grant select on public.crm_activities to authenticated;
grant delete on public.organization_memberships to authenticated;
revoke update on public.quote_inquiries from anon, authenticated, service_role;
grant select on public.quote_inquiries to authenticated;

grant usage on schema private to authenticated;
