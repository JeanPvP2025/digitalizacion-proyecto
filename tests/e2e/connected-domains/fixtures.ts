import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ConnectedDomainUser = { id?: string; email: string; password: string; name: string };
export type ConnectedDomainsFixtures = {
  runId: string;
  users: {
    businessOwner: ConnectedDomainUser;
    businessViewer: ConnectedDomainUser;
    emptyBusinessOwner: ConnectedDomainUser;
    supportAgent: ConnectedDomainUser;
    superAdmin: ConnectedDomainUser;
  };
  organizations: { business: string; empty: string };
  product: { id: string; variantId: string; sku: string; slug: string; name: string; title: string; price: number; taxRate: number };
  quoteId: string;
  accountOrders: {
    owner: { id: string; number: string; itemId: string };
    other: { id: string; number: string; itemId: string };
  };
  analytics: {
    warehouseId: string;
    paidOrderId: string;
    failedOrderId: string;
    inconsistentOrderId: string;
    convertedInquiryId: string;
    newInquiryId: string;
  };
};

const fixturePath = path.join(process.cwd(), ".data", "connected-domains-fixtures.json");
const testPassword = "Nodria-Connected-Domains-2026!";

function runLocalSql(sql: string) {
  return execFileSync("docker.exe", [
    "exec", "-i", "supabase_db_nodria-commerce", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A",
  ], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function uuidArray(values: string[]) {
  const valid = values.filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  return valid.length ? "array[" + valid.map((value) => "'" + value + "'::uuid").join(",") + "]" : "array[]::uuid[]";
}

function textArray(values: string[]) {
  const valid = values.filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  return valid.length ? "array[" + valid.map((value) => "'" + value + "'").join(",") + "]::text[]" : "array[]::text[]";
}

function sqlLiteral(value: string) {
  return "'" + value.replaceAll("'", "''") + "'";
}

function assertFixtureId(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error("Invalid connected domain fixture id.");
}

function readReviewWhere(column: "id" | "order_item_id", id: string) {
  assertFixtureId(id);
  const rows = JSON.parse(runLocalSql([
    "select coalesce(json_agg(row_to_json(review)), '[]'::json)::text",
    "from (select id, status, author_id, order_item_id, moderated_by from public.product_reviews",
    "where " + column + " = " + sqlLiteral(id) + "::uuid) as review;",
  ].join(" "))) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function readReviewByOrderItem(orderItemId: string) {
  return readReviewWhere("order_item_id", orderItemId);
}

export function readReviewById(reviewId: string) {
  return readReviewWhere("id", reviewId);
}

export function readSupportMessages(ticketId: string) {
  assertFixtureId(ticketId);
  return JSON.parse(runLocalSql([
    "select coalesce(json_agg(row_to_json(message)), '[]'::json)::text",
    "from (select author_type, body, is_internal from public.support_messages",
    "where ticket_id = " + sqlLiteral(ticketId) + "::uuid order by created_at) as message;",
  ].join(" "))) as Array<{ author_type: string; body: string; is_internal: boolean }>;
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing test-only local Supabase credentials.");
  const parsedUrl = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname) || parsedUrl.port !== "56201") {
    throw new Error("Refusing to access non-local Supabase from connected domain E2E.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function createUserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing test-only local Supabase browser credentials.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function loadFixtures(): Promise<ConnectedDomainsFixtures> {
  return JSON.parse(await readFile(fixturePath, "utf8")) as ConnectedDomainsFixtures;
}

export async function writeFixtures(fixtures: ConnectedDomainsFixtures) {
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, JSON.stringify(fixtures, null, 2), { mode: 0o600 });
}

export function emptyFixtures(): ConnectedDomainsFixtures {
  const runId = randomUUID();
  const makeUser = (label: string, name: string): ConnectedDomainUser => ({
    email: "connected-" + label + "-" + runId + "@nodria.test",
    password: testPassword,
    name,
  });
  return {
    runId,
    users: {
      businessOwner: makeUser("business-owner", "NODRIA QA Business Owner"),
      businessViewer: makeUser("business-viewer", "NODRIA QA Business Viewer"),
      emptyBusinessOwner: makeUser("empty-business", "NODRIA QA Empty Business"),
      supportAgent: makeUser("support-agent", "NODRIA QA Support Agent"),
      superAdmin: makeUser("super-admin", "NODRIA QA Super Admin"),
    },
    organizations: { business: randomUUID(), empty: randomUUID() },
    product: { id: "", variantId: "", sku: "", slug: "", name: "", title: "", price: 0, taxRate: 0.21 },
    quoteId: randomUUID(),
    accountOrders: {
      owner: { id: randomUUID(), number: "NDR-E2E-" + runId.slice(0, 8).toUpperCase(), itemId: randomUUID() },
      other: { id: randomUUID(), number: "NDR-E2E-" + runId.slice(9, 17).toUpperCase(), itemId: randomUUID() },
    },
    analytics: {
      warehouseId: randomUUID(),
      paidOrderId: randomUUID(),
      failedOrderId: randomUUID(),
      inconsistentOrderId: randomUUID(),
      convertedInquiryId: randomUUID(),
      newInquiryId: randomUUID(),
    },
  };
}

async function createUsers(admin: SupabaseClient, fixtures: ConnectedDomainsFixtures) {
  for (const user of Object.values(fixtures.users)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.name },
    });
    if (error || !data.user) throw error ?? new Error("Supabase did not return a fixture user.");
    user.id = data.user.id;
    await writeFixtures(fixtures);
  }
}

function insertDeliveredOrder(fixtures: ConnectedDomainsFixtures, order: ConnectedDomainsFixtures["accountOrders"]["owner"], user: ConnectedDomainUser) {
  if (!user.id) throw new Error("A fixture order requires an Auth user id.");
  return [
    "insert into public.orders (id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency, subtotal, tax_total, shipping_total, discount_total, grand_total, shipping_address, billing_address, placed_at, delivered_at)",
    "values (" + [
      sqlLiteral(order.id) + "::uuid",
      sqlLiteral(order.number),
      sqlLiteral(user.id) + "::uuid",
      sqlLiteral("cd-" + fixtures.runId + "-" + order.id.slice(0, 8)),
      "repeat(md5(" + sqlLiteral(order.id) + "), 2)",
      "'delivered'",
      "'EUR'",
      fixtures.product.price.toFixed(2),
      "0", "0", "0",
      fixtures.product.price.toFixed(2),
      "'{}'::jsonb", "'{}'::jsonb",
      "now() - interval '2 days'",
      "now() - interval '1 day'",
    ].join(", ") + ");",
    "insert into public.order_items (id, order_id, variant_id, product_id, product_name, product_sku, variant_title, variant_attributes, quantity, unit_price, currency, tax_rate)",
    "values (" + [
      sqlLiteral(order.itemId) + "::uuid",
      sqlLiteral(order.id) + "::uuid",
      sqlLiteral(fixtures.product.variantId) + "::uuid",
      sqlLiteral(fixtures.product.id),
      sqlLiteral(fixtures.product.name),
      sqlLiteral(fixtures.product.sku),
      sqlLiteral(fixtures.product.title),
      "'{}'::jsonb",
      "1",
      fixtures.product.price.toFixed(2),
      "'EUR'",
      fixtures.product.taxRate.toFixed(4),
    ].join(", ") + ");",
  ].join("\n");
}

async function createCoreFixtures(admin: SupabaseClient, fixtures: ConnectedDomainsFixtures) {
  const variantResult = await admin.from("product_variants")
    .select("id, product_id, sku, title, current_price, currency, tax_rate")
    .eq("sku", "NOD-FS-02")
    .single();
  if (variantResult.error || !variantResult.data) throw variantResult.error ?? new Error("Seed product NOD-FS-02 is missing.");
  const productResult = await admin.from("products").select("name, slug").eq("id", variantResult.data.product_id).single();
  if (productResult.error || !productResult.data) throw productResult.error ?? new Error("Seed product metadata is missing.");

  fixtures.product = {
    id: String(variantResult.data.product_id),
    variantId: String(variantResult.data.id),
    sku: String(variantResult.data.sku),
    slug: String(productResult.data.slug),
    name: String(productResult.data.name),
    title: String(variantResult.data.title),
    price: Number(variantResult.data.current_price),
    taxRate: Number(variantResult.data.tax_rate),
  };
  await writeFixtures(fixtures);

  const ownerId = String(fixtures.users.businessOwner.id);
  const viewerId = String(fixtures.users.businessViewer.id);
  const emptyOwnerId = String(fixtures.users.emptyBusinessOwner.id);
  const supportAgentId = String(fixtures.users.supportAgent.id);
  const superAdminId = String(fixtures.users.superAdmin.id);
  const lineSubtotal = Math.round(fixtures.product.price / (1 + fixtures.product.taxRate) * 100) / 100;
  const taxTotal = Math.round((fixtures.product.price - lineSubtotal) * 100) / 100;
  const runId = sqlLiteral(fixtures.runId);

  const sql = [
    "begin;",
    "insert into public.user_role_grants (user_id, role, granted_by) values",
    "(" + sqlLiteral(supportAgentId) + "::uuid, 'support_agent', " + sqlLiteral(supportAgentId) + "::uuid),",
    "(" + sqlLiteral(superAdminId) + "::uuid, 'super_admin', " + sqlLiteral(superAdminId) + "::uuid);",
    "insert into public.organizations (id, slug, legal_name, display_name, created_by) values",
    "(" + sqlLiteral(fixtures.organizations.business) + "::uuid, 'e2e-business-" + fixtures.runId.slice(0, 8) + "', 'NODRIA E2E Business SL', 'NODRIA E2E Business', " + sqlLiteral(ownerId) + "::uuid),",
    "(" + sqlLiteral(fixtures.organizations.empty) + "::uuid, 'e2e-empty-" + fixtures.runId.slice(0, 8) + "', 'NODRIA E2E Empty SL', 'NODRIA E2E Empty', " + sqlLiteral(emptyOwnerId) + "::uuid);",
    "insert into public.organization_memberships (organization_id, user_id, role, added_by) values",
    "(" + sqlLiteral(fixtures.organizations.business) + "::uuid, " + sqlLiteral(ownerId) + "::uuid, 'owner', " + sqlLiteral(ownerId) + "::uuid),",
    "(" + sqlLiteral(fixtures.organizations.business) + "::uuid, " + sqlLiteral(viewerId) + "::uuid, 'viewer', " + sqlLiteral(ownerId) + "::uuid),",
    "(" + sqlLiteral(fixtures.organizations.empty) + "::uuid, " + sqlLiteral(emptyOwnerId) + "::uuid, 'owner', " + sqlLiteral(emptyOwnerId) + "::uuid);",
    "insert into public.quotes (id, requested_by, organization_id, status, currency, request_note, requester_name, requester_email, organization_name_snapshot, subtotal, tax_total, grand_total)",
    "values (" + sqlLiteral(fixtures.quoteId) + "::uuid, " + sqlLiteral(ownerId) + "::uuid, " + sqlLiteral(fixtures.organizations.business) + "::uuid, 'accepted', 'EUR', 'Fixture conectada B2B de QA', " + sqlLiteral(fixtures.users.businessOwner.name) + ", " + sqlLiteral(fixtures.users.businessOwner.email) + ", 'NODRIA E2E Business', " + lineSubtotal.toFixed(2) + ", " + taxTotal.toFixed(2) + ", " + fixtures.product.price.toFixed(2) + ");",
    "insert into public.quote_items (quote_id, variant_id, product_id, product_name, product_sku, variant_title, variant_attributes, quantity, requested_unit_price, offered_unit_price, tax_rate, currency)",
    "values (" + sqlLiteral(fixtures.quoteId) + "::uuid, " + sqlLiteral(fixtures.product.variantId) + "::uuid, " + sqlLiteral(fixtures.product.id) + ", " + sqlLiteral(fixtures.product.name) + ", " + sqlLiteral(fixtures.product.sku) + ", " + sqlLiteral(fixtures.product.title) + ", '{}'::jsonb, 1, " + fixtures.product.price.toFixed(2) + ", null, " + fixtures.product.taxRate.toFixed(4) + ", 'EUR');",
    insertDeliveredOrder(fixtures, fixtures.accountOrders.owner, fixtures.users.businessOwner),
    insertDeliveredOrder(fixtures, fixtures.accountOrders.other, fixtures.users.supportAgent),
    "insert into public.crm_activities (organization_id, quote_id, actor_user_id, event_key, title, subject_name, company_snapshot, body, visibility, details)",
    "values (" + sqlLiteral(fixtures.organizations.business) + "::uuid, " + sqlLiteral(fixtures.quoteId) + "::uuid, " + sqlLiteral(ownerId) + "::uuid, 'quote_accepted', 'Propuesta aceptada', " + sqlLiteral(fixtures.users.businessOwner.name) + ", 'NODRIA E2E Business', 'Oferta aceptada para fixture QA.', 'organization', jsonb_build_object('status', 'accepted', 'fixture', " + runId + "));",
    "commit;",
  ].join("\n");
  runLocalSql(sql);
}

export async function createFixtures(admin: SupabaseClient, fixtures: ConnectedDomainsFixtures) {
  await writeFixtures(fixtures);
  await createUsers(admin, fixtures);
  await createCoreFixtures(admin, fixtures);
  await writeFixtures(fixtures);
}

export async function createAnalyticsFixtures(fixtures: ConnectedDomainsFixtures) {
  const ownerId = fixtures.users.businessOwner.id;
  if (!ownerId) throw new Error("Analytics fixtures need a signed-in test user id.");
  const warehouseCode = "E2E-" + fixtures.runId.slice(0, 8).toUpperCase();
  const paidKey = "cd-analytics-paid-" + fixtures.runId;
  const failedKey = "cd-analytics-failed-" + fixtures.runId;
  const amount = "120.50";
  const sql = [
    "begin;",
    "insert into public.warehouses (id, code, name, city, country_code, is_active) values (" + sqlLiteral(fixtures.analytics.warehouseId) + "::uuid, " + sqlLiteral(warehouseCode) + ", 'NODRIA E2E Analytics', 'Madrid', 'ES', true);",
    "insert into public.inventory (warehouse_id, variant_id, on_hand, reserved) values (" + sqlLiteral(fixtures.analytics.warehouseId) + "::uuid, " + sqlLiteral(fixtures.product.variantId) + "::uuid, 9, 2);",
    "insert into public.orders (id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency, subtotal, tax_total, shipping_total, discount_total, grand_total, shipping_address, billing_address, placed_at) values",
    "(" + sqlLiteral(fixtures.analytics.paidOrderId) + "::uuid, 'NDR-AN-P-' || upper(substr(replace(" + sqlLiteral(fixtures.runId) + ", '-', ''), 1, 8)), " + sqlLiteral(ownerId) + "::uuid, " + sqlLiteral(paidKey) + ", repeat(md5(" + sqlLiteral(paidKey) + "), 2), 'paid', 'EUR', " + amount + ", 0, 0, 0, " + amount + ", '{}'::jsonb, '{}'::jsonb, now()),",
    "(" + sqlLiteral(fixtures.analytics.failedOrderId) + "::uuid, 'NDR-AN-F-' || upper(substr(replace(" + sqlLiteral(fixtures.runId) + ", '-', ''), 1, 8)), " + sqlLiteral(ownerId) + "::uuid, " + sqlLiteral(failedKey) + ", repeat(md5(" + sqlLiteral(failedKey) + "), 2), 'cancelled', 'EUR', '50.00', 0, 0, 0, '50.00', '{}'::jsonb, '{}'::jsonb, now());",
    "insert into public.payment_transactions (order_id, provider, status, amount, currency, processed_at) values",
    "(" + sqlLiteral(fixtures.analytics.paidOrderId) + "::uuid, 'demo', 'paid', " + amount + ", 'EUR', now()),",
    "(" + sqlLiteral(fixtures.analytics.failedOrderId) + "::uuid, 'demo', 'failed', '50.00', 'EUR', now());",
    "insert into public.order_events (order_id, event_key, note, details, occurred_at) values",
    "(" + sqlLiteral(fixtures.analytics.paidOrderId) + "::uuid, 'payment_paid', 'Fixture QA de pago', jsonb_build_object('fixture', " + sqlLiteral(fixtures.runId) + "), now()),",
    "(" + sqlLiteral(fixtures.analytics.failedOrderId) + "::uuid, 'payment_failed', 'Fixture QA de rechazo', jsonb_build_object('fixture', " + sqlLiteral(fixtures.runId) + "), now());",
    "insert into public.quote_inquiries (id, created_by, contact_name, email, company, message, consent_to_contact, status, source, created_at) values",
    "(" + sqlLiteral(fixtures.analytics.convertedInquiryId) + "::uuid, " + sqlLiteral(ownerId) + "::uuid, 'NODRIA QA Converted', " + sqlLiteral("converted-" + fixtures.runId + "@nodria.test") + ", 'NODRIA QA', 'Solicitud convertida para validar el KPI.', true, 'converted', 'connected-domains-e2e', now()),",
    "(" + sqlLiteral(fixtures.analytics.newInquiryId) + "::uuid, " + sqlLiteral(ownerId) + "::uuid, 'NODRIA QA New', " + sqlLiteral("new-" + fixtures.runId + "@nodria.test") + ", 'NODRIA QA', 'Solicitud abierta para validar el denominador.', true, 'new', 'connected-domains-e2e', now());",
    "commit;",
  ].join("\n");
  runLocalSql(sql);
}

export async function createInconsistentAnalyticsFixture(fixtures: ConnectedDomainsFixtures) {
  const ownerId = fixtures.users.businessOwner.id;
  if (!ownerId) throw new Error("Analytics fixtures need a signed-in test user id.");
  const key = "cd-analytics-inconsistent-" + fixtures.runId;
  runLocalSql([
    "begin;",
    "insert into public.orders (id, order_number, customer_id, idempotency_key, checkout_fingerprint, status, currency, subtotal, tax_total, shipping_total, discount_total, grand_total, shipping_address, billing_address, placed_at)",
    "values (" + sqlLiteral(fixtures.analytics.inconsistentOrderId) + "::uuid, 'NDR-AN-X-' || upper(substr(replace(" + sqlLiteral(fixtures.runId) + ", '-', ''), 1, 8)), " + sqlLiteral(ownerId) + "::uuid, " + sqlLiteral(key) + ", repeat(md5(" + sqlLiteral(key) + "), 2), 'paid', 'EUR', '9.00', 0, 0, 0, '9.00', '{}'::jsonb, '{}'::jsonb, now());",
    "insert into public.payment_transactions (order_id, provider, status, amount, currency, processed_at) values (" + sqlLiteral(fixtures.analytics.inconsistentOrderId) + "::uuid, 'demo', 'failed', '9.00', 'EUR', now());",
    "insert into public.order_events (order_id, event_key, note, details, occurred_at) values (" + sqlLiteral(fixtures.analytics.inconsistentOrderId) + "::uuid, 'payment_paid', 'Fixture inconsistente deliberada de QA', jsonb_build_object('fixture', " + sqlLiteral(fixtures.runId) + "), now());",
    "commit;",
  ].join("\n"));
}

export async function cleanupFixtures(admin: SupabaseClient, fixtures: ConnectedDomainsFixtures) {
  const users = Object.values(fixtures.users).flatMap((user) => user.id ? [user.id] : []);
  const userIds = uuidArray(users);
  const organizationIds = uuidArray([fixtures.organizations.business, fixtures.organizations.empty]);
  const quoteIds = uuidArray([fixtures.quoteId]);
  const orderIds = uuidArray([
    fixtures.accountOrders.owner.id,
    fixtures.accountOrders.other.id,
    fixtures.analytics.paidOrderId,
    fixtures.analytics.failedOrderId,
    fixtures.analytics.inconsistentOrderId,
  ]);
  const orderItemIds = uuidArray([fixtures.accountOrders.owner.itemId, fixtures.accountOrders.other.itemId]);
  const warehouseIds = uuidArray([fixtures.analytics.warehouseId]);
  const inquiryIds = uuidArray([fixtures.analytics.convertedInquiryId, fixtures.analytics.newInquiryId]);
  const allOrderIdStrings = textArray([
    fixtures.accountOrders.owner.id,
    fixtures.accountOrders.other.id,
    fixtures.analytics.paidOrderId,
    fixtures.analytics.failedOrderId,
    fixtures.analytics.inconsistentOrderId,
  ]);

  runLocalSql([
    "begin;",
    "alter table public.orders disable trigger user;",
    "alter table public.inventory disable trigger user;",
    "delete from public.audit_events where (entity_type = 'orders' and entity_id = any(" + allOrderIdStrings + ")) or entity_id in (select id::text from public.business_quote_conversions where quote_id = any(" + quoteIds + "));",
    "delete from public.product_reviews where author_id = any(" + userIds + ") or order_item_id = any(" + orderItemIds + ");",
    "delete from public.support_messages where ticket_id in (select id from public.support_tickets where customer_id = any(" + userIds + "));",
    "delete from public.support_ticket_events where ticket_id in (select id from public.support_tickets where customer_id = any(" + userIds + "));",
    "delete from public.support_tickets where customer_id = any(" + userIds + ");",
    "delete from public.crm_activities where organization_id = any(" + organizationIds + ") or quote_id = any(" + quoteIds + ") or quote_inquiry_id = any(" + inquiryIds + ");",
    "delete from public.business_quote_conversions where quote_id = any(" + quoteIds + ");",
    "delete from public.quote_items where quote_id = any(" + quoteIds + ");",
    "delete from public.quotes where id = any(" + quoteIds + ");",
    "delete from public.organization_memberships where organization_id = any(" + organizationIds + ") or user_id = any(" + userIds + ");",
    "delete from public.organizations where id = any(" + organizationIds + ");",
    "delete from public.inventory_reservations where order_item_id = any(" + orderItemIds + ");",
    "delete from public.payment_transactions where order_id = any(" + orderIds + ");",
    "delete from public.order_events where order_id = any(" + orderIds + ");",
    "delete from private.demo_payment_attempts where order_id = any(" + orderIds + ");",
    "delete from public.order_items where id = any(" + orderItemIds + ") or order_id = any(" + orderIds + ");",
    "delete from public.orders where id = any(" + orderIds + ");",
    "delete from public.quote_inquiries where id = any(" + inquiryIds + ");",
    "delete from public.inventory where warehouse_id = any(" + warehouseIds + ");",
    "delete from public.warehouses where id = any(" + warehouseIds + ");",
    "delete from public.user_role_grants where user_id = any(" + userIds + ");",
    "alter table public.inventory enable trigger user;",
    "alter table public.orders enable trigger user;",
    "commit;",
  ].join("\n"));

  for (const userId of users) {
    assertFixtureId(userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && error.code !== "user_not_found") throw error;
  }
}
