import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const apiURL = "http://127.0.0.1:56401";
const password = "Nodria-Fictional-B2B-2026!";
const shipping = { fullName: "Empresa Ficticia SL", address: "Calle Ficticia 42", postalCode: "28013", city: "Madrid", countryCode: "ES" };
const billing = { ...shipping, address: "Avenida Ficticia 19", postalCode: "28014" };
type User = { email: string; id: string; client: SupabaseClient };

function checked<R extends { data: unknown; error: { message: string } | null }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("The fixture operation returned no data.");
  return result.data as NonNullable<R["data"]>;
}

function sql(query: string) {
  const container = process.env.B2B_TEST_CONTAINER;
  if (container !== "supabase_db_nodria-b2b-e2e") {
    throw new Error("The B2B suite requires its isolated test database.");
  }
  return execFileSync("docker.exe", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

async function signIn(page: Page, user: User) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar en mi espacio" }).click();
  await expect(page).toHaveURL(/\/mi-cuenta(?:\?|$)/);
}

async function fillOrder(page: Page, quoteId: string) {
  const form = page.locator("form").filter({ has: page.locator(`input[name="quoteId"][value="${quoteId}"]`) }).filter({ has: page.locator('[name="shippingName"]') });
  for (const [prefix, address] of [["shipping", shipping], ["billing", billing]] as const) {
    await form.locator(`[name="${prefix}Name"]`).fill(address.fullName);
    await form.locator(`[name="${prefix}Address"]`).fill(address.address);
    await form.locator(`[name="${prefix}PostalCode"]`).fill(address.postalCode);
    await form.locator(`[name="${prefix}City"]`).fill(address.city);
  }
  await form.locator('[name="confirmTerms"]').check();
  await form.getByRole("button", { name: "Emitir pedido formal" }).click();
}

test("portal conectado: oferta, pedido, retry, permisos de organización y rollback por stock", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const suffix = randomUUID();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publishableKey || !adminKey) throw new Error("Missing isolated Supabase keys.");
  const admin = createClient(apiURL, adminKey, { auth: { persistSession: false } });
  const users: User[] = [];
  for (const role of ["owner", "buyer", "viewer", "outsider", "sales"]) {
    const email = `b2b-${role}-${suffix}@nodria.test`;
    const authUser = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    if (!authUser.user) throw new Error("Missing fixture user.");
    const client = createClient(apiURL, publishableKey, { auth: { persistSession: false } });
    checked(await client.auth.signInWithPassword({ email, password }));
    users.push({ email, id: authUser.user.id, client });
  }
  const [owner, buyer, viewer, outsider, sales] = users;
  const organizationId = checked(await owner.client.rpc("create_organization", {
    p_slug: `b2b-${suffix}`, p_legal_name: "Empresa Ficticia SL", p_display_name: "Empresa Ficticia", p_tax_id: null, p_billing_email: owner.email,
  })) as string;
  for (const [member, role] of [[buyer, "buyer"], [viewer, "viewer"]] as const) {
    checked(await owner.client.rpc("add_organization_member", { p_organization_id: organizationId, p_email: member.email, p_role: role }));
  }
  sql(`insert into public.user_role_grants (user_id, role) values ('${sales.id}', 'sales_manager');`);
  const warehouse = checked(await admin.from("warehouses").select("id").eq("code", "MAD-CENTRAL").single());
  const productId = `b2b-e2e-${suffix}`;
  const sku = `B2B-${suffix.replaceAll("-", "").toUpperCase()}`;
  checked(await admin.from("products").insert({ id: productId, slug: productId, sku, name: "Equipo Ficticio B2B", brand: "NODRIA E2E", summary: "Datos ficticios", description: "Fixture aislada B2B", image_alt: "", is_published: true, published_at: new Date().toISOString() }).select("id").single());
  const variant = checked(await admin.from("product_variants").insert({ product_id: productId, sku, title: "Equipo de prueba", attributes: {}, current_price: 149, currency: "EUR", tax_rate: 0.21, is_active: true }).select("id").single());
  sql(`insert into public.inventory (warehouse_id, variant_id, on_hand, reserved) values ('${warehouse.id}', '${variant.id}', 3, 0);`);
  async function offer(quantity: number) {
    const quoteId = checked(await owner.client.rpc("create_business_quote", { p_organization_id: organizationId, p_request_note: "Solicitud ficticia", p_lines: [{ variant_id: variant.id, quantity }] })) as string;
    checked(await sales.client.rpc("claim_business_quote", { p_quote_id: quoteId }));
    const item = checked(await sales.client.from("quote_items").select("id").eq("quote_id", quoteId).single());
    checked(await sales.client.rpc("send_business_quote", { p_quote_id: quoteId, p_offers: [{ item_id: item.id, unit_price: 108.25 }], p_valid_until: new Date(Date.now() + 86400_000).toISOString() }));
    return quoteId;
  }
  const quoteId = await offer(2);
  expect((await owner.client.rpc("create_business_order_from_accepted_quote", { p_quote_id: quoteId, p_shipping_address: shipping, p_billing_address: billing })).error?.code).toBe("23514");
  await signIn(page, owner);
  await page.goto(`/empresas/portal?organization=${organizationId}`);
  await page.getByRole("button", { name: "Aceptar propuesta" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Propuesta aceptada" })).toBeVisible();
  await fillOrder(page, quoteId);
  await expect(page.getByRole("status").filter({ hasText: "Pedido formal creado" })).toBeVisible();
  const link = checked(await owner.client.from("business_quote_orders").select("order_id").eq("quote_id", quoteId).single());
  const order = checked(await owner.client.from("orders").select("id,order_number,status,grand_total,organization_id,shipping_address,billing_address").eq("id", link.order_id).single());
  expect(order).toMatchObject({ status: "pending_payment", grand_total: 216.5, organization_id: organizationId, shipping_address: shipping, billing_address: billing });
  expect(checked(await owner.client.from("order_items").select("unit_price,quantity").eq("order_id", order.id))).toMatchObject([{ unit_price: 108.25, quantity: 2 }]);
  expect(checked(await owner.client.from("payment_transactions").select("status,amount").eq("order_id", order.id))).toMatchObject([{ status: "pending", amount: 216.5 }]);
  const advanceKey = await page.locator('input[name="idempotencyKey"]').inputValue();
  expect((await buyer.client.rpc("resolve_business_order_demo_payment", {
    p_order_id: order.id, p_outcome: "approved", p_idempotency_key: advanceKey,
  })).error?.code).toBe("42501");
  await page.getByRole("button", { name: "Simular anticipo aprobado" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Anticipo demo aprobado" })).toBeVisible();
  expect(checked(await owner.client.rpc("resolve_business_order_demo_payment", {
    p_order_id: order.id, p_outcome: "approved", p_idempotency_key: advanceKey,
  }))).toMatchObject([{ payment_status: "paid", replayed: true }]);
  expect((await owner.client.rpc("resolve_business_order_demo_payment", {
    p_order_id: order.id, p_outcome: "failed", p_idempotency_key: advanceKey,
  })).error?.code).toBe("23505");
  expect(checked(await owner.client.from("orders").select("status").eq("id", order.id))).toMatchObject([{ status: "paid" }]);
  expect(checked(await owner.client.from("payment_transactions").select("status,amount").eq("order_id", order.id))).toMatchObject([{ status: "paid", amount: 216.5 }]);
  expect(checked(await owner.client.from("order_events").select("event_key").eq("order_id", order.id).eq("event_key", "business_advance_paid"))).toHaveLength(1);
  expect(checked(await owner.client.from("crm_activities").select("event_key").eq("organization_id", organizationId).eq("event_key", "business_advance_paid"))).toHaveLength(1);
  const payload = { p_quote_id: quoteId, p_shipping_address: shipping, p_billing_address: billing };
  expect(checked(await owner.client.rpc("create_business_order_from_accepted_quote", payload))).toMatchObject([{ order_id: order.id }]);
  expect((await owner.client.rpc("create_business_order_from_accepted_quote", { ...payload, p_shipping_address: { ...shipping, city: "Toledo" } })).error?.code).toBe("23505");
  await page.reload();
  await expect(page.getByText(order.order_number, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Emitir pedido formal" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simular anticipo aprobado" })).toHaveCount(0);
  expect(sql(`select reserved from public.inventory where variant_id='${variant.id}';`)).toBe("2");
  for (const member of [buyer, viewer]) {
    expect(checked(await member.client.from("orders").select("id").eq("id", order.id))).toEqual([{ id: order.id }]);
    expect((await member.client.rpc("create_business_order_from_accepted_quote", payload)).error?.code).toBe("42501");
  }
  for (const table of ["orders", "business_quote_orders", "order_items", "payment_transactions"]) {
    const column = table === "orders" ? "id" : "order_id";
    expect(checked(await outsider.client.from(table).select("*").eq(column, order.id))).toEqual([]);
  }
  expect((await outsider.client.rpc("create_business_order_from_accepted_quote", payload)).error?.code).toBe("42501");
  const viewerContext = await browser.newContext();
  try {
    const viewerPage = await viewerContext.newPage();
    await signIn(viewerPage, viewer);
    await viewerPage.goto(`/empresas/portal?organization=${organizationId}`);
    await expect(viewerPage.getByText(order.order_number, { exact: true })).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "Emitir pedido formal" })).toHaveCount(0);
  } finally { await viewerContext.close(); }
  expect(sql(`select public.fulfill_order('${order.id}');`)).toBe("shipped");
  expect(checked(await owner.client.from("orders").select("status").eq("id", order.id))).toMatchObject([{ status: "shipped" }]);
  expect(sql(`select on_hand from public.inventory where variant_id='${variant.id}';`)).toBe("1");
  expect(sql(`select reserved from public.inventory where variant_id='${variant.id}';`)).toBe("0");
  const declinedQuote = await offer(1);
  checked(await owner.client.rpc("respond_to_business_quote", { p_quote_id: declinedQuote, p_decision: "accepted" }));
  await page.goto(`/empresas/portal?organization=${organizationId}`);
  await fillOrder(page, declinedQuote);
  const declineKey = await page.locator('input[name="idempotencyKey"]').inputValue();
  await page.getByRole("button", { name: "Simular rechazo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Anticipo demo rechazado" })).toBeVisible();
  const declinedLink = checked(await owner.client.from("business_quote_orders").select("order_id").eq("quote_id", declinedQuote).single());
  expect(checked(await owner.client.rpc("resolve_business_order_demo_payment", {
    p_order_id: declinedLink.order_id, p_outcome: "failed", p_idempotency_key: declineKey,
  }))).toMatchObject([{ payment_status: "failed", replayed: true }]);
  expect((await owner.client.rpc("resolve_business_order_demo_payment", {
    p_order_id: declinedLink.order_id, p_outcome: "approved", p_idempotency_key: declineKey,
  })).error?.code).toBe("23505");
  expect(checked(await owner.client.from("orders").select("status").eq("id", declinedLink.order_id))).toMatchObject([{ status: "cancelled" }]);
  expect(checked(await owner.client.from("payment_transactions").select("status").eq("order_id", declinedLink.order_id))).toMatchObject([{ status: "failed" }]);
  expect(sql(`select count(*) from public.inventory_reservations ir join public.order_items oi on oi.id=ir.order_item_id where oi.order_id='${declinedLink.order_id}' and ir.released_at is not null;`)).toBe("1");
  const shortageQuote = await offer(2);
  checked(await owner.client.rpc("respond_to_business_quote", { p_quote_id: shortageQuote, p_decision: "accepted" }));
  await page.goto(`/empresas/portal?organization=${organizationId}`);
  await fillOrder(page, shortageQuote);
  await expect(page.getByRole("alert").filter({ hasText: "El stock disponible ya no cubre" })).toBeVisible();
  expect(checked(await owner.client.from("business_quote_orders").select("order_id").eq("quote_id", shortageQuote))).toEqual([]);
  expect(sql(`select reserved from public.inventory where variant_id='${variant.id}';`)).toBe("0");
  expect(sql(`select count(*) from public.inventory_reservations ir join public.order_items oi on oi.id=ir.order_item_id where oi.order_id='${order.id}';`)).toBe("1");
});
