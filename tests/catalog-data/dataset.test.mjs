import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDataset } from '../../scripts/catalog/dataset.mjs';
import { validateDataset } from '../../scripts/catalog/validate.mjs';
import { renderMigration } from '../../scripts/catalog/generate.mjs';
import { mapCatalogRows } from '../../lib/catalog-mapping.ts';
import { mapPcBuilderRows } from '../../lib/pc-builder/catalog-mapping.ts';
import { checkBuildCompatibility, pcBuilderCategories } from '../../lib/pc-builder/compatibility.ts';
import { getCatalogBrands, getCatalogCampaign, getCatalogCampaigns, getCatalogCategory, getCatalogCategoryDirectory } from '../../lib/catalog-landings.ts';

test('deterministic curated coverage and varied availability', () => {
  const data = buildDataset();
  assert.deepEqual(data, buildDataset());
  assert.deepEqual(validateDataset(data), { newProducts: 84, categories: 27, newBrands: 6, soldOut: 8, lowStock: 10 });
  assert.equal(new Set(data.products.map(p => p.family)).size, 21);
  assert.equal(data.products.filter(p => p.rating_count === 0).length, 12);
});

const invalidCases = [
  ['duplicate SKU', d => { d.products[1].sku = d.products[0].sku; }],
  ['duplicate slug', d => { d.products[1].slug = d.products[0].slug; }],
  ['duplicate variant', d => { d.products[1].variant.id = d.products[0].variant.id; }],
  ['negative price', d => { d.products[0].variant.current_price = '-1.00'; }],
  ['fractional stock', d => { d.products[0].stock = 0.5; }],
  ['invalid discount', d => { d.products[0].variant.compare_at_price = '1.00'; }],
  ['category mismatch', d => { d.products[0].category_slug = 'moviles'; }],
  ['category cycle', d => { d.categories[0].parent_slug = 'portatiles'; }],
  ['internal cost data', d => { d.products[0].variant.attributes.cost_eur = 100; }],
  ['rating without reviews', d => { d.products[0].rating_average = 4; }],
  ['missing specs', d => { d.products[0].specifications = []; }],
  ['invalid technical value', d => { d.products[0].variant.attributes.technical.memory_gb = -32; }],
  ['builder socket mismatch', d => { d.products.find(p => p.category_slug === 'procesadores').variant.attributes.pc_builder.socket = 'other'; }],
  ['missing builder attrs', d => { delete d.products.find(p => p.category_slug === 'cajas').variant.attributes.pc_builder; }],
];
for (const [name, mutate] of invalidCases) test(`rejects ${name}`, () => {
  const data = buildDataset();
  mutate(data);
  assert.throws(() => validateDataset(data));
});

test('new identities never overlap the historical seed', () => {
  const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8');
  for (const p of buildDataset().products) {
    for (const identity of [p.id, p.sku, p.slug]) assert(!seed.includes(`'${identity}'`));
  }
});

function rowsFor(data) {
  const category = new Map(data.categories.map(c => [c.slug, c.id]));
  return {
    products: data.products.map(p => ({ ...p, is_published: true })),
    categories: data.categories.map(c => ({ ...c, parent_id: c.parent_slug ? category.get(c.parent_slug) : null, is_active: true })),
    productCategories: data.products.flatMap(p => [p.root_category, p.category_slug].map(slug => ({ product_id: p.id, category_id: category.get(slug) }))),
    variants: data.products.map(p => ({ ...p.variant, product_id: p.id, is_active: true })),
    specifications: data.products.flatMap(p => p.specifications.map(s => ({ ...s, product_id: p.id }))),
  };
}

test('existing storefront mapper exposes all products using six root categories', () => {
  const result = mapCatalogRows(rowsFor(buildDataset()));
  assert.equal(result.products.length, 84);
  assert.equal(result.categories.filter(category => !category.parentId).length, 6);
  assert.equal(result.categories.length, 27);
  assert.equal(new Set(result.products.map(p => p.category)).size, 6);
  assert(result.products.every(p => p.specifications.length >= 6 && p.price > 0));
  assert(result.products.every(product => product.categoryIds.length === 2));
});

test('existing configurator accepts all eight typed component classes', () => {
  const { components } = mapPcBuilderRows(rowsFor(buildDataset()));
  assert.equal(components.length, 32);
  assert.equal(new Set(components.map(c => c.category)).size, 8);
  assert(components.every(c => c.variantId && c.priceEur > 0));
});

test('active catalog data generates working brand, category and campaign landings', () => {
  const mapped = mapCatalogRows(rowsFor(buildDataset()));
  const catalog = { source: 'supabase', ...mapped };
  const brands = getCatalogBrands(catalog);
  assert.equal(brands.length, 6);
  assert.equal(brands.reduce((count, brand) => count + brand.products.length, 0), 84);
  assert.equal(brands.find(brand => brand.name === 'Veltrama')?.slug, 'veltrama');

  const categoryRoots = getCatalogCategoryDirectory(catalog);
  assert.equal(categoryRoots.length, 6);
  assert.equal(getCatalogCategory(catalog, 'ordenadores').products.length, 12);
  assert.equal(getCatalogCategory(catalog, 'portatiles').products.length, 4);

  const campaigns = getCatalogCampaigns(catalog);
  assert(campaigns.length >= 3);
  const pcCampaign = getCatalogCampaign(catalog, 'componentes-pc');
  assert.equal(pcCampaign.products.length, 32);
  assert.equal(new Set(pcCampaign.products.map(product => product.id)).size, 32);
  assert(pcCampaign.categories.every(category => category.count > 0));
});

test('PC Builder dataset compatibility matrix accepts supported combinations and reports real conflicts', () => {
  const { components } = mapPcBuilderRows(rowsFor(buildDataset()));
  const byCategory = Object.fromEntries(pcBuilderCategories.map(category => [
    category, components.filter(component => component.category === category),
  ]));
  for (const category of pcBuilderCategories) assert.equal(byCategory[category].length, 4, `${category} coverage`);

  const highestPsu = byCategory.psu.reduce((best, component) => component.capacityW > best.capacityW ? component : best);
  let supportedCoreCombinations = 0;
  for (const cpu of byCategory.cpu) for (const motherboard of byCategory.motherboard)
    for (const memory of byCategory.memory) for (const pcCase of byCategory.case) {
      const selection = { cpu: cpu.variantId, motherboard: motherboard.variantId, memory: memory.variantId, case: pcCase.variantId, psu: highestPsu.variantId };
      const result = checkBuildCompatibility(selection, components);
      assert.equal(result.status, 'compatible', `${cpu.name} + ${motherboard.name} + ${memory.name} + ${pcCase.name}: ${result.issues.map(issue => issue.code).join(',')}`);
      supportedCoreCombinations += 1;
    }
  assert.equal(supportedCoreCombinations, 256);

  const cpu = byCategory.cpu.at(-1);
  const motherboard = byCategory.motherboard.find(part => part.formFactor === 'ATX');
  const memory = byCategory.memory.at(-1);
  const pcCase = byCategory.case.at(-1);
  const gpu = byCategory.gpu.find(part => part.lengthMm === 330);
  const tooSmallCase = byCategory.case.find(part => part.maxGpuLengthMm === 300);
  const gpuConflict = checkBuildCompatibility({
    cpu: cpu.variantId, motherboard: motherboard.variantId, memory: memory.variantId,
    case: tooSmallCase.variantId, psu: highestPsu.variantId, gpu: gpu.variantId,
  }, components);
  assert.equal(gpuConflict.status, 'incompatible');
  assert(gpuConflict.errors.some(issue => issue.code === 'gpu-too-long'));

  const lowHeadroomPsu = byCategory.psu.find(part => part.capacityW === 450);
  const moderateGpu = byCategory.gpu.find(part => part.estimatedPowerW === 230);
  const powerReview = checkBuildCompatibility({
    cpu: cpu.variantId, motherboard: motherboard.variantId, memory: memory.variantId,
    case: pcCase.variantId, psu: lowHeadroomPsu.variantId, gpu: moderateGpu.variantId,
  }, components);
  assert.equal(powerReview.status, 'review');
  assert(powerReview.warnings.some(issue => issue.code === 'psu-headroom-below-guideline'));
});

test('migration is additive and does not install any public schema or function', () => {
  const sql = renderMigration(buildDataset()).replace(/^\s*--.*$/gm, '');
  assert(!/\b(delete|truncate|update|drop|grant|create table|create function)\b/i.test(sql));
  assert(!/insert into public\.(orders|order_items|payment_transactions|product_reviews|purchase_orders)\b/i.test(sql));
});
