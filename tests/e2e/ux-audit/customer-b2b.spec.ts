import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const apiURL = "http://127.0.0.1:56901";
const widths = [
  { width: 390, height: 844, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
] as const;
const roles = ["owner", "admin", "buyer", "viewer"] as const;
type MembershipRole = (typeof roles)[number];
type UserFixture = { email: string; id: string; role: string; password: string; client: SupabaseClient };
type Fixtures = { users: UserFixture[]; organizationId: string; otherOrganizationId: string; runId: string };

function checked<R extends { data: unknown; error: { message: string } | null }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("An isolated fixture operation returned no data.");
  return result.data as NonNullable<R["data"]>;
}

async function createFixtures(): Promise<Fixtures> {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publishableKey || !serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_URL !== apiURL) {
    throw new Error("Fixture provisioning requires keys from the isolated loopback Supabase project.");
  }
  const runId = randomUUID();
  const admin = createClient(apiURL, serviceRoleKey, { auth: { persistSession: false } });
  const users: UserFixture[] = [];
  const password = `Nodria-QA-${randomUUID()}!aA1`;

  for (const role of ["customer", ...roles, "outsider"] as const) {
    const email = `customer-b2b-${role}-${runId}@nodria.test`;
    const authUser = checked(await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `QA ${role} ${runId.slice(0, 6)}` },
    }));
    if (!authUser.user) throw new Error("Auth did not return the created fixture user.");
    const client = createClient(apiURL, publishableKey, { auth: { persistSession: false } });
    checked(await client.auth.signInWithPassword({ email, password }));
    users.push({ email, id: authUser.user.id, role, password, client });
  }

  const owner = users.find((user) => user.role === "owner")!;
  const outsider = users.find((user) => user.role === "outsider")!;
  const organizationId = checked(await owner.client.rpc("create_organization", {
    p_slug: `customer-b2b-${runId}`,
    p_legal_name: `NODRIA QA Empresa ${runId.slice(0, 6)} SL`,
    p_display_name: `QA Tenant Alfa ${runId.slice(0, 6)}`,
    p_tax_id: null,
    p_billing_email: owner.email,
  })) as string;
  for (const role of ["admin", "buyer", "viewer"] as const satisfies readonly MembershipRole[]) {
    const member = users.find((user) => user.role === role)!;
    checked(await owner.client.rpc("add_organization_member", {
      p_organization_id: organizationId,
      p_email: member.email,
      p_role: role,
    }));
  }
  const otherOrganizationId = checked(await outsider.client.rpc("create_organization", {
    p_slug: `customer-b2b-other-${runId}`,
    p_legal_name: `NODRIA QA Tenant Reservado ${runId.slice(0, 6)} SL`,
    p_display_name: `QA Tenant Beta ${runId.slice(0, 6)}`,
    p_tax_id: null,
    p_billing_email: outsider.email,
  })) as string;

  return { users, organizationId, otherOrganizationId, runId };
}

async function signIn(page: Page, user: UserFixture) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Entrar en mi espacio" }).click();
  await expect(page).toHaveURL(/\/mi-cuenta(?:\?|$)/);
  await expect(page.locator("main h1:visible")).toHaveCount(1);
}

async function inspectResponsive(page: Page, role: string, route: string, testInfo: { outputPath: (name: string) => string }) {
  for (const viewport of widths) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      main: document.querySelector("main")?.scrollWidth ?? 0,
      controls: Array.from(document.querySelectorAll<HTMLElement>("main a[href], main button, main input:not([type=hidden]), main select, main textarea"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .map((element) => `${element.tagName.toLowerCase()} ${element.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("name") || "control"}`),
    }));
    expect(dimensions.document, `${role} ${route} document overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.main, `${role} ${route} main overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.controls, `${role} ${route} controls beyond viewport at ${viewport.width}px`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${role}-${route}-${viewport.name}.png`), fullPage: true });
  }
}

test("customer account and B2B memberships show the right tenant, actions, links, and responsive layout", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  const fixtures = await createFixtures();
  const customer = fixtures.users.find((user) => user.role === "customer")!;
  const outsider = fixtures.users.find((user) => user.role === "outsider")!;
  const customerClient = customer.client;

  try {
    await page.goto("/mi-cuenta");
    await expect(page).toHaveURL(/\/acceso\?next=%2Fmi-cuenta/);
    await expect(page.locator("main h1:visible")).toContainText("Qué bueno verte");

    await signIn(page, customer);
    await expect(page.locator("main h1")).toContainText(`QA`);
    await expect(page.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/mi-cuenta?vista=pedidos");
    await expect(page.getByRole("link", { name: "Favoritos", exact: true })).toHaveAttribute("href", "/favoritos");
    await expect(page.getByRole("navigation", { name: "Secciones de mi espacio" }).getByRole("link", { name: "PC Builder", exact: true })).toHaveAttribute("href", "/configurador");
    await expect(page.getByRole("navigation", { name: "Secciones de mi espacio" }).getByRole("link", { name: "Soporte" })).toHaveAttribute("href", "/soporte");
    await expect(page.getByRole("link", { name: "Explorar catálogo" })).toHaveAttribute("href", "/catalogo");
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await expect(page.getByText("No hay membresías de empresa asociadas a esta cuenta.")).toBeVisible();
    await inspectResponsive(page, "customer-account", "account", testInfo);

    await page.goto("/empresas/portal");
    await expect(page.locator("main h1:visible")).toContainText("Empieza por reunir");
    await expect(page.getByRole("button", { name: "Crear organización" })).toBeVisible();
    await expect(page.getByText(`QA Tenant Alfa ${fixtures.runId.slice(0, 6)}`)).toHaveCount(0);
    await expect(page.getByText(`QA Tenant Beta ${fixtures.runId.slice(0, 6)}`)).toHaveCount(0);
    await inspectResponsive(page, "customer-no-membership", "portal", testInfo);

    await page.goto("/mi-cuenta");
    await page.getByRole("link", { name: "Pedidos" }).click();
    await expect(page).toHaveURL(/\/mi-cuenta\?vista=pedidos/);
    await expect(page.getByRole("heading", { name: "Todos tus pedidos." })).toBeVisible();
    await inspectResponsive(page, "customer-orders", "orders", testInfo);

    for (const role of roles) {
      const user = fixtures.users.find((candidate) => candidate.role === role)!;
      const context = await browser.newContext();
      try {
        const rolePage = await context.newPage();
        await signIn(rolePage, user);
        await expect(rolePage.getByText(`QA Tenant Alfa ${fixtures.runId.slice(0, 6)}`, { exact: true }).first()).toBeVisible();
        await expect(rolePage.getByText(`QA Tenant Beta ${fixtures.runId.slice(0, 6)}`)).toHaveCount(0);
        await expect(rolePage.locator(".account-memberships").getByText(role === "owner" ? "Propietario/a" : role === "admin" ? "Administrador/a" : role === "buyer" ? "Comprador/a" : "Consulta")).toBeVisible();
        await inspectResponsive(rolePage, `account-${role}`, "account", testInfo);

        await rolePage.goto(`/empresas/portal?organization=${fixtures.organizationId}`);
        await expect(rolePage.locator("main h1:visible")).toContainText("Tu equipo,");
        await expect(rolePage.getByText(`QA Tenant Alfa ${fixtures.runId.slice(0, 6)}`, { exact: true }).first()).toBeVisible();
        await expect(rolePage.getByText(`QA Tenant Beta ${fixtures.runId.slice(0, 6)}`)).toHaveCount(0);
        await expect(rolePage.getByRole("link", { name: "Soluciones para tu organización" })).toHaveAttribute("href", "/empresas");
        await expect(rolePage.locator("main header a").first()).toHaveAttribute("href", "/empresas");

        const managesOrganization = role === "owner" || role === "admin";
        if (managesOrganization) {
          await expect(rolePage.getByRole("button", { name: "Añadir", exact: true })).toBeVisible();
          await expect(rolePage.getByLabel("Correo de cuenta ya registrada")).toBeVisible();
          await expect(rolePage.getByLabel("Rol inicial")).toBeVisible();
          await expect(rolePage.getByRole("button", { name: "Retirar" }).first()).toBeVisible();
          if (role === "admin") await expect(rolePage.getByLabel("Rol inicial").locator("option[value=admin]")).toHaveCount(0);
        } else {
          await expect(rolePage.getByText("Solo la persona propietaria o administración puede gestionar miembros.")).toBeVisible();
          await expect(rolePage.getByLabel("Correo de cuenta ya registrada")).toHaveCount(0);
          await expect(rolePage.getByRole("button", { name: "Retirar" })).toHaveCount(0);
        }
        if (role === "viewer") {
          await expect(rolePage.getByText("Tu rol permite consultar propuestas e historial.")).toBeVisible();
          await expect(rolePage.getByRole("button", { name: "Enviar a ventas" })).toHaveCount(0);
        } else {
          await expect(rolePage.getByRole("button", { name: "Enviar a ventas" })).toBeVisible();
        }
        await inspectResponsive(rolePage, `portal-${role}`, "portal", testInfo);

        await rolePage.goto(`/empresas/portal?organization=${fixtures.otherOrganizationId}`);
        await expect(rolePage.getByText(`QA Tenant Alfa ${fixtures.runId.slice(0, 6)}`, { exact: true }).first()).toBeVisible();
        await expect(rolePage.getByText(`QA Tenant Beta ${fixtures.runId.slice(0, 6)}`)).toHaveCount(0);
        await expect(rolePage.locator("main h1:visible")).toContainText("Tu equipo,");
      } finally {
        await context.close();
      }
    }

    await expect(checked(await outsider.client.from("organizations").select("id").eq("id", fixtures.organizationId))).toEqual([]);
    await expect(checked(await customerClient.from("organizations").select("id").eq("id", fixtures.organizationId))).toEqual([]);
    for (const role of roles) {
      const member = fixtures.users.find((user) => user.role === role)!;
      expect(checked(await member.client.from("organization_memberships").select("organization_id,role").eq("organization_id", fixtures.organizationId))).toHaveLength(1);
      expect(checked(await member.client.from("organizations").select("id").eq("id", fixtures.otherOrganizationId))).toEqual([]);
    }
  } finally {
    await customerClient.auth.signOut();
  }
});
