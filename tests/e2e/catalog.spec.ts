import { expect, test } from "@playwright/test";
import { demoProducts } from "../../lib/catalog";

const product = demoProducts[0]!;
const cheapestProducts = [...demoProducts].sort((a, b) => a.price - b.price).slice(0, 3);

test("el catálogo presenta productos de NODRIA y ofrece una compra interna", async ({ page }) => {
  await page.goto(`/catalogo?q=${encodeURIComponent(product.modelNumber ?? product.sku)}`);

  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
  await expect(page.getByText(product.modelNumber!, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("NODRIA", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /añadir al carrito/i }).first()).toBeEnabled();
  await expect(page.locator('a[href^="http"]')).toHaveCount(0);
  await expect(page.getByText(/pccomponentes|vendedor externo|consultar precio/i)).toHaveCount(0);
});

test("la ficha del producto enlaza a reseñas internas y evita enlaces comerciales externos", async ({ page }) => {
  await page.goto(`/producto/${product.slug}`);

  await expect(page.getByRole("heading", { name: `${product.name}.` })).toBeVisible();
  await expect(page.getByRole("button", { name: /añadir al carrito/i })).toBeEnabled();
  const reviewsLink = page.getByRole("link", { name: "Ver opiniones", exact: true });
  await expect(reviewsLink).toHaveAttribute("href", `/producto/${product.slug}/opiniones`);
  await expect(page.locator('a[href^="http"]')).toHaveCount(0);

  await reviewsLink.click();
  await expect(page).toHaveURL(new RegExp(`/producto/${product.slug}/opiniones$`));
  await expect(page.getByText(/ejemplo de demostración.*no verificada/i).first()).toBeVisible();
});

test("añadir desde una ficha actualiza el carrito y conduce al checkout de NODRIA", async ({ page }) => {
  await page.goto(`/producto/${product.slug}`);
  await page.getByRole("button", { name: /añadir al carrito/i }).click();

  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
  await expect(page.getByText(/TU SELECCIÓN · 1 ARTÍCULOS/i)).toBeVisible();
  await page.getByRole("link", { name: /continuar|finalizar|tramitar/i }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByText("El pago de demostración NODRIA se aprobará automáticamente al confirmar el pedido.")).toBeVisible();
  await expect(page.locator('input[autocomplete="cc-number"], input[name*="card" i]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
});

test("checkout sin artículos muestra un regreso claro al catálogo", async ({ page }) => {
  await page.goto("/checkout");

  await expect(page.getByRole("heading", { name: "Tu carrito está vacío." })).toBeVisible();
  await expect(page.getByRole("link", { name: /volver al catálogo/i })).toHaveAttribute("href", "/catalogo");
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toHaveCount(0);
  await expect(page.getByLabel("Número de tarjeta")).toHaveCount(0);
});

test("el checkout demo confirma pedido sin cargo y sin datos bancarios", async ({ page }) => {
  await page.addInitScript(({ id, name, price, image, sku }) => {
    localStorage.setItem("nodria.cart.v2", JSON.stringify([{ id, slug: "fixture", name, price, image, sku, quantity: 1, type: "product" }]));
  }, { id: product.id, name: product.name, price: product.price, image: product.image, sku: product.sku });

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Un último paso." })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByRole("heading", { name: "Tu pedido está confirmado." })).toBeVisible();
  await expect(page.locator(".demo-payment-warning")).toContainText(/no se ha realizado ningún cargo/i);
  await expect(page.locator('input[autocomplete="cc-number"], input[name*="card" i]')).toHaveCount(0);
});

test("el orden por precio sigue el catálogo de NODRIA", async ({ page }) => {
  await page.goto("/catalogo?orden=precio-asc");
  const names = await page.locator(".catalog-product-grid .product-card h3").allTextContents();
  expect(names.slice(0, 3)).toEqual(cheapestProducts.map((item) => item.name));
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
