import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../../lib/catalog-data/verified-reference-products.json', import.meta.url), 'utf8'));
const nextConfig = await readFile(new URL('../../next.config.ts', import.meta.url), 'utf8');

test('all NODRIA catalog products use real models, model numbers, dated prices, and specifications', () => {
  assert.equal(catalog.products.length, 64);
  assert.equal(catalog.checkedAt, '2026-10-13');
  for (const product of catalog.products) {
    assert.ok(product.name.length > 2);
    assert.ok(product.brand.length > 0);
    assert.ok(product.modelNumber.length > 0);
    assert.ok(Number.isFinite(product.priceEur) && product.priceEur > 0);
    assert.equal(product.checkedAt, catalog.checkedAt);
    assert.equal('source' in product, false);
    assert.equal('seller' in product, false);
    assert.equal('productUrl' in product, false);
    assert.ok(product.specifications.length > 0);
  }
});

test('every product has its own exact model photograph and accessible alt text', () => {
  const images = new Set();
  for (const product of catalog.products) {
    const image = new URL(product.imageUrl);
    assert.equal(image.protocol, 'https:');
    assert.ok(['img.pccomponentes.com', 'thumb.pccomponentes.com'].includes(image.hostname));
    assert.match(image.pathname, /\/articles\//);
    assert.ok(product.imageAlt.trim().length > 1);
    assert.equal(images.has(product.imageUrl), false, `duplicate product photo for ${product.modelNumber}`);
    images.add(product.imageUrl);
  }
  assert.equal(images.size, 64);
  assert.match(nextConfig, /hostname: "thumb\.pccomponentes\.com", pathname: "\/w-\*\/articles\/\*\*"/);
});

test('PC builder options point at matching real products and are evenly covered by component class', () => {
  const counts = new Map();
  for (const product of catalog.products) {
    assert.equal(product.pcBuilder.category, product.category);
    assert.ok(product.pcBuilder.category);
    counts.set(product.pcBuilder.category, (counts.get(product.pcBuilder.category) ?? 0) + 1);
    assert.ok(product.pcBuilder);
  }
  assert.deepEqual([...counts.values()].sort((a, b) => a - b), Array(8).fill(8));
});
