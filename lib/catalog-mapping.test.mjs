import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const mappingSource = await readFile(new URL("./catalog-mapping.ts", import.meta.url), "utf8");
const mappingJavascript = ts.transpileModule(mappingSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const mappingModule = await import(`data:text/javascript;base64,${Buffer.from(mappingJavascript).toString("base64")}`);
const { catalogDataFromSupabase, mapCatalogRows } = mappingModule;

const publishedProduct = (id, sku, isPublished = true) => ({
  id,
  slug: id,
  sku,
  name: id,
  brand: "NODRIA",
  summary: `${id} summary`,
  description: `${id} description`,
  image_url: null,
  image_alt: "",
  badge: null,
  rating_average: "4.8",
  rating_count: 12,
  is_featured: false,
  is_published: isPublished,
});

const makeRows = () => ({
  products: [
    publishedProduct("pr_fluxbook14", "NOD-FB14-PRO"),
    publishedProduct("pr_foundry_s", "NOD-FS-02"),
    publishedProduct("pr_loom27", "NOD-LM27-4K"),
    publishedProduct("pr_unpublished", "NOD-HIDDEN", false),
    publishedProduct("pr_arcssd", "NOD-ARC-2T"),
  ],
  categories: [
    { id: "cat-computers", slug: "ordenadores", name: "Ordenadores", description: "Equipos", sort_order: 10, is_active: true },
    { id: "cat-monitors", slug: "monitores", name: "Monitores", description: "Pantallas", sort_order: 20, is_active: false },
  ],
  productCategories: [
    { product_id: "pr_fluxbook14", category_id: "cat-computers" },
    { product_id: "pr_foundry_s", category_id: "cat-computers" },
    { product_id: "pr_loom27", category_id: "cat-monitors" },
    { product_id: "pr_unpublished", category_id: "cat-computers" },
    { product_id: "pr_arcssd", category_id: "cat-computers" },
  ],
  variants: [
    { id: "v-flux", product_id: "pr_fluxbook14", sku: "NOD-FB14-PRO", title: "32 GB · 1 TB", current_price: "1499.00", compare_at_price: "1699.00", currency: "EUR", is_active: true },
    { id: "v-flux-disabled", product_id: "pr_fluxbook14", sku: "NOD-FB14-PRO", title: "Antigua", current_price: "1.00", compare_at_price: null, currency: "EUR", is_active: false },
    { id: "v-foundry-disabled", product_id: "pr_foundry_s", sku: "NOD-FS-02", title: "Antigua", current_price: "2499.00", compare_at_price: null, currency: "EUR", is_active: false },
    { id: "v-loom", product_id: "pr_loom27", sku: "NOD-LM27-4K", title: "144 Hz", current_price: "629.00", compare_at_price: null, currency: "EUR", is_active: true },
    { id: "v-hidden", product_id: "pr_unpublished", sku: "NOD-HIDDEN", title: "Oculta", current_price: "99.00", compare_at_price: null, currency: "EUR", is_active: true },
    { id: "v-usd", product_id: "pr_fluxbook14", sku: "NOD-FB14-USD", title: "USD", current_price: "1.00", compare_at_price: null, currency: "USD", is_active: true },
  ],
  specifications: [
    { product_id: "pr_fluxbook14", label: "Pantalla", value: "14 pulgadas", sort_order: 20 },
    { product_id: "pr_fluxbook14", label: "Procesador", value: "NODRIA Core 9", sort_order: 10 },
  ],
});

test("maps only published products with an active category and active EUR variant", () => {
  const result = mapCatalogRows(makeRows());

  assert.deepEqual(result.products.map((product) => product.id), ["pr_fluxbook14"]);
  assert.equal(result.products[0].sku, "NOD-FB14-PRO");
  assert.equal(result.products[0].price, 1499);
  assert.equal(result.products[0].previousPrice, 1699);
  assert.equal(result.products[0].stock, 0, "the mapper must not infer public stock from protected inventory");
  assert.deepEqual(result.products[0].specifications.map(({ label }) => label), ["Procesador", "Pantalla"]);
  assert.equal(result.categories[0].slug, "ordenadores");
});

test("does not replace a failed connected read with demo fixtures", async () => {
  const result = await catalogDataFromSupabase(async () => {
    throw new Error("PostgREST unavailable");
  });

  assert.equal(result.source, "error");
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.categories, []);
  assert.match(result.message, /No se pudo cargar/);
});
