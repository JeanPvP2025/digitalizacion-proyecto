import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../../lib/catalog-data/verified-reference-products.json", import.meta.url), "utf8"));
const migration = await readFile(new URL("../../supabase/migrations/20261013070617_verified_product_reference_catalog.sql", import.meta.url), "utf8");
const seed = await readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8");

test("the published reference catalog contains eight real, source-bound products per PC category", () => {
  assert.equal(catalog.source, "PcComponentes España");
  assert.equal(catalog.checkedAt, "2026-10-13");
  assert.equal(catalog.products.length, 64);

  const categoryCounts = new Map();
  const ids = new Set();
  const slugs = new Set();
  const skus = new Set();
  const images = new Set();
  for (const product of catalog.products) {
    assert.ok(product.name.length > 1);
    assert.ok(product.brand.length > 0);
    assert.ok(product.modelNumber.length > 0);
    assert.ok(Number.isFinite(product.priceEur) && product.priceEur > 0);
    assert.equal(product.checkedAt, catalog.checkedAt);
    assert.equal(product.source, "PcComponentes");
    assert.equal(product.seller, "PcComponentes");
    assert.match(product.productUrl, /^https:\/\/www\.pccomponentes\.com\//);
    const image = new URL(product.imageUrl);
    assert.equal(image.protocol, "https:");
    assert.ok(["img.pccomponentes.com", "thumb.pccomponentes.com"].includes(image.hostname));
    assert.match(image.pathname, /\/articles\//);
    assert.ok(product.imageAlt.trim().length > 1);
    assert.ok(product.specifications.length > 0);

    assert.equal(ids.has(product.id), false, "product id must be unique");
    assert.equal(slugs.has(product.slug), false, "product slug must be unique");
    assert.equal(skus.has(product.sku), false, "model SKU must be unique");
    assert.equal(images.has(product.imageUrl), false, "each model must have its own verified photo");
    ids.add(product.id);
    slugs.add(product.slug);
    skus.add(product.sku);
    images.add(product.imageUrl);
    categoryCounts.set(product.categorySlug, (categoryCounts.get(product.categorySlug) ?? 0) + 1);
  }

  assert.deepEqual([...categoryCounts.values()].sort((a, b) => a - b), Array(8).fill(8));
});

test("the migration upserts real photo-bound references and retires legacy synthetic fixtures without deleting history", () => {
  for (const product of catalog.products) {
    assert.ok(migration.includes(product.id));
    assert.ok(migration.includes(product.imageUrl));
    assert.ok(migration.includes(product.productUrl));
    assert.ok(migration.includes(product.modelNumber));
  }
  assert.match(migration, /'image_url', v_row\."imageUrl"/);
  assert.match(migration, /jsonb_array_elements\(v_row\.specifications\)\s+with ordinality as spec\(item, ordinality\)/i);
  assert.match(migration, /spec\.item\s*->>\s*'label'/);
  assert.match(migration, /spec\.item\s*->>\s*'value'/);
  assert.doesNotMatch(migration, /jsonb_to_recordset\(v_row\.specifications\)\s+with ordinality/i);
  assert.match(migration, /is_published = false/);
  assert.match(migration, /private\.adjust_inventory/);
  assert.doesNotMatch(migration, /\bdelete\s+from\s+public\.(products|orders|order_items)\b/i);
  assert.doesNotMatch(migration, /enable\s+row\s+level\s+security|grant\s+/i);
  assert.match(seed, /Retirada de inventario sintético de seed/);
  assert.match(seed, /is_published = false/);
});
