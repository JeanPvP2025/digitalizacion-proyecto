import { expect, test } from "@playwright/test";
import referenceCatalog from "../../lib/catalog-data/verified-reference-products.json";

const reference = referenceCatalog.products[0]!;
const cheapestReferences = [...referenceCatalog.products].sort((a, b) => a.priceEur - b.priceEur).slice(0, 3);

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

test("catalog search shows the exact model, observed price, and its real product photo", async ({ page }) => {
  await page.goto(`/catalogo?q=${encodeURIComponent(reference.modelNumber)}`);

  await expect(page.getByRole("heading", { name: reference.name })).toBeVisible();
  await expect(page.getByText("Precio de referencia · PcComponentes", { exact: false }).first()).toBeVisible();
  const image = page.locator(`img[alt="${reference.imageAlt}"]`).first();
  await expect(image).toBeVisible();
  const imageSrc = await image.getAttribute("src");
  expect(imageSrc).toBeTruthy();
  const optimizedImage = new URL(imageSrc!, page.url());
  expect(optimizedImage.pathname).toBe("/_next/image");
  expect(optimizedImage.searchParams.get("url")).toBe(reference.imageUrl);
  await expect(page.getByRole("link", { name: /ver en pccomponentes/i }).first()).toHaveAttribute("href", reference.productUrl);
  await expect(page.getByText("Disponibilidad comercial no conectada").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /añadir al carrito/i })).toHaveCount(0);
});

test("favorites and comparison use real catalog records", async ({ page }) => {
  await page.addInitScript((productId) => {
    localStorage.setItem("nodria.favorites.v1", JSON.stringify([productId]));
    localStorage.setItem("nodria.compare.v1", JSON.stringify([productId]));
  }, reference.id);

  await page.goto("/favoritos");
  await expect(page.getByRole("heading", { name: reference.name })).toBeVisible();
  await expect(page.getByRole("link", { name: /ver en pccomponentes/i }).first()).toHaveAttribute("href", reference.productUrl);

  await page.goto("/comparar");
  await expect(page.getByRole("region", { name: "Tabla comparativa de productos" })).toBeVisible();
  await expect(page.getByText(reference.name, { exact: false }).first()).toBeVisible();
});

test("product page links out to the seller and does not invent reviews or stock", async ({ page }) => {
  await page.goto(`/producto/${reference.slug}`);

  await expect(page.getByRole("heading", { name: `${reference.name}.` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Consultar ficha del vendedor" })).toHaveAttribute("href", reference.productUrl);
  await expect(page.getByText("NODRIA no vende este artículo ni mantiene inventario comercial.")).toBeVisible();
  await expect(page.getByText("Las opiniones de la tienda externa no se importan a NODRIA.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Leer opiniones y opinar" })).toHaveCount(0);
  await expect(page.locator(".detail-rating")).not.toContainText(/\b\d+(?:[.,]\d+)?\s*\/\s*5\b/);

  await page.goto(`/producto/${reference.slug}/opiniones`);
  await expect(page).toHaveURL(new RegExp(`/producto/${reference.slug}/opiniones$`));
  await expect(page.getByRole("heading", { name: `Opiniones de ${reference.name}.` })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "El modo de demostración no guarda opiniones" })).toBeVisible();
});

test("catalog price sorting follows the real source snapshots", async ({ page }) => {
  await page.goto("/catalogo?orden=precio-asc");

  const productNames = await page.locator(".catalog-product-grid .product-card h3").allTextContents();
  expect(productNames.slice(0, 3)).toEqual(cheapestReferences.map((product) => product.name));
});

test("search API rejects malformed filters and returns an empty result consistently", async ({ page }) => {
  const emptyQuery = await page.request.get("/api/search?q=");
  const duplicateQuery = await page.request.get("/api/search?q=cpu&q=ssd");
  const invalidLimit = await page.request.get("/api/search?q=cpu&limit=9");
  const noMatch = await page.request.get("/api/search?q=sin-coincidencias-qa");

  expect(emptyQuery.status()).toBe(400);
  expect(duplicateQuery.status()).toBe(400);
  expect(invalidLimit.status()).toBe(400);
  expect(noMatch.status()).toBe(200);
  await expect(noMatch.json()).resolves.toMatchObject({ total: 0, results: [] });
});

test("NODRIA cart and checkout do not pretend to sell external retailer references", async ({ page }) => {
  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: "Empieza por algo que te inspire." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar tecnología" })).toHaveAttribute("href", "/catalogo");

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "NODRIA no realiza ventas." })).toBeVisible();
  await expect(page.getByText(/No se procesa ningún pago ni se crea un pedido en NODRIA/)).toBeVisible();
  await expect(page.getByRole("button", { name: /confirmar compra|simular resultado de pago/i })).toHaveCount(0);
  await expect(page.locator('input[autocomplete="cc-number"], input[name*="card" i]')).toHaveCount(0);
});

test("B2B and support forms expose required fields before any submission", async ({ page }) => {
  await page.goto("/empresas#solicitar");
  await expect(page.getByRole("heading", { name: "Cuéntanos qué necesita tu equipo." })).toBeVisible();
  const quoteFormValid = await page.locator("#quote-company").locator("xpath=ancestor::form")
    .evaluate((form) => (form as HTMLFormElement).checkValidity());
  expect(quoteFormValid).toBe(false);
  await expect(page.locator("#quote-company")).toHaveJSProperty("required", true);
  await expect(page.locator("#quote-volume")).toHaveJSProperty("required", true);

  await page.goto("/soporte");
  const supportFormValid = await page.locator("#support-message").locator("xpath=ancestor::form")
    .evaluate((form) => (form as HTMLFormElement).checkValidity());
  expect(supportFormValid).toBe(false);
  await expect(page.locator("#support-message")).toHaveJSProperty("required", true);
  await expect(page.locator('input[name="privacyAccepted"]')).toHaveJSProperty("required", true);
});

test("backoffice route guard prevents demo users from seeing CRM and inventory data", async ({ page }) => {
  await page.goto("/backoffice/crm");
  await expect(page.getByRole("heading", { name: "Portal de equipo no disponible." })).toBeVisible();
  await expect(page.getByText("No se muestra información operativa.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /CRM de oportunidades/i })).toHaveCount(0);

  await page.goto("/backoffice/inventory");
  await expect(page.getByRole("heading", { name: "Portal de equipo no disponible." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Stock por almacén/i })).toHaveCount(0);
});
