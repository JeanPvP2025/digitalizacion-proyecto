import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CheckoutConnectedUser = { email: string; password: string; name: string };
export type CheckoutFixtureKey = "approved" | "declined" | "retry" | "race";
export type CheckoutCatalogFixture = { productId: string; variantId: string; sku: string };
export type CheckoutConnectedFixtures = {
  catalog: Record<CheckoutFixtureKey, CheckoutCatalogFixture>;
  warehouseId: string;
  unitPrice: number;
  users: {
    approved: CheckoutConnectedUser;
    declined: CheckoutConnectedUser;
    retry: CheckoutConnectedUser;
    raceA: CheckoutConnectedUser;
    raceB: CheckoutConnectedUser;
  };
};

const fixturePath = path.join(process.cwd(), ".data", "checkout-connected-fixtures.json");
const testPassword = "Nodria-E2E-Fictional-2026!";
const unitPrice = 41.25;

function runLocalSql(sql: string) {
  return execFileSync("docker.exe", [
    "exec", "-i", "supabase_db_nodria-commerce", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A",
  ], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function assertSqlIdentifier(value: string, label: string) {
  if (!/^[a-z0-9-]{1,80}$/i.test(value)) throw new Error(`Invalid fixture ${label}.`);
}

export function setFixtureStock(variantId: string, onHand: number, reserved: number) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId) || !Number.isInteger(onHand) || !Number.isInteger(reserved)) {
    throw new Error("Invalid local checkout stock fixture values.");
  }
  runLocalSql(`update public.inventory set on_hand = ${onHand}, reserved = ${reserved} where variant_id = '${variantId}';`);
}

export function readFixtureInventory(variantId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(variantId)) throw new Error("Invalid local checkout variant id.");
  const output = runLocalSql(`select coalesce(json_agg(json_build_object('on_hand', on_hand, 'reserved', reserved, 'warehouse_id', warehouse_id)), '[]'::json)::text from public.inventory where variant_id = '${variantId}';`);
  return JSON.parse(output) as Array<{ on_hand: number; reserved: number; warehouse_id: string }>;
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing test-only local Supabase credentials.");
  const parsedUrl = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname) || parsedUrl.port !== "56201") {
    throw new Error("Refusing to access non-local Supabase from checkout connected E2E.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function loadFixtures(): Promise<CheckoutConnectedFixtures> {
  return JSON.parse(await readFile(fixturePath, "utf8")) as CheckoutConnectedFixtures;
}

export async function writeFixtures(fixtures: CheckoutConnectedFixtures) {
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, JSON.stringify(fixtures, null, 2), { mode: 0o600 });
}

export function emptyFixtures(): CheckoutConnectedFixtures {
  const id = randomUUID();
  const makeUser = (label: string): CheckoutConnectedUser => ({
    email: `checkout-${label}-${id}@nodria.test`,
    password: testPassword,
    name: `NODRIA Checkout ${label}`,
  });
  return {
    catalog: Object.fromEntries(([
      "approved", "declined", "retry", "race",
    ] as CheckoutFixtureKey[]).map((key) => [key, {
      productId: `e2e-${key}-${id}`,
      variantId: "",
      sku: `E2E-${key.toUpperCase()}-${id.replaceAll("-", "").toUpperCase()}`,
    }])) as Record<CheckoutFixtureKey, CheckoutCatalogFixture>,
    warehouseId: "",
    unitPrice,
    users: {
      approved: makeUser("approved"),
      declined: makeUser("declined"),
      retry: makeUser("retry"),
      raceA: makeUser("race-a"),
      raceB: makeUser("race-b"),
    },
  };
}

export async function cleanupFixtures(admin: SupabaseClient, fixtures: CheckoutConnectedFixtures) {
  const userIds: string[] = [];
  const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  for (const user of Object.values(fixtures.users)) {
    const found = listedUsers.users.find((candidate) => candidate.email === user.email);
    if (found) userIds.push(found.id);
  }

  if (userIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Invalid Auth user id during fixture cleanup.");
  if (fixtures.warehouseId && !/^[0-9a-f-]{36}$/i.test(fixtures.warehouseId)) throw new Error("Invalid fixture warehouse id during cleanup.");
  const legacyFixtures = fixtures as CheckoutConnectedFixtures & { productId?: string; variantId?: string; variantSku?: string };
  const catalogFixtures = fixtures.catalog
    ? Object.values(fixtures.catalog)
    : [{ productId: legacyFixtures.productId ?? "", variantId: legacyFixtures.variantId ?? "", sku: legacyFixtures.variantSku ?? "" }];
  for (const catalog of catalogFixtures) {
    if (catalog.variantId && !/^[0-9a-f-]{36}$/i.test(catalog.variantId)) throw new Error("Invalid fixture variant id during cleanup.");
    if (catalog.productId) assertSqlIdentifier(catalog.productId, "product id");
  }
  const variantArray = catalogFixtures.some((catalog) => catalog.variantId)
    ? `array[${catalogFixtures.filter((catalog) => catalog.variantId).map((catalog) => `'${catalog.variantId}'::uuid`).join(",")}]`
    : "array[]::uuid[]";
  const auditCatalogPredicates = catalogFixtures.flatMap((catalog) => [
    catalog.variantId ? `(entity_type = 'product_variants' and entity_id = '${catalog.variantId}')` : "",
    catalog.productId ? `(entity_type = 'products' and entity_id = '${catalog.productId}')` : "",
    catalog.variantId && fixtures.warehouseId ? `(entity_type = 'inventory' and entity_id = '${fixtures.warehouseId}:${catalog.variantId}')` : "",
  ]).filter(Boolean).join(" or ") || "false";
  const productArray = `array[${catalogFixtures.filter((catalog) => catalog.productId).map((catalog) => `'${catalog.productId}'`).join(",")}]::text[]`;
  const userArray = userIds.length ? `array[${userIds.map((id) => `'${id}'::uuid`).join(",")}]` : "array[]::uuid[]";
  runLocalSql(`
    begin;
    alter table public.orders disable trigger user;
    alter table public.payment_transactions disable trigger user;
    alter table public.inventory_reservations disable trigger user;
    alter table public.inventory disable trigger user;
    alter table public.product_variants disable trigger user;
    alter table public.products disable trigger user;
    delete from public.audit_events where
      (entity_type = 'orders' and entity_id in (select id::text from public.orders where customer_id = any(${userArray})))
      or (entity_type = 'payment_transactions' and entity_id in (select pt.id::text from public.payment_transactions pt join public.orders o on o.id = pt.order_id where o.customer_id = any(${userArray})))
      or (entity_type = 'inventory_reservations' and entity_id in (select ir.id::text from public.inventory_reservations ir join public.order_items oi on oi.id = ir.order_item_id join public.orders o on o.id = oi.order_id where o.customer_id = any(${userArray})))
      or (${auditCatalogPredicates});
    delete from public.inventory_reservations where order_item_id in (
      select id from public.order_items where order_id in (select id from public.orders where customer_id = any(${userArray}))
    );
    delete from public.payment_transactions where order_id in (select id from public.orders where customer_id = any(${userArray}));
    delete from public.order_events where order_id in (select id from public.orders where customer_id = any(${userArray}));
    delete from private.demo_payment_attempts where order_id in (select id from public.orders where customer_id = any(${userArray}));
    delete from public.order_items where order_id in (select id from public.orders where customer_id = any(${userArray}));
    delete from public.orders where customer_id = any(${userArray});
    delete from public.cart_items where cart_id in (select id from public.carts where user_id = any(${userArray}));
    delete from public.carts where user_id = any(${userArray});
    delete from public.inventory where variant_id = any(${variantArray});
    delete from public.product_variants where id = any(${variantArray});
    delete from public.products where id = any(${productArray});
    alter table public.orders enable trigger user;
    alter table public.payment_transactions enable trigger user;
    alter table public.inventory_reservations enable trigger user;
    alter table public.inventory enable trigger user;
    alter table public.product_variants enable trigger user;
    alter table public.products enable trigger user;
    commit;
  `);
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}

export async function createFixtures(admin: SupabaseClient, fixtures: CheckoutConnectedFixtures) {
  const { data: warehouse, error: warehouseError } = await admin.from("warehouses")
    .select("id").eq("code", "MAD-CENTRAL").eq("is_active", true).single();
  if (warehouseError) throw warehouseError;
  fixtures.warehouseId = warehouse.id as string;
  await writeFixtures(fixtures);

  assertSqlIdentifier(fixtures.warehouseId, "warehouse id");
  for (const [key, catalog] of Object.entries(fixtures.catalog) as [CheckoutFixtureKey, CheckoutCatalogFixture][]) {
    const { error: productError } = await admin.from("products").insert({
      id: catalog.productId,
      slug: catalog.productId,
      sku: catalog.sku,
      name: `NODRIA Checkout Fixture ${key}`,
      brand: "NODRIA E2E",
      summary: "Fictional local checkout test product.",
      description: "Created and removed by the connected checkout browser suite.",
      image_alt: "",
      is_published: true,
      published_at: new Date().toISOString(),
    });
    if (productError) throw productError;
    await writeFixtures(fixtures);

    const { data: variant, error: variantError } = await admin.from("product_variants").insert({
      product_id: catalog.productId,
      sku: catalog.sku,
      title: "E2E variant",
      attributes: { fixture: "checkout-connected" },
      current_price: fixtures.unitPrice,
      currency: "EUR",
      tax_rate: 0.21,
      is_active: true,
    }).select("id").single();
    if (variantError) throw variantError;
    catalog.variantId = variant.id as string;
    await writeFixtures(fixtures);
    if (!/^[0-9a-f-]{36}$/i.test(catalog.variantId)) throw new Error("Invalid fixture variant id.");
    runLocalSql(`insert into public.inventory (warehouse_id, variant_id, on_hand, reserved) values ('${fixtures.warehouseId}', '${catalog.variantId}', 30, 0);`);
  }

  for (const user of Object.values(fixtures.users)) {
    const { error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.name },
    });
    if (error) throw error;
  }
  await writeFixtures(fixtures);
}

export async function inspectOrder(admin: SupabaseClient, customerEmail: string, idempotencyKey: string, variantId: string) {
  const { data: users, error: userError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) throw userError;
  const user = users.users.find((candidate) => candidate.email === customerEmail);
  if (!user) throw new Error(`Missing test user ${customerEmail}.`);
  const { data: orders, error } = await admin.from("orders")
    .select("id,status,grand_total,currency,customer_id,idempotency_key")
    .eq("customer_id", user.id)
    .eq("idempotency_key", idempotencyKey);
  if (error) throw error;
  const order = orders?.[0];
  if (!order) return null;
  const orderId = order.id as string;
  const [items, payments, events, carts] = await Promise.all([
    admin.from("order_items").select("id,variant_id,quantity,unit_price,product_name,product_sku").eq("order_id", orderId),
    admin.from("payment_transactions").select("id,provider,status,amount,currency,provider_reference").eq("order_id", orderId),
    admin.from("order_events").select("id,event_key,note,details,occurred_at").eq("order_id", orderId).order("occurred_at").order("id"),
    admin.from("carts").select("id,status").eq("user_id", user.id),
  ]);
  for (const result of [items, payments, events, carts]) {
    if (result.error) throw result.error;
  }
  const itemIds = (items.data ?? []).map((item) => item.id as string);
  const reservations = itemIds.length
    ? await admin.from("inventory_reservations").select("id,warehouse_id,quantity,released_at,fulfilled_at,order_item_id").in("order_item_id", itemIds)
    : { data: [], error: null };
  if (reservations.error) throw reservations.error;
  const cartIds = (carts.data ?? []).map((cart) => cart.id as string);
  const cartItems = cartIds.length
    ? await admin.from("cart_items").select("id,variant_id,quantity,cart_id").in("cart_id", cartIds)
    : { data: [], error: null };
  if (cartItems.error) throw cartItems.error;
  return {
    order,
    items: items.data ?? [],
    payments: payments.data ?? [],
    reservations: reservations.data ?? [],
    events: events.data ?? [],
    inventory: readFixtureInventory(variantId),
    cartItems: cartItems.data ?? [],
    carts: carts.data ?? [],
  };
}
