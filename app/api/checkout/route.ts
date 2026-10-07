import { NextResponse } from "next/server";
import { z } from "zod";
import { consolidateCheckoutItems, CheckoutCartError, resolveCheckoutCartItems, type CheckoutVariantRow } from "@/lib/commerce/cart";
import { checkoutItemSelectorError, checkoutRequestSchema, type CheckoutRequest } from "@/lib/commerce/contracts";
import { getCheckoutMode } from "@/lib/commerce/mode";
import { demoProducts } from "@/lib/catalog";
import { pcBuilderComponents } from "@/lib/pc-builder";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { persistDemoOrder, type DemoOrderRecord } from "@/lib/server/demo-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabasePaymentAdminClient,
  getDemoPaymentEventId,
  toDatabaseDemoPaymentOutcome,
} from "@/lib/commerce/payment-admin";

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
const rpcPaymentStatusSchema = z.enum(["pending", "paid", "failed"]);
const variantRowsSchema = z.array(z.object({
  id: z.uuid(),
  product_id: z.string().min(1),
  is_active: z.boolean(),
  products: z.object({ is_published: z.boolean() }).strict(),
}).strict());
const cartIdSchema = z.uuid();
const checkoutVariantSelect = "id,product_id,is_active,products!inner(is_published)";

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
    const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
    return NextResponse.json({
      error: message.includes("different payload")
        ? "Esta referencia ya se usó con otros artículos o una dirección distinta. Inicia otra compra."
        : "El pedido ya se está registrando. Repite la solicitud con la misma referencia.",
    }, { status: 409 });
  }
  if (code === "22023") {
    return NextResponse.json({ error: "Revisa los datos de entrega antes de continuar." }, { status: 400 });
  }
  if (code === "23514") {
    return NextResponse.json({ error: "Este pedido ya no admite otro resultado de pago." }, { status: 409 });
  }
  return NextResponse.json({ error: "No se ha podido confirmar el pedido con Supabase. Conserva la misma referencia al reintentar." }, { status: 503 });
}

async function loadSellableCheckoutVariants(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  items: CheckoutRequest["items"],
): Promise<CheckoutVariantRow[]> {
  const productIds = [...new Set(items.flatMap((item) => "productId" in item ? [item.productId] : []))];
  const variantIds = [...new Set(items.flatMap((item) => "variantId" in item ? [item.variantId] : []))];
  const sellableVariants = new Map<string, CheckoutVariantRow>();

  const appendSellableVariants = async (column: "id" | "product_id", values: string[]) => {
    if (values.length === 0) return;
    const { data, error } = await supabase.from("product_variants")
      .select(checkoutVariantSelect)
      .in(column, values)
      .eq("is_active", true)
      .eq("products.is_published", true);
    if (error) throw error;

    const parsed = variantRowsSchema.safeParse(data);
    if (!parsed.success) throw new Error("Supabase returned an invalid product variant response.");
    for (const row of parsed.data) {
      if (row.is_active && row.products.is_published) {
        sellableVariants.set(row.id, { id: row.id, product_id: row.product_id });
      }
    }
  };

  // These reads use the authenticated user's publishable-key client. The query
  // filters validate sellability while RLS remains the authorization boundary.
  await appendSellableVariants("id", variantIds);
  await appendSellableVariants("product_id", productIds);
  return [...sellableVariants.values()];
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

function supabaseOrderResponse(
  order: z.infer<typeof databaseOrderSchema>,
  idempotencyKey: string,
  paymentStatus: NonNullable<CheckoutRequest["paymentMethod"]>,
  status = 200,
) {
  const paymentMessage = paymentStatus === "approved"
    ? "Pago ficticio aprobado. El pedido y su reserva de stock están confirmados."
    : paymentStatus === "declined" || paymentStatus === "insufficient_funds"
      ? "Resultado ficticio rechazado. El pedido se ha cancelado y el stock reservado se ha liberado."
      : paymentStatus === "processing"
        ? "El pago demo sigue en revisión. El pedido y su reserva permanecen pendientes; puedes reintentar con la misma referencia."
        : "Error temporal simulado. El pedido y su reserva permanecen pendientes; puedes reintentar con la misma referencia.";

  return NextResponse.json({
    mode: "supabase",
    orderId: order.id,
    orderNumber: order.order_number,
    idempotencyKey,
    paymentStatus,
    orderStatus: order.status,
    total: order.grand_total,
    currency: order.currency,
    message: `${paymentMessage} No se ha realizado ningún cargo ni se han usado datos de tarjeta.`,
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
  if (!checkout.paymentMethod) {
    return NextResponse.json({ error: "Elige un resultado para la simulación de pago." }, { status: 400 });
  }

  // The RPC is intentionally limited to service_role. Resolve its outcome only
  // after authenticating the customer through the publishable-key session.
  const paymentAdmin = createSupabasePaymentAdminClient();
  if (!paymentAdmin) {
    return NextResponse.json({ error: "Falta configurar una clave secreta de Supabase solo para servidor; el pedido no se ha creado." }, { status: 503 });
  }

  if (!consumeRateLimit(`checkout:user:${userId}`, MAX_ATTEMPTS_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "Has realizado demasiados intentos. Espera un minuto y vuelve a probar." }, { status: 429 });
  }

  const existingOrder = await findExistingOrder(supabase, userId, checkout.idempotencyKey);

  try {
    const items = consolidateCheckoutItems(checkout.items);
    if (items.some((item) => "productId" in item && item.productId.startsWith("builder:"))) {
      throw new CheckoutCartError("demo_only", "Las piezas del configurador solo se pueden pedir en el checkout demo local.");
    }

    const variants = await loadSellableCheckoutVariants(supabase, items);
    const cartItems = resolveCheckoutCartItems(items, variants);

    const cart = await getOrCreateActiveCart(supabase, userId);

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
    const { data: rpcData, error: rpcError } = await supabase.rpc("place_order_from_checkout", {
      p_cart_id: cart.id,
      p_idempotency_key: checkout.idempotencyKey,
      p_items: cartItems,
      p_shipping_address: shippingAddress,
      p_billing_address: shippingAddress,
    });
    if (rpcError) throw rpcError;
    const result = rpcOrderSchema.safeParse(rpcData);
    if (!result.success) throw new Error("Supabase returned an invalid place_order response.");
    const [row] = result.data;
    const resolvedOrder: z.infer<typeof databaseOrderSchema> = {
      id: row.order_id,
      order_number: row.order_number,
      status: "pending_payment",
      grand_total: row.grand_total,
      currency: row.currency,
    };
    const paymentEventId = getDemoPaymentEventId(userId, checkout.idempotencyKey, checkout.paymentMethod);
    const { data: paymentData, error: paymentError } = await paymentAdmin.rpc("resolve_demo_payment", {
      p_order_id: row.order_id,
      p_outcome: toDatabaseDemoPaymentOutcome(checkout.paymentMethod),
      p_event_id: paymentEventId,
    });
    if (paymentError) throw paymentError;
    const parsedPayment = rpcPaymentStatusSchema.safeParse(paymentData);
    if (!parsedPayment.success) throw new Error("Supabase returned an invalid resolve_demo_payment response.");

    const paymentStatus = parsedPayment.data === "paid"
      ? "approved"
      : parsedPayment.data === "failed"
        ? checkout.paymentMethod === "insufficient_funds" ? "insufficient_funds" : "declined"
        : checkout.paymentMethod;
    resolvedOrder.status = parsedPayment.data === "paid"
      ? "paid"
      : parsedPayment.data === "failed"
        ? "cancelled"
        : "pending_payment";

    if (paymentStatus === "temporary_error" && parsedPayment.data === "pending") {
      return NextResponse.json({ error: "El pago demo tuvo un error temporal. El pedido sigue pendiente; cambia el resultado o reintenta con la misma referencia." }, { status: 503 });
    }

    return supabaseOrderResponse(resolvedOrder, checkout.idempotencyKey, paymentStatus, existingOrder ? 200 : 201);
  } catch (error) {
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
  if (consolidated.some((item) => "variantId" in item)) {
    return NextResponse.json({ error: "La selección por variantId requiere el checkout Supabase conectado; el modo demo local usa productId." }, { status: 400 });
  }
  const orderItems: DemoOrderRecord["items"] = [];
  for (const item of consolidated) {
    if (!("productId" in item)) continue;
    const { productId, quantity } = item;
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
  if (!parsed.success) {
    const selectorIssue = parsed.error.issues.find((issue) => issue.message === checkoutItemSelectorError);
    if (selectorIssue) return NextResponse.json({ error: checkoutItemSelectorError }, { status: 400 });
    return NextResponse.json({ error: "Revisa los datos del pedido y la dirección de entrega." }, { status: 400 });
  }

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
