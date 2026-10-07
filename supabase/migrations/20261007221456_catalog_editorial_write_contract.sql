-- Replace broad PostgREST writes to catalog tables with a narrow editorial RPC.
-- Read grants and the existing RLS policies are intentionally preserved.
revoke insert, update, delete on table
  public.categories,
  public.products,
  public.product_categories,
  public.product_variants,
  public.product_specifications
from authenticated;

create or replace function private.update_catalog_product_editorial_impl(
  p_product_id text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product public.products%rowtype;
  v_changed boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not private.has_any_staff_role(array['catalog_manager', 'super_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'catalog_editor_role_required';
  end if;

  if p_product_id is null
     or pg_catalog.char_length(p_product_id) not between 1 and 100
     or p_changes is null
     or pg_catalog.jsonb_typeof(p_changes) is distinct from 'object'
     or p_changes = '{}'::pg_catalog.jsonb then
    raise exception using errcode = '22023', message = 'invalid_editorial_patch';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_changes) as keys(key_name)
    where key_name not in ('name', 'summary', 'description', 'image_url', 'image_alt', 'badge')
  ) then
    raise exception using errcode = '22023', message = 'unknown_or_protected_product_field';
  end if;

  if (p_changes ? 'name' and (
        pg_catalog.jsonb_typeof(p_changes -> 'name') is distinct from 'string'
        or pg_catalog.char_length(pg_catalog.btrim(p_changes ->> 'name')) not between 2 and 180
      ))
     or (p_changes ? 'summary' and (
        pg_catalog.jsonb_typeof(p_changes -> 'summary') is distinct from 'string'
        or pg_catalog.char_length(p_changes ->> 'summary') > 500
      ))
     or (p_changes ? 'description' and (
        pg_catalog.jsonb_typeof(p_changes -> 'description') is distinct from 'string'
        or pg_catalog.char_length(p_changes ->> 'description') > 10000
      ))
     or (p_changes ? 'image_alt' and (
        pg_catalog.jsonb_typeof(p_changes -> 'image_alt') is distinct from 'string'
        or pg_catalog.char_length(p_changes ->> 'image_alt') > 300
      ))
     or (p_changes ? 'image_url' and (
        pg_catalog.jsonb_typeof(p_changes -> 'image_url') not in ('string', 'null')
        or (pg_catalog.jsonb_typeof(p_changes -> 'image_url') = 'string' and (
             pg_catalog.char_length(p_changes ->> 'image_url') not between 1 and 2048
             or (p_changes ->> 'image_url') !~ '^https?://[^[:space:]]+$'
           ))
      ))
     or (p_changes ? 'badge' and (
        pg_catalog.jsonb_typeof(p_changes -> 'badge') not in ('string', 'null')
        or (pg_catalog.jsonb_typeof(p_changes -> 'badge') = 'string'
            and pg_catalog.char_length(p_changes ->> 'badge') > 80)
      )) then
    raise exception using errcode = '22023', message = 'invalid_editorial_field_value';
  end if;

  select product.* into v_product
  from public.products as product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'catalog_product_not_found';
  end if;

  v_changed :=
    (p_changes ? 'name' and v_product.name is distinct from p_changes ->> 'name')
    or (p_changes ? 'summary' and v_product.summary is distinct from p_changes ->> 'summary')
    or (p_changes ? 'description' and v_product.description is distinct from p_changes ->> 'description')
    or (p_changes ? 'image_url' and v_product.image_url is distinct from p_changes ->> 'image_url')
    or (p_changes ? 'image_alt' and v_product.image_alt is distinct from p_changes ->> 'image_alt')
    or (p_changes ? 'badge' and v_product.badge is distinct from p_changes ->> 'badge');

  if v_changed then
    update public.products as product
    set name = case when p_changes ? 'name' then p_changes ->> 'name' else product.name end,
        summary = case when p_changes ? 'summary' then p_changes ->> 'summary' else product.summary end,
        description = case when p_changes ? 'description' then p_changes ->> 'description' else product.description end,
        image_url = case when p_changes ? 'image_url' then p_changes ->> 'image_url' else product.image_url end,
        image_alt = case when p_changes ? 'image_alt' then p_changes ->> 'image_alt' else product.image_alt end,
        badge = case when p_changes ? 'badge' then p_changes ->> 'badge' else product.badge end
    where product.id = p_product_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'changed', v_changed,
    'productId', p_product_id
  );
end;
$function$;

-- The exposed RPC is an invoker wrapper. Privileged writes stay in the
-- non-exposed private schema, following Supabase's function security guidance.
create or replace function public.update_catalog_product_editorial(
  p_product_id text,
  p_changes jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.update_catalog_product_editorial_impl(p_product_id, p_changes);
$function$;

revoke all on function private.update_catalog_product_editorial_impl(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function private.update_catalog_product_editorial_impl(text, jsonb) to authenticated;
revoke all on function public.update_catalog_product_editorial(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.update_catalog_product_editorial(text, jsonb) to authenticated;
