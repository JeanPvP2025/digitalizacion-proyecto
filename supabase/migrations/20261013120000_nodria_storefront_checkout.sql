begin;

-- Publish safe, aggregate-only read models for the public storefront.
create or replace function public.get_public_catalog_availability()
returns table (variant_id uuid, available_quantity integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.variant_id, pg_catalog.sum(i.on_hand - i.reserved)::integer
  from public.inventory i
  join public.warehouses w on w.id = i.warehouse_id and w.is_active and w.code = 'NODRIA-DEMO'
  join public.product_variants v on v.id = i.variant_id and v.is_active
      and v.attributes #>> '{nodria_store,mode}' = 'academic_demo'
  join public.products p on p.id = v.product_id and p.is_published
  group by i.variant_id
  having pg_catalog.sum(i.on_hand - i.reserved) > 0;
$$;

revoke all on function public.get_public_catalog_availability() from public, anon, authenticated;
grant execute on function public.get_public_catalog_availability() to anon, authenticated;

create or replace function public.get_public_product_review_summary()
returns table (product_id text, average_rating numeric, review_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.product_id, pg_catalog.round(pg_catalog.avg(r.rating)::numeric, 1), pg_catalog.count(*)
  from public.product_reviews r
  join public.products p on p.id = r.product_id and p.is_published
  where r.status = 'published'
  group by r.product_id;
$$;

revoke all on function public.get_public_product_review_summary() from public, anon, authenticated;
grant execute on function public.get_public_product_review_summary() to anon, authenticated;

update public.categories
   set description = case slug
     when 'componentes' then 'Componentes de ordenador con precio, disponibilidad y compatibilidad para tu montaje.'
     when 'almacenamiento' then 'Unidades de almacenamiento para ampliar tus dispositivos.'
     when 'procesadores' then 'Procesadores para distintas necesidades de juego, creación y trabajo.'
     when 'placas-base' then 'Placas base con conexiones y formatos para cada configuración.'
     when 'memoria-ram' then 'Memoria para completar o ampliar tu equipo.'
     when 'cajas' then 'Cajas con dimensiones y formatos para tu montaje.'
     when 'fuentes-alimentacion' then 'Fuentes de alimentación con distintas capacidades y certificaciones.'
     when 'tarjetas-graficas' then 'Tarjetas gráficas para juego, creación y trabajo visual.'
     when 'refrigeracion' then 'Soluciones de refrigeración para procesadores y equipos.'
     when 'ssd-internos' then 'Unidades SSD para ampliar la capacidad y el almacenamiento de tu equipo.'
     else description
   end,
   updated_at = now()
 where slug in ('componentes','almacenamiento','procesadores','placas-base','memoria-ram','cajas',
               'fuentes-alimentacion','tarjetas-graficas','refrigeracion','ssd-internos');

-- The storefront can inspect only NODRIA demo availability. Existing staff policies
-- continue to govern the rest of inventory and warehouse data.
drop policy if exists nodria_demo_warehouse_public_read on public.warehouses;
create policy nodria_demo_warehouse_public_read on public.warehouses
  for select to anon, authenticated
  using (code = 'NODRIA-DEMO' and is_active);

drop policy if exists nodria_demo_inventory_public_read on public.inventory;
create policy nodria_demo_inventory_public_read on public.inventory
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.warehouses w
      where w.id = inventory.warehouse_id and w.code = 'NODRIA-DEMO' and w.is_active
    )
    and exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = inventory.variant_id
        and v.is_active
        and v.attributes #>> '{nodria_store,mode}' = 'academic_demo'
        and p.is_published
    )
  );

grant select on public.warehouses, public.inventory to anon;

-- Keep this SQL safe if an operator pastes it into Supabase more than once.
create temporary table _nodria_storefront_variants on commit drop as
select v.id as variant_id, v.product_id, v.sku, v.current_price, v.attributes,
       p.name, p.brand, p.summary, p.description,
       v.attributes -> 'reference_price' as former_reference
from public.product_variants v
join public.products p on p.id = v.product_id
where v.is_active
  and p.is_published
  and v.attributes ? 'reference_price'
  and coalesce((v.attributes -> 'nodria_store' ->> 'inventory_seeded')::boolean, false) = false;

do $migration$
declare
  v_warehouse_id uuid;
  v_row record;
  v_available integer;
begin
  insert into public.warehouses (code, name, city, country_code, is_active)
  values ('NODRIA-DEMO', 'NODRIA · tienda de demostración', 'Madrid', 'ES', true)
  on conflict (code) do update set
    name = excluded.name,
    city = excluded.city,
    country_code = excluded.country_code,
    is_active = true
  returning id into v_warehouse_id;

  for v_row in select * from _nodria_storefront_variants order by sku loop
    insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
    values (v_warehouse_id, v_row.variant_id, 0, 0)
    on conflict (warehouse_id, variant_id) do nothing;

    select greatest(0, i.on_hand - i.reserved) into v_available
    from public.inventory i
    where i.warehouse_id = v_warehouse_id and i.variant_id = v_row.variant_id
    for update;

    if v_available < 12 then
      perform private.adjust_inventory(
        v_warehouse_id,
        v_row.variant_id,
        12 - v_available,
        'Alta inicial de existencias para el checkout académico NODRIA'
      );
    end if;

    update public.product_variants v
       set title = 'Estándar',
           attributes = (v.attributes - 'reference_price') || jsonb_build_object(
             'nodria_store', jsonb_build_object(
               'mode', 'academic_demo',
               'model_number', v_row.former_reference ->> 'mpn',
               'price_updated_at', v_row.former_reference ->> 'observed_at',
               'inventory_seeded', true
             )
           ),
           updated_at = now()
     where v.id = v_row.variant_id;

    update public.products p
       set summary = p.brand || ' · modelo ' || coalesce(v_row.former_reference ->> 'mpn', v_row.sku) ||
             '. Precio de catálogo NODRIA para esta experiencia de demostración.',
           description = p.name || ' (' || coalesce(v_row.former_reference ->> 'mpn', v_row.sku) ||
             '). Precio mostrado en la tienda NODRIA. El checkout y las existencias pertenecen a una demostración académica; el pedido no genera un cargo ni un envío real.',
           updated_at = now()
     where p.id = v_row.product_id;
  end loop;
end
$migration$;

commit;
