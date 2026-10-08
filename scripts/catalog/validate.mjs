import assert from 'node:assert/strict';
import { buildDataset } from './dataset.mjs';

const unique = (values, label) => assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const money = value => typeof value === 'string' && /^\d+\.\d{2}$/.test(value) && Number(value) > 0;
const builderCategories = { procesadores: 'cpu', 'placas-base': 'motherboard', 'memoria-ram': 'memory', cajas: 'case', 'fuentes-alimentacion': 'psu', 'tarjetas-graficas': 'gpu', refrigeracion: 'cooler', 'ssd-internos': 'storage' };

export function validateDataset(data) {
  assert.equal(data.products.length, 84, 'Expected 84 new products');
  for (const key of ['id','sku','slug']) unique(data.products.map(p => p[key]), `product ${key}`);
  for (const key of ['id','sku']) unique(data.products.map(p => p.variant[key]), `variant ${key}`);
  unique(data.categories.map(c => c.slug), 'category slug');
  unique(data.categories.map(c => c.id), 'category id');
  const categories = new Map(data.categories.map(c => [c.slug, c]));
  for (const c of data.categories) {
    assert.match(c.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    const visited = new Set([c.slug]);
    let parent = c.parent_slug;
    while (parent) {
      assert(categories.has(parent), `Missing parent ${parent}`);
      assert(!visited.has(parent), 'Category cycle');
      visited.add(parent);
      parent = categories.get(parent).parent_slug;
    }
  }
  for (const p of data.products) {
    assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.match(p.sku, /^[A-Z0-9-]{1,64}$/);
    assert.equal(p.variant.sku, p.sku);
    assert(p.summary.length <= 500 && p.image_alt.length <= 300);
    assert(money(p.variant.current_price), 'Invalid price');
    assert(p.variant.compare_at_price === null || (money(p.variant.compare_at_price) && Number(p.variant.compare_at_price) > Number(p.variant.current_price)), 'Invalid compare price');
    assert.equal(p.variant.currency, 'EUR');
    assert.equal(p.variant.tax_rate, '0.2100');
    assert(Number.isInteger(p.stock) && p.stock >= 0 && p.stock <= 100000, 'Invalid stock');
    assert(Number.isInteger(p.rating_count) && p.rating_count >= 0 && p.rating_average >= 0 && p.rating_average <= 5, 'Invalid rating');
    assert.equal(p.rating_count === 0, p.rating_average === 0, 'Inconsistent rating');
    assert.equal(categories.get(p.category_slug)?.parent_slug, p.root_category, 'Inconsistent category');
    const a = p.variant.attributes;
    assert.equal(a.demo, true);
    assert.equal(a.dataset_version, data.version);
    assert.equal(a.family, p.family);
    assert.equal(a.use_case, p.use_case);
    assert(!/"[^"\n]*(cost|margin|secret|service_role)[^"\n]*"\s*:/i.test(JSON.stringify(p)), 'Internal data in public fixture');
    unique(p.specifications.map(s => s.label), 'specification label');
    assert(p.specifications.length >= 6, 'Insufficient specifications');
    assert(p.specifications.every(s => s.value && s.value.length <= 500 && s.label.length <= 100));
    const t = a.technical;
    assert(t && Object.keys(t).length >= 3, 'Missing technical attributes');
    for (const [key, value] of Object.entries(t)) {
      assert(typeof value !== 'number' || (Number.isFinite(value) && value >= 0), `Invalid numeric attribute ${key}`);
      assert(!Array.isArray(value) || value.length > 0, `Empty attribute ${key}`);
    }
    const b = a.pc_builder;
    const expectedBuilder = builderCategories[p.category_slug];
    assert.equal(b?.category, expectedBuilder, 'Inconsistent PC builder category');
    if (b) {
      assert(Object.values(b).every(v => typeof v !== 'number' || positive(v)), 'Invalid builder number');
      if (b.category === 'cpu') { assert.equal(b.socket, t.socket); assert.deepEqual(b.memory_generations, [t.memory_generation]); assert.equal(b.integrated_graphics, t.integrated_graphics); }
      if (b.category === 'motherboard') { assert.equal(b.socket, t.socket); assert.equal(b.memory_generation, t.memory_generation); assert.equal(b.form_factor, t.form_factor); assert.equal(b.max_memory_gb, t.max_memory_gb); }
      if (b.category === 'memory') { assert.equal(b.capacity_gb, t.memory_gb); assert.equal(b.generation, t.memory_generation); assert.equal(b.kit_modules, t.kit_modules); assert.equal(b.speed_mt_per_s, t.memory_speed_mt_s); }
      if (b.category === 'gpu') assert.equal(b.length_mm, t.gpu_length_mm);
      if (b.category === 'case') { assert.deepEqual(b.supported_form_factors, t.supported_form_factors); assert.equal(b.max_gpu_length_mm, t.max_gpu_length_mm); }
      if (b.category === 'psu') { assert.equal(b.capacity_w, t.power_supply_w); assert(['80+ Bronze','80+ Gold','80+ Platinum'].includes(b.efficiency_label)); }
      if (b.category === 'cooler') assert.deepEqual(b.supported_sockets, t.supported_sockets);
      if (b.category === 'storage') { assert.equal(b.capacity_tb * 1000, t.storage_gb); assert(['NVMe PCIe 4.0','NVMe PCIe 5.0'].includes(b.interface)); }
      if (b.category !== 'psu') assert.equal(b.estimated_power_w, t.power_w);
    }
  }
  return { newProducts: data.products.length, categories: data.categories.length, newBrands: new Set(data.products.map(p => p.brand)).size, soldOut: data.products.filter(p => p.stock === 0).length, lowStock: data.products.filter(p => p.stock > 0 && p.stock <= 3).length };
}

if (process.argv[1]?.endsWith('validate.mjs')) console.log(validateDataset(buildDataset()));
