import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createAdminClient,
  createAnalyticsFixtures,
  createInconsistentAnalyticsFixture,
  createUserClient,
  loadFixtures,
  readReviewById,
  readReviewByOrderItem,
  readSupportMessages,
  type ConnectedDomainUser,
} from "./fixtures";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, user: ConnectedDomainUser, destination: string) {
  await page.goto("/acceso?next=" + encodeURIComponent(destination));
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  const authResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/auth/v1/token") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Entrar en mi espacio" }).click();
  const authResponse = await authResponsePromise;
  if (!authResponse.ok()) {
    const body = await authResponse.json().catch(() => ({})) as { msg?: string; message?: string };
    throw new Error("Connected Auth sign-in failed: " + (body.msg ?? body.message ?? authResponse.status()));
  }
  const pathname = destination.split("?")[0];
  try {
    await page.waitForURL((url) => url.pathname === pathname, { timeout: 15_000 });
  } catch {
    const alerts = (await page.getByRole("alert").allInnerTexts()).join(" | ");
    throw new Error("Auth accepted the fixture user but navigation did not reach " + pathname + ". Alerts: " + alerts);
  }
}

async function openSession(browser: Browser, user: ConnectedDomainUser, destination: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user, destination);
  return { context, page };
}

async function metricCard(page: Page, label: string) {
  const card = page.locator("article").filter({ hasText: label });
  await expect(card).toHaveCount(1);
  return card;
}

function parseLocalizedNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

type DashboardNumbers = {
  orders: number;
  grossSales: number;
  approvedPayments: number;
  resolvedPayments: number;
  approvalRate: number;
  availableUnits: number;
  reservedUnits: number;
  inventoryRows: number;
  convertedRequests: number;
  totalRequests: number;
  conversionRate: number;
};

async function readDashboardNumbers(page: Page): Promise<DashboardNumbers> {
  const sales = await metricCard(page, "VENTAS BRUTAS APROBADAS · EUR");
  const orders = await metricCard(page, "PEDIDOS VÁLIDOS");
  const payments = await metricCard(page, "APROBACIÓN DE PAGOS");
  const inventory = await metricCard(page, "UNIDADES DISPONIBLES");
  const crm = await metricCard(page, "CONVERSIÓN DE SOLICITUDES");
  const paymentDetail = await payments.locator("p").innerText();
  const inventoryDetail = await inventory.locator("p").innerText();
  const crmDetail = await crm.locator("p").innerText();
  const paymentCounts = paymentDetail.match(/([\d.]+) aprobados \/ ([\d.]+) pedidos resueltos/)
    ?? (paymentDetail.includes("Sin pedidos con resultado terminal") ? ["", "0", "0"] : null);
  const inventoryCounts = inventoryDetail.match(/([\d.]+) reservadas · ([\d.]+) ubicaciones SKU/);
  const crmCounts = crmDetail.match(/([\d.]+) convertidas \/ ([\d.]+) solicitudes creadas/)
    ?? (crmDetail.includes("Sin solicitudes creadas") ? ["", "0", "0"] : null);
  if (!paymentCounts || !inventoryCounts || !crmCounts) throw new Error("Analytics KPI detail labels did not match the documented contract.");
  return {
    orders: parseLocalizedNumber((await orders.locator("strong").first().textContent()) ?? ""),
    grossSales: parseLocalizedNumber((await sales.locator("strong").first().textContent()) ?? ""),
    approvedPayments: parseLocalizedNumber(paymentCounts[1]),
    resolvedPayments: parseLocalizedNumber(paymentCounts[2]),
    approvalRate: parseLocalizedNumber((await payments.locator("strong").first().textContent()) ?? "") / 100,
    availableUnits: parseLocalizedNumber((await inventory.locator("strong").first().textContent()) ?? ""),
    reservedUnits: parseLocalizedNumber(inventoryCounts[1]),
    inventoryRows: parseLocalizedNumber(inventoryCounts[2]),
    convertedRequests: parseLocalizedNumber(crmCounts[1]),
    totalRequests: parseLocalizedNumber(crmCounts[2]),
    conversionRate: parseLocalizedNumber((await crm.locator("strong").first().textContent()) ?? "") / 100,
  };
}

test("B2B limita la emisión del pedido al owner/admin y conserva el estado vacío por organización", async ({ browser }) => {
  const fixtures = await loadFixtures();
  const owner = await openSession(browser, fixtures.users.businessOwner, "/empresas/portal");
  const viewer = await openSession(browser, fixtures.users.businessViewer, "/empresas/portal");
  const emptyOwner = await openSession(browser, fixtures.users.emptyBusinessOwner, "/empresas/portal");
  try {
    await expect(owner.page.getByText("NODRIA E2E Business", { exact: true }).first()).toBeVisible();
    await expect(owner.page.getByRole("button", { name: "Emitir pedido formal" })).toBeVisible();
    await expect(owner.page.getByRole("button", { name: "Emitir pedido formal" })).toBeEnabled();

    await viewer.page.goto("/empresas/portal?organization=" + encodeURIComponent(fixtures.organizations.business));
    await expect(viewer.page.getByText("NODRIA E2E Business", { exact: true }).first()).toBeVisible();
    await expect(viewer.page.getByText("Tu rol permite consultar propuestas e historial.", { exact: false })).toBeVisible();
    await expect(viewer.page.getByText("Propuesta aceptada. Un propietario o administrador puede emitir el pedido formal.", { exact: false })).toBeVisible();
    await expect(viewer.page.getByRole("button", { name: "Emitir pedido formal" })).toHaveCount(0);

    const viewerClient = createUserClient();
    const viewerLogin = await viewerClient.auth.signInWithPassword({
      email: fixtures.users.businessViewer.email,
      password: fixtures.users.businessViewer.password,
    });
    expect(viewerLogin.error).toBeNull();
    const forbiddenOrder = await viewerClient.rpc("create_business_order_from_accepted_quote", {
      p_quote_id: fixtures.quoteId,
      p_shipping_address: { fullName: "NODRIA E2E Business", address: "Calle Ficticia 10", postalCode: "28013", city: "Madrid", countryCode: "ES" },
      p_billing_address: { fullName: "NODRIA E2E Business SL", address: "Calle Ficticia 10", postalCode: "28013", city: "Madrid", countryCode: "ES" },
    });
    expect(forbiddenOrder.error?.code).toBe("42501");

    await emptyOwner.page.goto("/empresas/portal?organization=" + encodeURIComponent(fixtures.organizations.business));
    await expect(emptyOwner.page.locator("dl").getByText("NODRIA E2E Empty", { exact: true })).toBeVisible();
    await expect(emptyOwner.page.getByText("Todavía no hay cotizaciones")).toBeVisible();
    await expect(emptyOwner.page.getByText("NODRIA E2E Business", { exact: true })).toHaveCount(0);
  } finally {
    await Promise.allSettled([owner.context.close(), viewer.context.close(), emptyOwner.context.close()]);
  }
});

test("la cuenta conectada muestra solo pedidos propios y explica el historial vacío", async ({ browser }) => {
  const fixtures = await loadFixtures();
  const owner = await openSession(browser, fixtures.users.businessOwner, "/mi-cuenta?vista=pedidos");
  const emptyOwner = await openSession(browser, fixtures.users.emptyBusinessOwner, "/mi-cuenta?vista=pedidos");
  try {
    await expect(owner.page.getByRole("heading", { name: "Todos tus pedidos." })).toBeVisible();
    await expect(owner.page.getByText(fixtures.accountOrders.owner.number)).toBeVisible();
    await expect(owner.page.getByText(fixtures.accountOrders.other.number)).toHaveCount(0);

    await expect(emptyOwner.page.getByText("AÚN SIN ACTIVIDAD")).toBeVisible();
    await expect(emptyOwner.page.getByText("Tu próximo pedido empieza por una buena elección.")).toBeVisible();
    await expect(emptyOwner.page.getByText("0 REGISTROS")).toBeVisible();
  } finally {
    await Promise.all([owner.context.close(), emptyOwner.context.close()]);
  }
});

test("la review elegible queda pendiente, no se filtra y solo super_admin la publica", async ({ browser }) => {
  const fixtures = await loadFixtures();
  const reviewUrl = "/producto/" + fixtures.product.slug + "/opiniones";
  const buyer = await openSession(browser, fixtures.users.businessOwner, reviewUrl);
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  const title = "Opinión conectada " + fixtures.runId.slice(0, 8);
  const body = "La compra llegó bien y el producto responde según sus especificaciones.";
  try {
    await visitor.goto(reviewUrl);
    await expect(visitor.getByText("Todavía no hay opiniones publicadas para este producto.")).toBeVisible();
    await expect(buyer.page.getByLabel("Compra entregada")).toContainText(fixtures.accountOrders.owner.number);
    await buyer.page.getByLabel("Compra entregada").selectOption(fixtures.accountOrders.owner.itemId);
    await buyer.page.getByLabel("Valoración").selectOption("5");
    await buyer.page.getByLabel("Título").fill(title);
    await buyer.page.getByRole("textbox", { name: "Tu opinión" }).fill(body);
    await buyer.page.getByRole("button", { name: "Enviar opinión" }).click();
    await expect(buyer.page.getByRole("status").filter({ hasText: "Se publicará cuando termine la revisión de moderación" })).toBeVisible();
    await expect(buyer.page.getByText("No hay compras entregadas de este producto disponibles para reseñar en esta cuenta.")).toBeVisible();

    const pending = readReviewByOrderItem(fixtures.accountOrders.owner.itemId);
    expect(pending).toMatchObject({
      status: "pending",
      author_id: fixtures.users.businessOwner.id,
      order_item_id: fixtures.accountOrders.owner.itemId,
    });
    await visitor.reload();
    await expect(visitor.getByText("Todavía no hay opiniones publicadas para este producto.")).toBeVisible();
    await expect(visitor.getByText(title)).toHaveCount(0);

    const moderator = await openSession(browser, fixtures.users.superAdmin, "/backoffice/reviews");
    try {
      await expect(moderator.page.getByRole("heading", { name: "Moderación de opiniones." })).toBeVisible();
      await expect(moderator.page.getByRole("heading", { name: title })).toBeVisible();
      const moderationResponse = moderator.page.waitForResponse((response) =>
        response.url().endsWith("/api/reviews/" + pending?.id) && response.request().method() === "PATCH",
      { timeout: 20_000 });
      await moderator.page.getByRole("button", { name: "Publicar" }).click();
      const response = await moderationResponse;
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ persisted: true, status: "published" });
      await expect(moderator.page.getByRole("status").filter({ hasText: "No hay opiniones pendientes de moderación." })).toBeVisible();
    } finally {
      await moderator.context.close();
    }

    const published = readReviewById(String(pending?.id));
    expect(published).toMatchObject({ status: "published", moderated_by: fixtures.users.superAdmin.id });
    await visitor.reload();
    await expect(visitor.getByRole("heading", { name: title })).toBeVisible();
    await expect(visitor.getByText("Compra verificada")).toBeVisible();

    const supportAgent = await openSession(browser, fixtures.users.supportAgent, "/backoffice/reviews");
    try {
      await expect(supportAgent.page.getByRole("heading", { name: "No tienes acceso al portal de equipo." })).toBeVisible();
      await expect(supportAgent.page.getByText(title)).toHaveCount(0);
    } finally {
      await supportAgent.context.close();
    }
  } finally {
    await Promise.all([buyer.context.close(), visitorContext.close()]);
  }
});

test("soporte conectado conserva errores reintentables, privacidad del ticket y respuesta del agente", async ({ browser }) => {
  const fixtures = await loadFixtures();
  const customer = await openSession(browser, fixtures.users.businessOwner, "/soporte");
  const emptyCustomer = await openSession(browser, fixtures.users.emptyBusinessOwner, "/soporte");
  try {
    await expect(emptyCustomer.page.getByText("Todavía no has abierto ningún ticket conectado.")).toBeVisible();
    await expect(customer.page.getByText("Todavía no has abierto ningún ticket conectado.")).toBeVisible();

    const subject = "Consulta sobre un producto";
    const message = "Necesito ayuda para comprobar la configuración de mi equipo.";
    const reply = "Hemos revisado la consulta y te acompañaremos con la configuración.";
    await customer.page.route("**/api/support", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fallo de red simulado por la prueba conectada." }),
    }));
    await customer.page.getByLabel("¿En qué podemos ayudarte?").selectOption({ label: subject });
    await customer.page.getByLabel("Cuéntanos un poco más").fill(message);
    await customer.page.locator('input[name="privacyAccepted"]').check();
    await customer.page.getByRole("button", { name: /Abrir ticket de soporte/ }).click();
    await expect(customer.page.getByRole("alert").filter({ hasText: "Fallo de red simulado por la prueba conectada." })).toBeVisible();
    await customer.page.unroute("**/api/support");

    const createResponse = customer.page.waitForResponse((response) =>
      response.url().endsWith("/api/support") && response.request().method() === "POST");
    await customer.page.getByRole("button", { name: /Abrir ticket de soporte/ }).click();
    const response = await createResponse;
    expect(response.status()).toBe(201);
    const created = await response.json() as { ticketId: string; ticketNumber: string; persisted: boolean; mode: string };
    expect(created).toMatchObject({ persisted: true, mode: "supabase" });
    expect(created.ticketId).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(customer.page.getByRole("status").filter({ hasText: "El ticket y su primer mensaje se guardaron juntos" })).toBeVisible();

    const unrelated = await emptyCustomer.page.evaluate(async (ticketId) => {
      const result = await fetch("/api/support/tickets/" + encodeURIComponent(ticketId), { cache: "no-store" });
      return { status: result.status, body: await result.json() as Record<string, unknown> };
    }, created.ticketId);
    expect(unrelated.status).not.toBe(200);
    expect(JSON.stringify(unrelated.body)).not.toContain(message);

    const agent = await openSession(browser, fixtures.users.supportAgent, "/soporte/agente");
    try {
      await expect(agent.page.getByRole("heading", { name: "Bandeja de soporte." })).toBeVisible();
      await expect(agent.page.getByRole("heading", { name: subject })).toBeVisible();
      await expect(agent.page.getByText(message)).toBeVisible();
      await agent.page.getByLabel("Estado después de responder").selectOption({ label: "En curso" });
      await agent.page.getByLabel("Respuesta para el cliente").fill(reply);
      const replyResponsePromise = agent.page.waitForResponse((candidate) =>
        candidate.url().endsWith("/api/support/tickets/" + created.ticketId + "/messages") && candidate.request().method() === "POST",
      { timeout: 15_000 });
      await agent.page.getByRole("button", { name: /Enviar respuesta/ }).click();
      const replyResponse = await replyResponsePromise;
      expect(replyResponse.status()).toBe(200);
      expect(await replyResponse.json()).toMatchObject({ persisted: true, status: "in_progress" });
      await expect(agent.page.getByText(reply, { exact: true })).toBeVisible({ timeout: 15_000 });
      expect(readSupportMessages(created.ticketId)).toContainEqual({ author_type: "agent", body: reply, is_internal: false });
    } finally {
      await agent.context.close();
    }

    const customerDetailsResponsePromise = customer.page.waitForResponse((candidate) =>
      candidate.url().endsWith("/api/support/tickets/" + created.ticketId) && candidate.request().method() === "GET",
    { timeout: 15_000 });
    await customer.page.reload();
    const customerDetailsResponse = await customerDetailsResponsePromise;
    expect(customerDetailsResponse.status()).toBe(200);
    const customerDetails = await customerDetailsResponse.json() as { messages: Array<{ authorType: string; body: string; internal: boolean }> };
    expect(customerDetails.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ authorType: "agent", body: reply, internal: false }),
    ]));
    await expect(customer.page.getByRole("heading", { name: subject })).toBeVisible();
    await expect(customer.page.getByText("Hemos revisado la consulta y te acompañaremos con la configuración.")).toBeVisible();

    await emptyCustomer.page.goto("/soporte/agente");
    await expect(emptyCustomer.page.getByRole("heading", { name: "Bandeja restringida." })).toBeVisible();
  } finally {
    await Promise.all([customer.context.close(), emptyCustomer.context.close()]);
  }
});

test("analytics lee filas conectadas, aplica definiciones y oculta totales ante una inconsistencia", async ({ browser }) => {
  const fixtures = await loadFixtures();
  const unauthorized = await openSession(browser, fixtures.users.supportAgent, "/backoffice/analytics");
  try {
    await expect(unauthorized.page.getByRole("heading", { name: "No tienes acceso al portal de equipo." })).toBeVisible();
    await expect(unauthorized.page.getByRole("region", { name: "Indicadores de negocio" })).toHaveCount(0);
  } finally {
    await unauthorized.context.close();
  }

  const admin = await openSession(browser, fixtures.users.superAdmin, "/backoffice/analytics");
  try {
    await expect(admin.page.getByText("SUPABASE · RLS ACTIVO")).toBeVisible();
    await expect(admin.page.getByRole("heading", { name: "Qué entra en cada cifra" })).toBeVisible();
    await expect(admin.page.getByRole("row", { name: /Conversión de solicitudes CRM/ })).toContainText("converted");
    const before = await readDashboardNumbers(admin.page);

    await createAnalyticsFixtures(fixtures);
    await admin.page.reload();
    const after = await readDashboardNumbers(admin.page);
    expect(after.orders).toBe(before.orders + 1);
    expect(after.grossSales).toBeCloseTo(before.grossSales + 120.5, 2);
    expect(after.approvedPayments).toBe(before.approvedPayments + 1);
    expect(after.resolvedPayments).toBe(before.resolvedPayments + 2);
    expect(after.approvalRate).toBeCloseTo(after.approvedPayments / after.resolvedPayments, 3);
    expect(after.availableUnits).toBe(before.availableUnits + 7);
    expect(after.reservedUnits).toBe(before.reservedUnits + 2);
    expect(after.inventoryRows).toBe(before.inventoryRows + 1);
    expect(after.convertedRequests).toBe(before.convertedRequests + 1);
    expect(after.totalRequests).toBe(before.totalRequests + 2);
    expect(after.conversionRate).toBeCloseTo(after.convertedRequests / after.totalRequests, 3);

    await createInconsistentAnalyticsFixture(fixtures);
    await admin.page.reload();
    await expect(admin.page.getByRole("heading", { name: "Fuentes de pago no conciliadas" })).toBeVisible();
    await expect(admin.page.getByRole("region", { name: "Indicadores de negocio" })).toHaveCount(0);
    await expect(admin.page.getByRole("alert").filter({ hasText: "Se ocultan los totales hasta resolver la discrepancia." })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});
