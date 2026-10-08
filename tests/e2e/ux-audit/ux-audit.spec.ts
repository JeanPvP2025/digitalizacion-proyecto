import { expect, test } from "@playwright/test";

const primaryRoutes = [
  "/",
  "/catalogo",
  "/catalogo?q=nvme",
  "/categorias",
  "/categorias/ordenadores",
  "/marcas",
  "/marcas/nodria",
  "/campanas",
  "/campanas/puesto-de-trabajo",
  "/producto/fluxbook-14-pro",
  "/producto/fluxbook-14-pro/opiniones",
  "/carrito",
  "/checkout",
  "/acceso",
  "/mi-cuenta",
  "/favoritos",
  "/comparar",
  "/configurador",
  "/empresas",
  "/empresas/portal",
  "/envios",
  "/garantia",
  "/legal/privacidad",
  "/servicios",
  "/soporte",
  "/soporte/agente",
  "/backoffice",
  "/backoffice/crm",
  "/backoffice/inventory",
  "/backoffice/procurement",
  "/backoffice/returns",
  "/backoffice/reviews",
  "/backoffice/analytics",
];

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

test("primary flows render one main heading and named controls with working internal destinations", async ({ page }) => {
  test.setTimeout(180_000);
  const destinations = new Set<string>();
  const desktopOverflow: string[] = [];

  for (const route of primaryRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${route}`).toBeLessThan(400);
    await expect(page.locator("main h1:visible"), `main heading for ${route}`).toHaveCount(1);

    const audit = await page.evaluate(() => {
      const isVisible = (element: Element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const controls = Array.from(document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]',
      )).filter(isVisible);
      const missingNames = controls
        .filter((element) => {
          const labelledBy = element.getAttribute("aria-labelledby");
          const labelledByText = labelledBy?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
          const labelText = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
            ? Array.from(element.labels ?? []).map((label) => label.textContent ?? "").join(" ")
            : "";
          const imageAlternative = element.querySelector<HTMLImageElement>("img[alt]")?.alt ?? "";
          return ![
            element.getAttribute("aria-label"),
            labelledByText,
            labelText,
            imageAlternative,
            element.getAttribute("title"),
            element.textContent,
          ].some((value) => value?.trim());
        })
        .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`);
      const invalidLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .filter(isVisible)
        .filter((anchor) => {
          const href = anchor.getAttribute("href")?.trim() ?? "";
          return !href || href === "#" || href.toLowerCase().startsWith("javascript:");
        })
        .map((anchor) => anchor.textContent?.trim() || anchor.getAttribute("aria-label") || "(sin nombre)");
      const internalDestinations = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .filter(isVisible)
        .map((anchor) => {
          try {
            const url = new URL(anchor.href, location.href);
            return url.origin === location.origin ? `${url.pathname}${url.search}` : null;
          } catch {
            return null;
          }
        })
        .filter((destination): destination is string => destination !== null);
      const headingLevels = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"))
        .filter(isVisible)
        .map((heading) => Number(heading.tagName.slice(1)));
      const headingSkips = headingLevels.slice(1).flatMap((level, index) =>
        level > headingLevels[index] + 1 ? [`h${headingLevels[index]} → h${level}`] : [],
      );
      const dimensions = {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      };

      return { missingNames, invalidLinks, internalDestinations, headingSkips, dimensions };
    });

    expect(audit.missingNames, `unnamed controls for ${route}`).toEqual([]);
    expect(audit.invalidLinks, `invalid anchors for ${route}`).toEqual([]);
    expect(audit.headingSkips, `heading level skips for ${route}`).toEqual([]);
    if (audit.dimensions.documentWidth > audit.dimensions.viewportWidth) {
      desktopOverflow.push(`${route}: document ${audit.dimensions.documentWidth}px > viewport ${audit.dimensions.viewportWidth}px`);
    }
    for (const destination of audit.internalDestinations) destinations.add(destination);
  }

  const brokenDestinations: string[] = [];
  for (const destination of destinations) {
    const response = await page.request.get(destination);
    if (response.status() >= 400) brokenDestinations.push(`${destination} → ${response.status()}`);
  }
  expect(brokenDestinations, "internal destinations discovered across primary routes").toEqual([]);
  expect(desktopOverflow, "page-level horizontal overflow at desktop width").toEqual([]);
});

test("skip link, search shortcut, and suggestions work with the keyboard", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.locator(".skip-link");
  await expect(skipLink).toBeFocused();
  const focusStyle = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeFocused();

  await page.keyboard.press("Control+k");
  const search = page.locator('.header-search input[type="search"]');
  await expect(search).toBeFocused();
  const searchResponse = await page.request.get("/api/search?q=Flux");
  expect(searchResponse.status()).toBe(200);
  await search.fill("Flux");
  const option = page.getByRole("option", { name: /FluxBook 14 Pro/i });
  await expect(option).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", /.+/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/producto\/fluxbook-14-pro$/);
  await expect(page.getByRole("heading", { name: "FluxBook 14 Pro" })).toBeVisible();
});

test("B2B field errors are announced, associated, and focus the first invalid field without submitting", async ({ page }) => {
  let quoteRequests = 0;
  await page.route("**/api/quotes", (route) => {
    quoteRequests += 1;
    return route.abort();
  });
  await page.goto("/empresas#solicitar", { waitUntil: "domcontentloaded" });
  await page.locator("#quote-company").fill("  ");
  await page.locator("#quote-contact").fill("QA Test");
  await page.locator("#quote-email").fill("qa@example.test");
  await page.locator("#quote-volume").selectOption({ label: "1–5 equipos" });
  await page.locator("#quote-message").fill("                         ");
  await page.locator("#quote-privacy").check();
  await page.getByRole("button", { name: "Enviar solicitud" }).click();

  const errorSummary = page.locator("#quote-error");
  await expect(errorSummary).toHaveAttribute("role", "alert");
  await expect(errorSummary).toContainText("Corrige los campos indicados antes de enviar la solicitud.");
  await expect(page.locator("#quote-company")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#quote-message")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#quote-company")).toHaveAttribute("aria-describedby", "quote-company-error");
  await expect(page.locator("#quote-message")).toHaveAttribute("aria-describedby", /quote-message-error/);
  await expect(page.locator("#quote-company")).toBeFocused();
  expect(quoteRequests, "invalid form must not reach quote intake").toBe(0);
});

test("B2B landing and portal apply their CSS-module root classes", async ({ page }) => {
  const missingRootClasses: string[] = [];
  for (const route of ["/empresas", "/empresas/portal"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const rootClass = await page.locator("main").getAttribute("class");
    if (!rootClass) missingRootClasses.push(`${route}: no root class on main`);
  }
  expect(missingRootClasses, "B2B CSS-module roots missing in the rendered DOM").toEqual([]);
});

test("empty checkout disables the demo purchase action", async ({ page }) => {
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /confirmar compra demo/i })).toBeDisabled();
});

test("footer back-to-top affordance is keyboard operable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const affordance = page.locator("footer .back-top");
  await expect(affordance).toBeVisible();
  const interactive = await affordance.evaluate((element) =>
    element.matches("a, button, [role='button'], [tabindex]:not([tabindex='-1'])"),
  );
  expect(interactive).toBe(true);
});

test("primary routes fit mobile and tablet viewports", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const overflow: string[] = [];

  for (const viewport of [
    { label: "mobile", width: 390, height: 844 },
    { label: "tablet", width: 768, height: 1024 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of primaryRoutes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `HTTP status for ${viewport.label} ${route}`).toBeLessThan(400);
      await expect(page.locator("main h1:visible"), `${viewport.label} main heading for ${route}`).toHaveCount(1);
      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      if (dimensions.documentWidth > dimensions.viewportWidth) {
        overflow.push(`${viewport.label} ${route}: document ${dimensions.documentWidth}px > viewport ${dimensions.viewportWidth}px`);
      }

      if (viewport.label === "mobile" && route === "/") {
        await page.screenshot({ path: testInfo.outputPath("home-mobile.png") });
      }
      if (viewport.label === "mobile" && route === "/empresas") {
        await page.screenshot({ path: testInfo.outputPath("business-mobile.png"), fullPage: true });
      }
    }
  }

  expect(overflow, "page-level horizontal overflow at mobile and tablet widths").toEqual([]);
});
