import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const telecom = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../lib/catalog-data/telecom-products.json"), "utf8"));
const migrationPath = path.resolve(__dirname, "../supabase/migrations/20261028190000_telecom_catalog_restructuring.sql");

// Read existing variant UUIDs if migration exists
const existingSql = fs.readFileSync(migrationPath, "utf8");
const regex = /values\s*\(\s*'([0-9a-f-]{36})',\s*'(tel-[a-z0-9-]+|ref-storage-[a-z0-9-]+)'/g;
let m;
const variantMap = {};
while ((m = regex.exec(existingSql)) !== null) {
  variantMap[m[2]] = m[1];
}

function sqlEscape(str) {
  if (str === null || str === undefined) return "null";
  return `'${String(str).replace(/'/g, "''")}'`;
}

const idToSlug = new Map();
for (const cat of telecom.categories) {
  idToSlug.set(cat.id, cat.slug);
  for (const sub of cat.subcategories) {
    idToSlug.set(sub.id, sub.slug);
  }
}

let sql = `-- NODRIA — Telecom & Industrial Restructuring Migration
-- Upserts the 5 specialized telecom categories and 25 subcategories.
-- Upserts the 52 commercial telecommunications products, variants, specifications, and initial demo inventory.
-- Retires legacy gaming fixtures by setting is_published = false without deleting historical orders.
-- Completely idempotent and safe for repeated execution.

begin;

-- 1. Upsert Root Categories and Subcategories
`;

for (const cat of telecom.categories) {
  sql += `insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values (${sqlEscape(cat.id)}::uuid, ${sqlEscape(cat.slug)}, ${sqlEscape(cat.name)}, ${sqlEscape(cat.description)}, ${cat.sortOrder}, null, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true,
  updated_at = now();

`;

  for (const sub of cat.subcategories) {
    sql += `insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
select ${sqlEscape(sub.id)}::uuid, ${sqlEscape(sub.slug)}, ${sqlEscape(sub.name)}, ${sqlEscape(sub.description)}, ${sub.sortOrder}, c.id, true
from public.categories c
where c.slug = ${sqlEscape(cat.slug)}
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

`;
  }
}

sql += `
-- 2. Retire legacy gaming PC components from public store without deleting records
update public.products
   set is_published = false,
       is_featured = false,
       updated_at = now()
 where id not in (
${telecom.products.map((p) => `   ${sqlEscape(p.id)}`).join(",\n")}
 );

-- 3. Upsert Warehouse for Demo Stock
insert into public.warehouses (code, name, city, country_code, is_active)
values ('NODRIA-DEMO', 'NODRIA · Tienda Principal y Logística', 'Madrid', 'ES', true)
on conflict (code) do update set
  name = excluded.name,
  city = excluded.city,
  country_code = excluded.country_code,
  is_active = true;

-- 4. Upsert Telecommunications Products, Variants, Specifications, and Stock
do $telecom_migration$
declare
  v_warehouse_id uuid;
  v_available integer;
begin
  select id into v_warehouse_id from public.warehouses where code = 'NODRIA-DEMO';
  if v_warehouse_id is null then
    select id into v_warehouse_id from public.warehouses where is_active limit 1;
  end if;

`;

for (const product of telecom.products) {
  const variantId = variantMap[product.id];
  if (!variantId) {
    throw new Error(`Missing variant UUID for ${product.id}`);
  }

  const slugs = product.categoryIds.map((id) => idToSlug.get(id)).filter(Boolean);

  sql += `  -- Product: ${product.sku} (${product.name})
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    ${sqlEscape(product.id)}, ${sqlEscape(product.slug)}, ${sqlEscape(product.sku)}, ${sqlEscape(product.name)}, ${sqlEscape(product.brand)},
    ${sqlEscape(product.summary)}, ${sqlEscape(product.summary)},
    ${sqlEscape(product.image)}, ${sqlEscape(product.imageAlt)}, ${product.badge ? sqlEscape(product.badge) : "null"},
    ${product.rating ?? 4.8}, ${product.reviewCount ?? 12}, ${product.featured ? "true" : "false"}, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  select ${sqlEscape(product.id)}, c.id
  from public.categories c
  where c.slug in (${slugs.map(sqlEscape).join(", ")})
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    ${sqlEscape(variantId)}::uuid, ${sqlEscape(product.id)}, ${sqlEscape(product.sku)}, 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', ${sqlEscape(product.modelNumber || product.sku)},
        'brand', ${sqlEscape(product.brand)},
        'sku', ${sqlEscape(product.sku)}
      )
    ),
    ${product.price.toFixed(2)}, null, 'EUR', 0.21, true
  )
  on conflict (id) do update set
    product_id = excluded.product_id,
    sku = excluded.sku,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    compare_at_price = excluded.compare_at_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, ${sqlEscape(variantId)}::uuid, 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = ${sqlEscape(variantId)}::uuid;

  if v_available < ${product.stock ?? 10} then
    perform private.adjust_inventory(
      v_warehouse_id,
      ${sqlEscape(variantId)}::uuid,
      ${product.stock ?? 10} - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
`;

  product.specifications.forEach((spec, idx) => {
    sql += `  insert into public.product_specifications (product_id, label, value, sort_order)
  values (${sqlEscape(product.id)}, ${sqlEscape(spec.label)}, ${sqlEscape(spec.value)}, ${(idx + 1) * 10})
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
`;
  });

  sql += "\n";
}

sql += `end
$telecom_migration$;

commit;
`;

fs.writeFileSync(migrationPath, sql, "utf8");
console.log("Successfully generated synced migration file.");
