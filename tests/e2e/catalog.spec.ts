import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

test("search and category filters narrow catalog results", async ({ page }) => {
  await page.goto("/catalogo?q=nvme&categoria=almacenamiento");

  await expect(page.getByText("1 resultado", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Arc SSD 2 TB" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "FluxBook 14 Pro" })).toHaveCount(0);
});

test("favorites and compare resolve only products from the active demo catalogue", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nodria.favorites.v1", JSON.stringify(["pr_loom27"]));
    localStorage.setItem("nodria.compare.v1", JSON.stringify(["pr_loom27"]));
  });

  await page.goto("/favoritos");
  await expect(page.getByRole("heading", { name: "Loom 27 4K" })).toBeVisible();
  await expect(page.getByText("datos de demostración local", { exact: false }).first()).toBeVisible();

  await page.goto("/comparar");
  await expect(page.getByRole("region", { name: "Tabla comparativa de productos" })).toBeVisible();
  await page.getByRole("button", { name: "+ FluxBook 14 Pro" }).click();
  await expect(page.getByRole("link", { name: /FluxBook 14 Pro/ })).toBeVisible();
  await expect(page.getByText("DEMO", { exact: false }).first()).toBeVisible();
});

test("PDP opens the honest read-only opinions route in demo mode", async ({ page }) => {
  await page.goto("/producto/loom-27-4k");

  await expect(page.getByRole("link", { name: "Leer opiniones y opinar" })).toHaveAttribute(
    "href",
    "/producto/loom-27-4k/opiniones",
  );
  await expect(page.getByText("Elena V.")).toHaveCount(0);
  await expect(page.getByText("5/5")).toHaveCount(0);
  await expect(page.getByLabel(/Valoración de ejemplo/)).toHaveCount(0);

  const opinionsLink = page.getByRole("link", { name: "Leer opiniones y opinar" });
  await expect(opinionsLink).toBeVisible();
  await page.waitForLoadState("networkidle");
  await opinionsLink.click();
  await expect(page).toHaveURL(/\/producto\/loom-27-4k\/opiniones$/);
  await expect(page.getByRole("heading", { name: "Opiniones de Loom 27 4K" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "La demo no guarda opiniones" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar opinión" })).toHaveCount(0);
});

test("opinions route stays keyboard reachable and fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/producto/loom-27-4k/opiniones");

  await expect(page.getByRole("heading", { name: "Opiniones de Loom 27 4K" })).toBeVisible();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(390);

  const returnLink = page.getByRole("link", { name: "Volver al producto" });
  await returnLink.focus();
  await expect(returnLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/producto\/loom-27-4k$/);
});

test("catalog sorting orders products by server-rendered price", async ({ page }) => {
  await page.goto("/catalogo?orden=precio-asc");

  const productNames = await page.locator(".catalog-product-grid .product-card h3").allTextContents();
  expect(productNames.slice(0, 3)).toEqual([
    "Arc SSD 2 TB",
    "LinkMesh X7 Pro",
    "Slate Air 11",
  ]);
});

test("search API rejects malformed filters and returns a consistent empty result", async ({ page }) => {
  const emptyQuery = await page.request.get("/api/search?q=");
  const duplicateQuery = await page.request.get("/api/search?q=arc&q=loom");
  const invalidLimit = await page.request.get("/api/search?q=arc&limit=9");
  const noMatch = await page.request.get("/api/search?q=sin-coincidencias-qa");

  expect(emptyQuery.status()).toBe(400);
  expect(duplicateQuery.status()).toBe(400);
  expect(invalidLimit.status()).toBe(400);
  expect(noMatch.status()).toBe(200);
  await expect(noMatch.json()).resolves.toMatchObject({ total: 0, results: [] });
});

test("cart supports an empty state and quantity updates from browser storage", async ({ page }) => {
  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: "Empieza por algo que te inspire." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar tecnología" })).toHaveAttribute("href", "/catalogo");

  await page.addInitScript(() => {
    localStorage.setItem("nodria.cart.v1", JSON.stringify([{
      type: "product",
      id: "pr_loom27",
      slug: "loom-27-4k",
      name: "Loom 27 4K",
      price: 629,
      sku: "NOD-LM27-4K",
      quantity: 1,
    }]));
  });
  await page.goto("/carrito");
  await expect(page.getByRole("heading", { name: "Loom 27 4K" })).toBeVisible();
  await page.getByRole("button", { name: "Aumentar cantidad" }).click();
  await expect(page.getByLabel("Cantidad de Loom 27 4K").getByText("2")).toBeVisible();
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("heading", { name: "Empieza por algo que te inspire." })).toBeVisible();
});

test("checkout discloses the local demo and never asks for card data", async ({ page }) => {
  await page.goto("/checkout");

  await expect(page.getByText("FINALIZAR PEDIDO · DEMO LOCAL")).toBeVisible();
  await expect(page.getByText("No se solicitarán datos de tarjeta.")).toBeVisible();
  await expect(page.locator('input[autocomplete="cc-number"], input[name*="card" i]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /confirmar compra demo/i })).toHaveCount(1);
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
  await expect(page.getByRole("heading", { name: "Portal de equipo desactivado." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /CRM de oportunidades/i })).toHaveCount(0);

  await page.goto("/backoffice/inventory");
  await expect(page.getByRole("heading", { name: "Portal de equipo desactivado." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Stock por almacén/i })).toHaveCount(0);
});
