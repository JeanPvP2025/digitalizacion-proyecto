import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../../lib/catalog-data/verified-reference-products.json', import.meta.url), 'utf8'));
const nextConfig = await readFile(new URL('../../next.config.ts', import.meta.url), 'utf8');

test('all catalog products are real, dated references with source model numbers and prices', () => {
  assert.equal(catalog.products.length, 64);
  assert.equal(catalog.checkedAt, '2026-10-13');
  assert.equal(catalog.source, 'PcComponentes España');
  for (const product of catalog.products) {
    assert.ok(product.name.length > 2);
    assert.ok(product.brand.length > 0);
    assert.ok(product.modelNumber.length > 0);
    assert.ok(Number.isFinite(product.priceEur) && product.priceEur > 0);
    assert.equal(product.checkedAt, catalog.checkedAt);
    assert.equal(product.source, 'PcComponentes');
    assert.equal(product.seller, 'PcComponentes');
    assert.match(product.productUrl, /^https:\/\/www\.pccomponentes\.com\//);
    assert.ok(product.specifications.length > 0);
  }
});

test('every model has its own exact retailer photograph and accessible alt text', () => {
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
