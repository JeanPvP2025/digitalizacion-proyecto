-- Run after a clean local reset with:
-- pnpm dlx supabase@latest test db --local tests/database
create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;
select plan(16);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
)
values
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'catalog-editor@nodria.test', '', '{}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'catalog-customer@nodria.test', '', '{}', '{"role":"super_admin"}', now(), now());

insert into public.user_role_grants (user_id, role)
values ('20000000-0000-0000-0000-000000000001', 'catalog_manager');

insert into public.products (id, slug, sku, name, brand, summary, is_published)
values ('pgtap-catalog-editorial', 'pgtap-catalog-editorial', 'PGTAP-CATALOG-EDITORIAL', 'Producto de prueba', 'NODRIA', 'Original', false);

select ok(
  not has_table_privilege('authenticated', 'public.categories', 'INSERT')
  and not has_table_privilege('authenticated', 'public.categories', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.categories', 'DELETE')
  and not has_table_privilege('authenticated', 'public.products', 'INSERT')
  and not has_table_privilege('authenticated', 'public.products', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.products', 'DELETE')
  and not has_table_privilege('authenticated', 'public.product_categories', 'INSERT')
  and not has_table_privilege('authenticated', 'public.product_categories', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.product_categories', 'DELETE')
  and not has_table_privilege('authenticated', 'public.product_variants', 'INSERT')
  and not has_table_privilege('authenticated', 'public.product_variants', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.product_variants', 'DELETE')
  and not has_table_privilege('authenticated', 'public.product_specifications', 'INSERT')
  and not has_table_privilege('authenticated', 'public.product_specifications', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.product_specifications', 'DELETE')
  and not has_any_column_privilege('authenticated', 'public.categories', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.categories', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.products', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.products', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.product_categories', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.product_categories', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.product_variants', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.product_variants', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.product_specifications', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.product_specifications', 'UPDATE'),
  'authenticated has no direct table or column catalog DML on all five tables'
);
select ok(
  has_table_privilege('authenticated', 'public.products', 'SELECT')
  and has_table_privilege('anon', 'public.products', 'SELECT'),
  'catalog read grants remain available'
);
select ok(
  not has_function_privilege('public', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'private.update_catalog_product_editorial_impl(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.update_catalog_product_editorial_impl(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'private.update_catalog_product_editorial_impl(text,jsonb)', 'EXECUTE')
  and not (select procedure.prosecdef from pg_catalog.pg_proc as procedure
           where procedure.oid = 'public.update_catalog_product_editorial(text,jsonb)'::pg_catalog.regprocedure)
  and (select procedure.prosecdef from pg_catalog.pg_proc as procedure
       where procedure.oid = 'private.update_catalog_product_editorial_impl(text,jsonb)'::pg_catalog.regprocedure)
  and not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(procedure.proacl) as acl
    where procedure.oid = 'public.update_catalog_product_editorial(text,jsonb)'::pg_catalog.regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  )
  and has_function_privilege('authenticated', 'public.update_catalog_product_editorial(text,jsonb)', 'EXECUTE'),
  'editorial RPC execute is granted only to authenticated'
);

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select throws_ok($$update public.products set is_published = true where id = 'pgtap-catalog-editorial'$$, '42501', null, 'direct protected-column update is denied');
select throws_ok($$insert into public.product_specifications (product_id,label,value) values ('pgtap-catalog-editorial','X','Y')$$, '42501', null, 'direct catalog insert is denied');
select throws_ok($$delete from public.products where id = 'pgtap-catalog-editorial'$$, '42501', null, 'direct catalog delete is denied');
select is(
  public.update_catalog_product_editorial(
    'pgtap-catalog-editorial',
    '{"name":"Nombre editorial","summary":"Resumen editorial","description":"Descripción editorial","image_url":"https://example.test/product.jpg","image_alt":"Producto de muestra","badge":"Nuevo"}'::jsonb
  ) ->> 'changed',
  'true',
  'catalog manager can write the six permitted fields'
);
select is(
  public.update_catalog_product_editorial(
    'pgtap-catalog-editorial',
    '{"name":"Nombre editorial","summary":"Resumen editorial","description":"Descripción editorial","image_url":"https://example.test/product.jpg","image_alt":"Producto de muestra","badge":"Nuevo"}'::jsonb
  ) ->> 'changed',
  'false',
  'replaying the same edit is safe and does not change the row again'
);
reset role;

select is(
  (select name || '|' || summary || '|' || description || '|' || image_url || '|' || image_alt || '|' || badge
   from public.products where id = 'pgtap-catalog-editorial'),
  'Nombre editorial|Resumen editorial|Descripción editorial|https://example.test/product.jpg|Producto de muestra|Nuevo',
  'editorial values persist'
);
select is(
  (select is_published::text || '|' || rating_average::text || '|' || rating_count::text || '|' || sku
   from public.products where id = 'pgtap-catalog-editorial'),
  'false|0.0|0|PGTAP-CATALOG-EDITORIAL',
  'protected product fields remain unchanged'
);

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
set local "request.jwt.claims" = '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","user_metadata":{"role":"super_admin"}}';
set local role authenticated;
select throws_ok(
  $$select public.update_catalog_product_editorial('pgtap-catalog-editorial', '{"name":"Escalado por metadata"}'::jsonb)$$,
  '42501', null, 'customer user_metadata cannot grant catalog access'
);
reset role;

insert into public.user_role_grants (user_id, role)
values ('20000000-0000-0000-0000-000000000002', 'super_admin');
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
set local "request.jwt.claims" = '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","user_metadata":{"role":"catalog_manager"}}';
set local role authenticated;
select is(
  public.update_catalog_product_editorial('pgtap-catalog-editorial', '{"name":"Superadmin edit"}'::jsonb) ->> 'changed',
  'true',
  'a persisted super_admin grant is authorized'
);
reset role;

set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
set local "request.jwt.claims" = '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select throws_ok($$select public.update_catalog_product_editorial('pgtap-catalog-editorial', '{"is_published":true}'::jsonb)$$, '22023', null, 'protected and unknown keys are rejected');
select throws_ok($$select public.update_catalog_product_editorial('pgtap-catalog-editorial', '{"name":null}'::jsonb)$$, '22023', null, 'invalid JSON types are rejected');
select throws_ok($$select public.update_catalog_product_editorial('pgtap-catalog-editorial', '{"name":"x"}'::jsonb)$$, '22023', null, 'field length limits are enforced');
select throws_ok($$select public.update_catalog_product_editorial('does-not-exist', '{"name":"No existe"}'::jsonb)$$, 'P0002', null, 'unknown product is not silently accepted');
reset role;

select * from finish();
rollback;
