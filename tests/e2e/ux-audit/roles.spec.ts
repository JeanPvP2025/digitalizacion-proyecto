import { expect, test, type Page } from "@playwright/test";

type RoleAccount = { role: string; email: string; password: string };
const accounts = JSON.parse(process.env.UX_ROLE_ACCOUNTS ?? "[]") as RoleAccount[];
const accountFor = (role: string) => {
  const account = accounts.find((candidate) => candidate.role === role);
  if (!account) throw new Error(`Missing isolated local account fixture for ${role}.`);
  return account;
};

async function signIn(page: Page, account: RoleAccount) {
  await page.goto("/acceso?next=%2Fbackoffice");
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Entrar en mi espacio" }).click();
  await page.waitForURL("**/backoffice");
  await expect(page.locator("main h1:visible")).toHaveCount(1);
}

async function signOut(page: Page) {
  await page.context().clearCookies();
  await page.goto("/");
}

async function visitHeading(page: Page, route: string, title: RegExp) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status(), `HTTP ${route}`).toBeLessThan(400);
  await expect(page.locator("main h1:visible"), `heading for ${route}`).toHaveCount(1);
  await expect(page.locator("main h1:visible")).toContainText(title);
}

async function inspectResponsivePage(page: Page, route: string, role: string, testInfo: { outputPath: (path: string) => string }) {
  const widths = [
    { width: 1280, height: 720, suffix: "desktop" },
    { width: 390, height: 844, suffix: "mobile" },
    { width: 768, height: 1024, suffix: "tablet" },
  ];
  const routeName = route.replaceAll("/", "-").replace(/^-/, "operations");

  for (const viewport of widths) {
    await page.setViewportSize(viewport);
    const audit = await page.evaluate(() => {
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const unnamed = Array.from(document.querySelectorAll<HTMLElement>("main a[href], main button, main input:not([type=hidden]), main select, main textarea, main [role=button]"))
        .filter(visible)
        .filter((element) => {
          const labelText = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
            ? Array.from(element.labels ?? []).map((label) => label.textContent ?? "").join(" ")
            : "";
          const labelledBy = element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ") ?? "";
          const imageAlt = element.querySelector<HTMLImageElement>("img[alt]")?.alt ?? "";
          return ![element.getAttribute("aria-label"), labelledBy, labelText, imageAlt, element.getAttribute("title"), element.textContent]
            .some((value) => value?.trim());
        })
        .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`);
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        unnamed,
      };
    });
    expect(audit.documentWidth, `${role} ${route} at ${viewport.width}px`).toBeLessThanOrEqual(audit.viewportWidth);
    expect(audit.unnamed, `${role} ${route} unnamed controls at ${viewport.width}px`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${role}-${routeName}-${viewport.suffix}.png`), fullPage: true });
  }
}

test("staff roles see only their authorized workspace states; superadmin views stay responsive", async ({ page }, testInfo) => {
  test.setTimeout(240_000);

  await page.goto("/backoffice", { waitUntil: "networkidle" });
  await page.waitForURL("**/acceso?next=%2Fbackoffice");
  await expect(page.locator("main h1:visible")).toContainText("Qué bueno verte");

  await signIn(page, accountFor("support_agent"));
  await visitHeading(page, "/soporte/agente", /Bandeja de soporte/);
  await inspectResponsivePage(page, "/soporte/agente", "support-agent", testInfo);
  await visitHeading(page, "/backoffice", /No tienes acceso al portal de equipo/);
  await inspectResponsivePage(page, "/backoffice", "support-agent-denied", testInfo);

  await signOut(page);
  await signIn(page, accountFor("sales_manager"));
  await visitHeading(page, "/backoffice/crm", /Personas y oportunidades/);
  await inspectResponsivePage(page, "/backoffice/crm", "sales-manager", testInfo);
  await visitHeading(page, "/backoffice", /Acceso restringido/);
  await inspectResponsivePage(page, "/backoffice", "sales-manager-operations-denied", testInfo);
  await visitHeading(page, "/backoffice/inventory", /Stock por almacén/);
  await expect(page.getByRole("status")).toContainText("fulfillment_manager ni super_admin");
  await inspectResponsivePage(page, "/backoffice/inventory", "sales-manager-inventory-denied", testInfo);
  await visitHeading(page, "/backoffice/reviews", /Acceso restringido/);
  await expect(page.getByRole("link", { name: "Volver a operaciones" })).toHaveAttribute("href", "/backoffice");
  await inspectResponsivePage(page, "/backoffice/reviews", "sales-manager-reviews-denied", testInfo);

  await signOut(page);
  await signIn(page, accountFor("fulfillment_manager"));
  await visitHeading(page, "/backoffice", /Centro operativo/);
  await inspectResponsivePage(page, "/backoffice", "fulfillment-manager", testInfo);
  for (const route of ["/backoffice/inventory", "/backoffice/procurement", "/backoffice/returns"]) {
    await visitHeading(page, route, route.endsWith("inventory") ? /Stock por almacén/ : route.endsWith("returns") ? /Inspección de almacén/ : /Proveedores y compras/);
    await inspectResponsivePage(page, route, "fulfillment-manager", testInfo);
  }
  await visitHeading(page, "/backoffice/crm", /Acceso restringido/);
  await inspectResponsivePage(page, "/backoffice/crm", "fulfillment-manager-crm-denied", testInfo);
  await expect(page.locator('main section[role="alert"]')).toContainText("sales_manager o super_admin");

  await signOut(page);
  await signIn(page, accountFor("catalog_manager"));
  await visitHeading(page, "/backoffice", /No tienes acceso al portal de equipo/);
  await inspectResponsivePage(page, "/backoffice", "catalog-manager-denied", testInfo);
  await page.screenshot({ path: testInfo.outputPath("catalog-manager-denied.png"), fullPage: true });

  await signOut(page);
  await signIn(page, accountFor("super_admin"));
  const routes = [
    "/backoffice",
    "/backoffice/crm",
    "/backoffice/inventory",
    "/backoffice/procurement",
    "/backoffice/returns",
    "/backoffice/analytics",
    "/backoffice/reviews",
  ];
  for (const route of routes) {
    await visitHeading(page, route, route === "/backoffice" ? /Centro operativo/ : /.*/);
    await inspectResponsivePage(page, route, "super-admin", testInfo);
  }
  await visitHeading(page, "/backoffice/reviews", /Moderación de opiniones/);
  const backToOperations = page.getByRole("link", { name: "Volver a operaciones" });
  await expect(backToOperations).toHaveAttribute("href", "/backoffice");
  await backToOperations.focus();
  await expect(backToOperations).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/backoffice");
  await expect(page.locator("main h1:visible")).toContainText("Centro operativo");
});
