import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createAdminClient, inspectOrder, loadFixtures, readFixtureInventory, setFixtureStock, type CheckoutConnectedFixtures, type CheckoutConnectedUser, type CheckoutFixtureKey } from "./fixtures";

type CheckoutRequest = {
  items: Array<{ variantId: string; quantity: number }>;
  customer: { name: string; email: string; phone: string; address: string; postalCode: string; city: string; province: string };
  idempotencyKey: string;
  paymentMethod: "approved";
};

function requestFor(fixtures: CheckoutConnectedFixtures, key: CheckoutFixtureKey, user: CheckoutConnectedUser, idempotencyKey = randomUUID()): CheckoutRequest {
  return {
    items: [{ variantId: fixtures.catalog[key].variantId, quantity: 1 }],
    customer: {
      name: user.name,
      email: user.email,
      phone: "600000000",
      address: "Calle Ficticia 10",
      postalCode: "28013",
      city: "Madrid",
      province: "Madrid",
    },
    idempotencyKey,
    paymentMethod: "approved",
  };
}

async function signIn(page: Page, user: CheckoutConnectedUser) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.locator("form").getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/mi-cuenta(?:\?|$)/, { timeout: 15_000 });
}

async function browserCheckout(page: Page, body: CheckoutRequest) {
  return page.evaluate(async (payload) => {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }, body);
}

async function addLegacyCart(page: Page, fixtures: CheckoutConnectedFixtures, key: CheckoutFixtureKey) {
  const catalog = fixtures.catalog[key];
  await page.addInitScript(({ productId, unitPrice, sku }) => {
    localStorage.setItem("nodria.cart.v2", JSON.stringify([{
      id: productId,
      slug: "e2e-checkout-fixture",
      name: "NODRIA Connected Checkout Fixture",
      price: unitPrice,
      sku,
      quantity: 1,
      type: "product",
    }]));
  }, { productId: catalog.productId, unitPrice: fixtures.unitPrice, sku: catalog.sku });
}

test("aprueba una compra variantId y mantiene pedido, pago, reserva, stock y timeline idempotentes", async ({ page }) => {
  const fixtures = await loadFixtures();
  const user = fixtures.users.approved;
  const catalog = fixtures.catalog.approved;
  await signIn(page, user);
  await page.goto("/checkout");
  await expect(page.getByText("FINALIZAR PEDIDO · SUPABASE")).toBeVisible();

  const payload = requestFor(fixtures, "approved", user);
  const first = await browserCheckout(page, payload);
  expect(first.status).toBe(201);
  expect(first.body).toMatchObject({ mode: "supabase", paymentStatus: "approved", orderStatus: "paid", idempotencyKey: payload.idempotencyKey });

  const duplicate = await browserCheckout(page, payload);
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.orderId).toBe(first.body.orderId);
  expect(duplicate.body.orderNumber).toBe(first.body.orderNumber);

  const changed = { ...payload, items: [{ variantId: catalog.variantId, quantity: 2 }] };
  const reusedKey = await browserCheckout(page, changed);
  expect(reusedKey.status).toBe(409);

  const state = await inspectOrder(createAdminClient(), user.email, payload.idempotencyKey, catalog.variantId);
  expect(state).not.toBeNull();
  expect(state?.order).toMatchObject({ status: "paid", grand_total: fixtures.unitPrice, currency: "EUR" });
  expect(state?.items).toHaveLength(1);
  expect(state?.items[0]).toMatchObject({ variant_id: catalog.variantId, quantity: 1, unit_price: fixtures.unitPrice, product_sku: catalog.sku });
  expect(state?.payments).toHaveLength(1);
  expect(state?.payments[0]).toMatchObject({ provider: "demo", status: "paid", amount: fixtures.unitPrice });
  expect(state?.reservations).toHaveLength(1);
  expect(state?.reservations[0]).toMatchObject({ quantity: 1, released_at: null, fulfilled_at: null });
  expect(state?.inventory).toMatchObject([{ on_hand: 30, reserved: 1 }]);
  expect(state?.events.map((event) => event.event_key)).toEqual(["order_created", "payment_paid"]);
  expect(state?.carts.map((cart) => cart.status)).toContain("converted");
  expect(state?.carts).toHaveLength(1);
  expect(state?.cartItems).toHaveLength(1);
});

test("rechaza que el cliente intente elegir un pago rechazado", async ({ page }) => {
  const fixtures = await loadFixtures();
  const user = fixtures.users.declined;
  await signIn(page, user);
  const payload = { ...requestFor(fixtures, "declined", user), paymentMethod: "declined" } as unknown as CheckoutRequest;

  const response = await browserCheckout(page, payload);
  expect(response.status).toBe(400);
  expect(response.body.error).toContain("datos del pedido");
  expect(await inspectOrder(createAdminClient(), user.email, payload.idempotencyKey, fixtures.catalog.declined.variantId)).toBeNull();
});

test("un refresh conserva la clave del formulario tras perder la respuesta y reintenta el mismo pedido", async ({ page }) => {
  const fixtures = await loadFixtures();
  const user = fixtures.users.retry;
  const catalog = fixtures.catalog.retry;
  await signIn(page, user);
  await addLegacyCart(page, fixtures, "retry");
  await page.goto("/checkout");
  const captured: Array<Record<string, unknown>> = [];
  let simulatedNetworkLoss = false;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/checkout") && request.method() === "POST") {
      try { captured.push(request.postDataJSON() as Record<string, unknown>); } catch { /* Ignore non-JSON requests. */ }
    }
  });
  await page.route("**/api/checkout", async (route) => {
    if (route.request().method() !== "POST" || simulatedNetworkLoss) return route.continue();
    const response = await route.fetch();
    if (response.status() === 201) {
      simulatedNetworkLoss = true;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Respuesta de red interrumpida después de registrar el pedido." }) });
    }
    return route.fulfill({ response });
  });

  await page.getByLabel("Nombre y apellidos").fill(user.name);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Dirección de entrega y facturación").fill("Calle Ficticia 10");
  await page.getByLabel("Código postal").fill("28013");
  await page.getByLabel("Municipio").fill("Madrid");
  await page.getByLabel("Provincia").fill("Madrid");
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.locator(".checkout-error[role='alert']")).toContainText("Respuesta de red interrumpida");
  const originalKey = captured[0]?.idempotencyKey;
  expect(typeof originalKey).toBe("string");

  await page.reload();
  await page.getByLabel("Nombre y apellidos").fill(user.name);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Dirección de entrega y facturación").fill("Calle Ficticia 10");
  await page.getByLabel("Código postal").fill("28013");
  await page.getByLabel("Municipio").fill("Madrid");
  await page.getByLabel("Provincia").fill("Madrid");
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByRole("heading", { name: "Tu pedido está confirmado." })).toBeVisible();
  expect(captured).toHaveLength(2);
  expect(captured[1]?.idempotencyKey).toBe(originalKey);

  const state = await inspectOrder(createAdminClient(), user.email, String(originalKey), catalog.variantId);
  expect(state?.order.status).toBe("paid");
  expect(state?.payments).toHaveLength(1);
  expect(state?.payments[0].status).toBe("paid");
  expect(state?.reservations).toHaveLength(1);
  expect(state?.inventory).toMatchObject([{ on_hand: 30, reserved: 1 }]);
  expect(state?.events.map((event) => event.event_key)).toEqual(["order_created", "payment_paid"]);

  const variantPayload = requestFor(fixtures, "retry", user, randomUUID());
  const variantCreated = await browserCheckout(page, variantPayload);
  const variantRetry = await browserCheckout(page, variantPayload);
  expect(variantCreated.status).toBe(201);
  expect(variantRetry.status).toBe(200);
  expect(variantRetry.body.orderStatus).toBe("paid");
  const variantChanged = await browserCheckout(page, { ...variantPayload, customer: { ...variantPayload.customer, address: "Calle distinta 21" } });
  expect(variantChanged.status).toBe(409);
  const variantState = await inspectOrder(createAdminClient(), user.email, variantPayload.idempotencyKey, catalog.variantId);
  expect(variantState?.payments).toHaveLength(1);
  expect(variantState?.reservations).toHaveLength(1);
  expect(variantState?.events.map((event) => event.event_key)).toEqual(["order_created", "payment_paid"]);
});

test("dos sesiones compran en paralelo con una unidad: solo una confirma y stock reservado no supera físico", async ({ browser }) => {
  const fixtures = await loadFixtures();
  const admin = createAdminClient();
  const catalog = fixtures.catalog.race;
  setFixtureStock(catalog.variantId, 1, 0);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await Promise.all([signIn(pageA, fixtures.users.raceA), signIn(pageB, fixtures.users.raceB)]);
    await Promise.all([pageA.goto("/checkout"), pageB.goto("/checkout")]);
    const firstPayload = requestFor(fixtures, "race", fixtures.users.raceA, randomUUID());
    const secondPayload = requestFor(fixtures, "race", fixtures.users.raceB, randomUUID());
    const results = await Promise.all([browserCheckout(pageA, firstPayload), browserCheckout(pageB, secondPayload)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);

    const winningIndex = results.findIndex((result) => result.status === 201);
    expect(results[winningIndex].body).toMatchObject({ paymentStatus: "approved", orderStatus: "paid" });
    const winner = winningIndex === 0 ? fixtures.users.raceA : fixtures.users.raceB;
    const winnerKey = winningIndex === 0 ? firstPayload.idempotencyKey : secondPayload.idempotencyKey;
    const loser = winningIndex === 0 ? fixtures.users.raceB : fixtures.users.raceA;
    const loserKey = winningIndex === 0 ? secondPayload.idempotencyKey : firstPayload.idempotencyKey;

    const [winnerState, loserState] = await Promise.all([
      inspectOrder(admin, winner.email, winnerKey, catalog.variantId),
      inspectOrder(admin, loser.email, loserKey, catalog.variantId),
    ]);
    expect(winnerState?.order.status).toBe("paid");
    expect(winnerState?.items).toMatchObject([expect.objectContaining({ variant_id: catalog.variantId, quantity: 1 })]);
    expect(winnerState?.reservations).toHaveLength(1);
    expect(winnerState?.inventory).toMatchObject([{ on_hand: 1, reserved: 1 }]);
    expect(winnerState?.events.map((event) => event.event_key)).toEqual(["order_created", "payment_paid"]);
    expect(loserState).toBeNull();
    expect(readFixtureInventory(catalog.variantId)).toMatchObject([{ on_hand: 1, reserved: 1 }]);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
