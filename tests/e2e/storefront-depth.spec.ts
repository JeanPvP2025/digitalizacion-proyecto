import { expect, test } from "@playwright/test";
import referenceCatalog from "../../lib/catalog-data/verified-reference-products.json";

const reference = referenceCatalog.products[0]!;

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

test("editorial guides and articles lead to real product and category routes", async ({ page }) => {
  await page.goto("/guias");
  await expect(page.getByRole("heading", { name: "Una buena decisión empieza aquí." })).toBeVisible();
  await page.getByRole("link", { name: /Prepara tu configuración de PC/ }).click();
  await expect(page).toHaveURL(/\/guias\/preparar-configuracion-pc$/);
  await expect(page.getByRole("heading", { name: "Prepara tu configuración de PC antes de añadir piezas." })).toBeVisible();
  await expect(page.getByRole("link", { name: reference.name }).first()).toHaveAttribute("href", `/producto/${reference.slug}`);
  await expect(page.locator("main article").getByRole("link", { name: "Componentes" })).toHaveAttribute("href", /\/catalogo\?categoria=componentes/);

  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "Ideas para decidir mejor." })).toBeVisible();
  await expect(page.getByRole("link", { name: /portátil o sobremesa/i })).toHaveAttribute("href", /\/blog\//);
});

test("editorial and product detail pages remain usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guias/preparar-configuracion-pc");
  await expect(page.getByRole("heading", { name: "Prepara tu configuración de PC antes de añadir piezas." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto(`/producto/${reference.slug}`);
  await expect(page.getByRole("heading", { name: `${reference.name}.` })).toBeVisible();
  await expect(page.getByRole("link", { name: /Prepara tu configuración de PC antes de añadir piezas/ })).toHaveAttribute("href", "/guias/preparar-configuracion-pc");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
