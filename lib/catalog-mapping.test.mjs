import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const mappingSource = await readFile(new URL("./catalog-mapping.ts", import.meta.url), "utf8");
const mappingJavascript = ts.transpileModule(mappingSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const mappingModule = await import(`data:text/javascript;base64,${Buffer.from(mappingJavascript).toString("base64")}`);
const { catalogDataFromSupabase, mapCatalogRows } = mappingModule;
const redirectsSource = await readFile(new URL("./supabase/redirects.ts", import.meta.url), "utf8");
const redirectsJavascript = ts.transpileModule(redirectsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const redirectsModule = await import(`data:text/javascript;base64,${Buffer.from(redirectsJavascript).toString("base64")}`);
const { getRoleLandingPath } = redirectsModule;

const publishedProduct = (id, sku, isPublished = true) => ({
  id,
  slug: id,
  sku,
  name: id,
  brand: "NODRIA",
  summary: `${id} summary`,
  description: `${id} description`,
  image_url: `https://thumb.pccomponentes.com/w-530-530/articles/${id}.jpg`,
  image_alt: `Fotografía del modelo exacto ${id}`,
  badge: null,
    rating_average: "0",
    rating_count: 0,
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
    { id: "v-flux", product_id: "pr_fluxbook14", sku: "NOD-FB14-PRO", title: "Estándar", current_price: "1499.00", compare_at_price: "1699.00", currency: "EUR", is_active: true, attributes: { nodria_store: { mode: "academic_demo", model_number: "MPN-pr_fluxbook14" } } },
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
  availability: [{ variant_id: "v-flux", available_quantity: 8 }],
  publishedReviews: [{ product_id: "pr_fluxbook14", average_rating: "4.5", review_count: 2 }],
});

test("maps only published NODRIA products with exact model photos and live aggregates", () => {
  const result = mapCatalogRows(makeRows());

  assert.deepEqual(result.products.map((product) => product.id), ["pr_fluxbook14"]);
  assert.equal(result.products[0].sku, "NOD-FB14-PRO");
  assert.equal(result.products[0].price, 1499);
  assert.equal(result.products[0].modelNumber, "MPN-pr_fluxbook14");
  assert.equal(result.products[0].stock, 8);
  assert.equal(result.products[0].rating, 4.5);
  assert.equal(result.products[0].reviewCount, 2);
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

test("fails closed when a product image is duplicated instead of substituting a generic image", () => {
  const rows = makeRows();
  const repeatedPhoto = "https://thumb.pccomponentes.com/w-530-530/articles/repeated.jpg";
  rows.products[0].image_url = repeatedPhoto;
  rows.products[1].image_url = repeatedPhoto;
  rows.variants[0].attributes.nodria_store.model_number = "MPN-pr_fluxbook14";
  rows.categories.push({ id: "cat-laptops", slug: "portatiles", name: "Ordenadores", description: "Portátiles", sort_order: 11, parent_id: "cat-computers", is_active: true });
  rows.productCategories.push(
    { product_id: "pr_fluxbook14", category_id: "cat-laptops" },
    { product_id: "pr_foundry_s", category_id: "cat-laptops" },
  );
  rows.variants.push({ id: "v-foundry", product_id: "pr_foundry_s", sku: "NOD-FS-02", title: "Equipo", current_price: "2499.00", compare_at_price: null, currency: "EUR", is_active: true, attributes: { nodria_store: { mode: "academic_demo", model_number: "MPN-pr_foundry_s" } } });
  rows.availability?.push({ variant_id: "v-foundry", available_quantity: 12 });

  const result = mapCatalogRows(rows);

  assert.equal(result.products.length, 1, "duplicate exact-model photography is not reused");
  assert.equal(result.products[0].image, repeatedPhoto);
  assert(!result.products.some((product) => product.id === "pr_foundry_s"));
});

test("rejects generic photos and variants that are not marked for NODRIA's store", () => {
  const rows = makeRows();
  rows.products[0].image_url = "https://images.unsplash.com/generic-category.jpg";
  rows.products[1].image_url = null;
  rows.products[2].image_url = "https://thumb.pccomponentes.com/w-530-530/articles/real-model.jpg";
  rows.variants.push({
    id: "v-foundry-real-photo", product_id: "pr_foundry_s", sku: "NOD-FS-02", title: "Equipo",
    current_price: "2499.00", compare_at_price: null, currency: "EUR", is_active: true,
    attributes: { nodria_store: { mode: "not-a-store", model_number: "MPN-pr_foundry_s" } },
  });

  assert.deepEqual(mapCatalogRows(rows).products, []);
});

test("chooses a role-appropriate landing page after the default sign-in", () => {
  assert.equal(getRoleLandingPath(["super_admin"]), "/backoffice");
  assert.equal(getRoleLandingPath(["sales_manager"]), "/backoffice/crm");
  assert.equal(getRoleLandingPath(["catalog_manager"]), "/backoffice/catalog");
  assert.equal(getRoleLandingPath(["support_agent"]), "/soporte/agente");
  assert.equal(getRoleLandingPath(["buyer"]), "/mi-cuenta");
  assert.equal(getRoleLandingPath(["sales_manager", "super_admin"]), "/backoffice", "the highest-level landing takes precedence");
});
