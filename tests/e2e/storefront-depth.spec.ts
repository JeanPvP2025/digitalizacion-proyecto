import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

test("editorial guides and articles lead to real product and category routes", async ({ page }) => {
  await page.goto("/guias");
  await expect(page.getByRole("heading", { name: "Una buena decisión empieza aquí." })).toBeVisible();
  await page.getByRole("link", { name: /Cómo elegir un portátil/ }).click();
  await expect(page).toHaveURL(/\/guias\/elegir-portatil-trabajo-estudio$/);
  await expect(page.getByRole("heading", { name: "Cómo elegir un portátil para trabajar y estudiar." })).toBeVisible();
  await expect(page.getByRole("link", { name: "FluxBook 14 Pro" })).toHaveAttribute("href", "/producto/fluxbook-14-pro");

  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "Ideas para decidir mejor." })).toBeVisible();
  await expect(page.getByRole("link", { name: /portátil o sobremesa/i })).toHaveAttribute("href", /\/blog\//);
});

test("editorial and product detail pages remain usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guias/elegir-portatil-trabajo-estudio");
  await expect(page.getByRole("heading", { name: "Cómo elegir un portátil para trabajar y estudiar." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto("/producto/fluxbook-14-pro");
  await expect(page.getByRole("heading", { name: "FluxBook 14 Pro." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cómo elegir un portátil para trabajar y estudiar/ })).toHaveAttribute("href", "/guias/elegir-portatil-trabajo-estudio");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
