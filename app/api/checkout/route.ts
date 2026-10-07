import { NextResponse } from "next/server";
import { z } from "zod";
import { consolidateCheckoutItems, CheckoutCartError, resolveCheckoutCartItems } from "@/lib/commerce/cart";
import { checkoutRequestSchema, type CheckoutRequest } from "@/lib/commerce/contracts";
import { getCheckoutMode } from "@/lib/commerce/mode";
import { demoProducts } from "@/lib/catalog";
import { pcBuilderComponents } from "@/lib/pc-builder";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { persistDemoOrder, type DemoOrderRecord } from "@/lib/server/demo-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const demoOrderStatusSchema = z.enum(["confirmed", "payment_processing", "pending"]);
const databaseOrderStatusSchema = z.enum(["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const amountSchema = z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite().nonnegative());
const databaseOrderSchema = z.object({
  id: z.uuid(),
  order_number: z.string().regex(/^NOD-\d{8}-[A-F0-9]{10}$/i),
  status: databaseOrderStatusSchema,
  grand_total: amountSchema,
  currency: currencySchema,
}).strict();
const rpcOrderSchema = z.array(z.object({
  order_id: z.uuid(),
  order_number: z.string().regex(/^NOD-\d{8}-[A-F0-9]{10}$/i),
  grand_total: amountSchema,
  currency: currencySchema,
}).strict()).length(1);
const variantRowsSchema = z.array(z.object({ id: z.uuid(), product_id: z.string().min(1) }).strict());
const cartRowsSchema = z.array(z.object({ variant_id: z.uuid() }).strict());
const cartIdSchema = z.uuid();

const MAX_ATTEMPTS_PER_MINUTE = 6;
type DemoRequestWithRequest = { data: CheckoutRequest; request: Request };

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-demo";
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function demoPaymentStatus(method: NonNullable<CheckoutRequest["paymentMethod"]>) {
  if (method === "approved") return "approved" as const;
  if (method === "processing") return "processing" as const;
  return method;
}

function checkoutErrorResponse(error: unknown) {
  if (error instanceof CheckoutCartError) {
    const status = error.code === "quantity_limit" ? 400 : 409;
    return NextResponse.json({ error: error.message }, { status });
  }

  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "unknown";
  console.error("NODRIA Supabase checkout operation failed", { code });

  if (code === "P0001") {
    return NextResponse.json({ error: "El precio o el stock ha cambiado. Revisa el catálogo y vuelve a intentarlo." }, { status: 409 });
  }
  if (code === "P0002") {
    return NextResponse.json({ error: "El carrito activo ha cambiado. Actualiza la página y vuelve a intentarlo." }, { status: 409 });
  }
  if (code === "42501") {
    return NextResponse.json({ error: "No se ha podido validar el acceso al carrito. Comprueba tu sesión." }, { status: 403 });
  }
  if (code === "23505") {
    return NextResponse.json({ error: "El pedido ya se está registrando. Repite la solicitud con la misma referencia." }, { status: 409 });
  }
  return NextResponse.json({ error: "No se ha podido confirmar el pedido con Supabase. Conserva la misma referencia al reintentar." }, { status: 503 });
}

async function getOrCreateActiveCart(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string) {
  const findCart = async () => {
    const { data, error } = await supabase.from("carts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const id = cartIdSchema.parse(data.id);
    return { id };
  };

  const existing = await findCart();
  if (existing) return existing;

  const { data, error } = await supabase.from("carts")
    .insert({ user_id: userId, status: "active", currency: "EUR" })
    .select("id")
    .single();
  if (!error && data) return { id: cartIdSchema.parse(data.id) };

  // A parallel checkout may win the partial unique index for one active cart per user.
  if (error?.code === "23505") {
    const racedCart = await findCart();
    if (racedCart) return racedCart;
  }
  if (error) throw error;
  throw new Error("Supabase did not return the created cart.");
}

async function writeCartItems(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  cartId: string,
  items: Array<{ variant_id: string; quantity: number }>,
) {
  const { data: currentRows, error: readError } = await supabase.from("cart_items")
    .select("variant_id")
    .eq("cart_id", cartId);
  if (readError) throw readError;
  const current = cartRowsSchema.safeParse(currentRows);
  if (!current.success) throw new Error("Supabase returned an invalid cart response.");

  const desiredIds = new Set(items.map((item) => item.variant_id));
  const staleIds = current.data.map((item) => item.variant_id).filter((id) => !desiredIds.has(id));
  if (staleIds.length > 0) {
    const { error } = await supabase.from("cart_items").delete().eq("cart_id", cartId).in("variant_id", staleIds);
    if (error) throw error;
  }

  const { error } = await supabase.from("cart_items").upsert(
    items.map((item) => ({ cart_id: cartId, variant_id: item.variant_id, quantity: item.quantity })),
    { onConflict: "cart_id,variant_id" },
  );
  if (error) throw error;
}

async function findExistingOrder(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase.from("orders")
    .select("id,order_number,status,grand_total,currency")
    .eq("customer_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return databaseOrderSchema.parse(data);
}

function supabaseOrderResponse(order: z.infer<typeof databaseOrderSchema>, idempotencyKey: string, status = 200) {
  return NextResponse.json({
    mode: "supabase",
    orderId: order.id,
    orderNumber: order.order_number,
    idempotencyKey,
    paymentStatus: "pending",
    orderStatus: order.status,
    total: order.grand_total,
    currency: order.currency,
    message: "Pedido guardado con pago pendiente. No se ha realizado ningún cargo; los resultados de pago demo aún no se pueden conciliar en Supabase.",
  }, { status });
}

async function createSupabaseOrder(checkout: CheckoutRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado para este entorno." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (!authData.user) {
    if (authError && authError.name !== "AuthSessionMissingError") {
      console.error("NODRIA checkout authentication failed", { status: authError.status ?? "unknown" });
      return NextResponse.json({ error: "No se ha podido validar tu sesión. Inténtalo de nuevo." }, { status: 503 });
    }
    return NextResponse.json({ error: "Inicia sesión para finalizar el pedido en Supabase." }, { status: 401 });
  }
  const userId = authData.user.id;
  if (!consumeRateLimit(`checkout:user:${userId}`, MAX_ATTEMPTS_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "Has realizado demasiados intentos. Espera un minuto y vuelve a probar." }, { status: 429 });
  }

  const existingOrder = await findExistingOrder(supabase, userId, checkout.idempotencyKey);
  if (existingOrder) return supabaseOrderResponse(existingOrder, checkout.idempotencyKey);

  try {
    const items = consolidateCheckoutItems(checkout.items);
    if (items.some((item) => item.productId.startsWith("builder:"))) {
      throw new CheckoutCartError("demo_only", "Las piezas del configurador solo se pueden pedir en el checkout demo local.");
    }

    const productIds = items.map((item) => item.productId);
    const { data: variantRows, error: variantError } = await supabase.from("product_variants")
      .select("id,product_id")
      .in("product_id", productIds);
    if (variantError) throw variantError;
    const variants = variantRowsSchema.safeParse(variantRows);
    if (!variants.success) throw new Error("Supabase returned an invalid product variant response.");
    const cartItems = resolveCheckoutCartItems(items, variants.data);

    const cart = await getOrCreateActiveCart(supabase, userId);
    await writeCartItems(supabase, cart.id, cartItems);

    const shippingAddress = {
      fullName: checkout.customer.name,
      email: checkout.customer.email,
      phone: checkout.customer.phone,
      address: checkout.customer.address,
      postalCode: checkout.customer.postalCode,
      city: checkout.customer.city,
      province: checkout.customer.province,
      countryCode: "ES",
    };
    const { data: rpcData, error: rpcError } = await supabase.rpc("place_order", {
      p_cart_id: cart.id,
      p_idempotency_key: checkout.idempotencyKey,
      p_shipping_address: shippingAddress,
      p_billing_address: shippingAddress,
    });
    if (rpcError) throw rpcError;
    const result = rpcOrderSchema.safeParse(rpcData);
    if (!result.success) throw new Error("Supabase returned an invalid place_order response.");
    const [row] = result.data;
    return supabaseOrderResponse({
      id: row.order_id,
      order_number: row.order_number,
      status: "pending_payment",
      grand_total: row.grand_total,
      currency: row.currency,
    }, checkout.idempotencyKey, 201);
  } catch (error) {
    // A concurrent request using the same key may commit and convert the cart before this request writes it.
    const concurrentOrder = await findExistingOrder(supabase, userId, checkout.idempotencyKey).catch(() => null);
    if (concurrentOrder) return supabaseOrderResponse(concurrentOrder, checkout.idempotencyKey);
    throw error;
  }
}

async function createDemoOrder(checkout: DemoRequestWithRequest) {
  if (!consumeRateLimit(`checkout:demo:${clientIp(checkout.request)}`, MAX_ATTEMPTS_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "Has realizado demasiados intentos de demostración. Espera un minuto y vuelve a probar." }, { status: 429 });
  }

  if (!checkout.data.paymentMethod) {
    return NextResponse.json({ error: "Elige un resultado para la simulación local." }, { status: 400 });
  }

  const consolidated = consolidateCheckoutItems(checkout.data.items);
  const orderItems: DemoOrderRecord["items"] = [];
  for (const { productId, quantity } of consolidated) {
    if (productId.startsWith("builder:")) {
      const component = pcBuilderComponents.find((item) => item.id === productId.slice("builder:".length));
      if (!component) return NextResponse.json({ error: "Uno de los componentes guardados ya no está disponible." }, { status: 409 });
      orderItems.push({ productId, name: component.name, sku: component.id.toUpperCase(), quantity, unitPrice: component.priceEur, lineTotal: money(component.priceEur * quantity), source: "pc_builder" });
      continue;
    }
    const product = demoProducts.find((item) => item.id === productId);
    if (!product) return NextResponse.json({ error: "Uno de los productos del carrito ya no está disponible." }, { status: 409 });
    if (quantity > product.stock) return NextResponse.json({ error: `${product.name} no tiene stock suficiente. Disponibles: ${product.stock}.` }, { status: 409 });
    orderItems.push({ productId, name: product.name, sku: product.sku, quantity, unitPrice: product.price, lineTotal: money(product.price * quantity), source: "catalogue" });
  }

  const subtotal = money(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const shipping = subtotal === 0 || subtotal >= 100 ? 0 : 5.9;
  const total = money(subtotal + shipping);
  const tax = money(total - total / 1.21);
  const timestamp = new Date().toISOString();
  const payment = demoPaymentStatus(checkout.data.paymentMethod);
  const orderStatus = payment === "approved" ? "confirmed" as const : payment === "processing" ? "payment_processing" as const : "pending" as const;
  const sequence = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  const record: DemoOrderRecord = {
    id: crypto.randomUUID(),
    orderNumber: `NDR-${new Date().getFullYear()}-${sequence}`,
    idempotencyKey: checkout.data.idempotencyKey,
    createdAt: timestamp,
    status: orderStatus,
    paymentStatus: payment,
    currency: "EUR",
    items: orderItems,
    customer: checkout.data.customer,
    subtotal,
    tax,
    shipping,
    total,
    paymentAttempt: { id: crypto.randomUUID(), method: `demo_${checkout.data.paymentMethod}`, status: payment, createdAt: timestamp },
    timeline: [
      { event: "order_created", label: "Pedido demo registrado", createdAt: timestamp },
      { event: `payment_${payment}`, label: `Intento de pago simulado: ${payment}`, createdAt: timestamp },
    ],
  };

  try {
    const saved = await persistDemoOrder(record);
    const response = {
      mode: "demo" as const,
      orderNumber: saved.orderNumber,
      idempotencyKey: checkout.data.idempotencyKey,
      paymentStatus: saved.paymentStatus === "invalid" ? "temporary_error" as const : saved.paymentStatus,
      orderStatus: demoOrderStatusSchema.parse(saved.status),
      message: "Registro persistente de demostración local. La respuesta de pago es ficticia y no se ha realizado ningún cargo.",
    };
    return NextResponse.json(response, { status: saved.id === record.id ? 201 : 200 });
  } catch (error) {
    console.error("NODRIA demo checkout persistence failed", error);
    return NextResponse.json({ error: "No se ha podido guardar el pedido demo. Repite el intento con la misma referencia." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const mode = getCheckoutMode();
  if (mode === "unavailable") {
    return NextResponse.json({ error: "El checkout requiere credenciales Supabase en este entorno." }, { status: 503 });
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no es JSON válido." }, { status: 400 });
  }
  const parsed = checkoutRequestSchema.safeParse(untrustedBody);
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del pedido y la dirección de entrega." }, { status: 400 });

  try {
    if (mode === "demo") {
      return await createDemoOrder({ data: parsed.data, request });
    }
    return await createSupabaseOrder(parsed.data);
  } catch (error) {
    if (error instanceof CheckoutCartError) {
      const status = error.code === "quantity_limit" ? 400 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    return checkoutErrorResponse(error);
  }
}
