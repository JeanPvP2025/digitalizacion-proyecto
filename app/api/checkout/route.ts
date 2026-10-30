import { NextResponse } from "next/server";
import { z } from "zod";
import { consolidateCheckoutItems, CheckoutCartError, resolveCheckoutCartItems, type CheckoutVariantRow } from "@/lib/commerce/cart";
import { checkoutItemSelectorError, checkoutRequestSchema, type CheckoutPaymentStatus, type CheckoutRequest } from "@/lib/commerce/contracts";
import { getCheckoutMode } from "@/lib/commerce/mode";
import { demoProducts } from "@/lib/catalog";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { DemoOrderIdempotencyConflict, persistDemoOrder, type DemoOrderRecord } from "@/lib/server/demo-orders";
import { DEMO_SESSION_COOKIE, signDemoSession, verifyDemoSession } from "@/lib/server/demo-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVerifiedReferenceBuilderCatalog } from "@/lib/pc-builder/reference-catalog";
import {
  createSupabasePaymentAdminClient,
  getDemoPaymentEventId,
  toDatabaseDemoPaymentOutcome,
  type DemoPaymentOutcome,
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
const existingCheckoutOrderSchema = z.array(z.object({
  order_id: z.uuid(),
  order_number: z.string().regex(/^NOD-\d{8}-[A-F0-9]{10}$/i),
  status: databaseOrderStatusSchema,
  grand_total: amountSchema,
  currency: currencySchema,
}).strict()).max(1);
const rpcPaymentStatusSchema = z.enum(["pending", "paid", "failed"]);
const variantRowsSchema = z.array(z.object({
  id: z.uuid(),
  product_id: z.string().min(1),
  is_active: z.boolean(),
  attributes: z.unknown().optional(),
  products: z.object({ is_published: z.boolean() }).strict(),
}).strict());
const cartIdSchema = z.uuid();
const checkoutVariantSelect = "id,product_id,is_active,attributes,products!inner(is_published)";

const MAX_ATTEMPTS_PER_MINUTE = 6;
type DemoRequestWithRequest = { data: CheckoutRequest; request: Request };

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-demo";
}

function money(value: number) {
  return Math.round(value * 100) / 100;
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
  return NextResponse.json({ error: "No se ha podido confirmar el pedido. Conserva la misma referencia al reintentar." }, { status: 503 });
}

async function loadSellableCheckoutVariants(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  items: CheckoutRequest["items"],
): Promise<CheckoutVariantRow[]> {
  const productIds = [...new Set(items.flatMap((item) => "productId" in item ? [item.productId] : []))];
  const variantIds = [...new Set(items.flatMap((item) => "variantId" in item ? [item.variantId] : []))];
  const sellableVariants = new Map<string, CheckoutVariantRow>();

  // Explicit variant references from PC Builder PRO are sellable when active and having pc_builder attributes,
  // even if their product is unpublished from the commercial catalog. ProductId references strictly require is_published.
  if (variantIds.length > 0) {
    const { data, error } = await supabase.from("product_variants")
      .select(checkoutVariantSelect)
      .in("id", variantIds)
      .eq("is_active", true);
    if (error) throw error;

    const parsed = variantRowsSchema.safeParse(data);
    if (!parsed.success) throw new Error("Supabase returned an invalid product variant response.");
    for (const row of parsed.data) {
      const hasPcBuilder = typeof row.attributes === "object" && row.attributes !== null && "pc_builder" in row.attributes;
      if (row.is_active && (row.products.is_published || hasPcBuilder)) {
        sellableVariants.set(row.id, { id: row.id, product_id: row.product_id });
      }
    }
  }

  if (productIds.length > 0) {
    const { data, error } = await supabase.from("product_variants")
      .select(checkoutVariantSelect)
      .in("product_id", productIds)
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
  }
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

async function resolveConnectedPayment(
  paymentAdmin: NonNullable<ReturnType<typeof createSupabasePaymentAdminClient>>,
  orderId: string,
  userId: string,
  idempotencyKey: string,
  paymentMethod: DemoPaymentOutcome,
) {
  const paymentEventId = getDemoPaymentEventId(userId, idempotencyKey, paymentMethod);
  const { data, error } = await paymentAdmin.rpc("resolve_demo_payment", {
    p_order_id: orderId,
    p_outcome: toDatabaseDemoPaymentOutcome(paymentMethod),
    p_event_id: paymentEventId,
  });
  if (error) throw error;
  const parsed = rpcPaymentStatusSchema.safeParse(data);
  if (!parsed.success) throw new Error("Supabase returned an invalid resolve_demo_payment response.");
  return parsed.data;
}

function supabaseOrderResponse(
  order: z.infer<typeof databaseOrderSchema>,
  idempotencyKey: string,
  paymentStatus: CheckoutPaymentStatus,
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
  if (!supabase) return NextResponse.json({ error: "La finalización de pedidos no está disponible en este momento." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (!authData.user) {
    if (authError && authError.name !== "AuthSessionMissingError") {
      console.error("NODRIA checkout authentication failed", { status: authError.status ?? "unknown" });
      return NextResponse.json({ error: "No se ha podido validar tu sesión. Inténtalo de nuevo." }, { status: 503 });
    }
    return NextResponse.json({ error: "Inicia sesión para finalizar el pedido." }, { status: 401 });
  }
  const userId = authData.user.id;
  const paymentMethod: DemoPaymentOutcome = "approved";

  // The RPC is intentionally limited to service_role. Resolve its outcome only
  // after authenticating the customer through the publishable-key session.
  const paymentAdmin = createSupabasePaymentAdminClient();
  if (!paymentAdmin) {
    return NextResponse.json({ error: "No se pudo preparar el pedido de forma segura. No se ha creado; inténtalo más tarde." }, { status: 503 });
  }

  if (!consumeRateLimit(`checkout:user:${userId}`, MAX_ATTEMPTS_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "Has realizado demasiados intentos. Espera un minuto y vuelve a probar." }, { status: 429 });
  }

  try {
    const items = consolidateCheckoutItems(checkout.items);
    const variants = await loadSellableCheckoutVariants(supabase, items);
    const cartItems = resolveCheckoutCartItems(items, variants);

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
    const { data: existingData, error: existingError } = await supabase.rpc("find_checkout_order", {
      p_idempotency_key: checkout.idempotencyKey,
      p_items: cartItems,
      p_shipping_address: shippingAddress,
      p_billing_address: shippingAddress,
    });
    if (existingError) throw existingError;
    const existingResult = existingCheckoutOrderSchema.safeParse(existingData);
    if (!existingResult.success) throw new Error("Supabase returned an invalid idempotent checkout lookup response.");
    const existing = existingResult.data[0];
    if (existing) {
      const paymentState = await resolveConnectedPayment(
        paymentAdmin, existing.order_id, userId, checkout.idempotencyKey, paymentMethod,
      );
      if (paymentState === "pending") {
        return NextResponse.json({ error: "El pago sigue procesándose. Conserva esta referencia y vuelve a intentar confirmar el pedido." }, { status: 503 });
      }
      const paymentStatus = paymentState === "paid"
        ? "approved"
        : paymentState === "failed"
          ? "declined"
          : paymentMethod;
      const existingOrder = databaseOrderSchema.parse({
        id: existing.order_id,
        order_number: existing.order_number,
        status: paymentState === "paid"
          ? "paid"
          : paymentState === "failed"
            ? "cancelled"
            : existing.status,
        grand_total: existing.grand_total,
        currency: existing.currency,
      });
      return supabaseOrderResponse(existingOrder, checkout.idempotencyKey, paymentStatus, 200);
    }

    const cart = await getOrCreateActiveCart(supabase, userId);
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
    const paymentState = await resolveConnectedPayment(
      paymentAdmin, row.order_id, userId, checkout.idempotencyKey, paymentMethod,
    );
    if (paymentState === "pending") {
      return NextResponse.json({ error: "El pedido se ha guardado y el pago sigue procesándose. Conserva esta referencia y vuelve a intentar confirmar." }, { status: 503 });
    }
    const paymentStatus = paymentState === "paid"
      ? "approved"
      : paymentState === "failed"
        ? "declined"
        : paymentMethod;
    resolvedOrder.status = paymentState === "paid"
      ? "paid"
      : paymentState === "failed"
        ? "cancelled"
        : "pending_payment";

    return supabaseOrderResponse(resolvedOrder, checkout.idempotencyKey, paymentStatus, 201);
  } catch (error) {
    throw error;
  }
}

async function createDemoOrder(checkout: DemoRequestWithRequest) {
  if (!consumeRateLimit(`checkout:demo:${clientIp(checkout.request)}`, MAX_ATTEMPTS_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: "Has realizado demasiados intentos de demostración. Espera un minuto y vuelve a probar." }, { status: 429 });
  }

  const builderComponents = getVerifiedReferenceBuilderCatalog().components;
  const variantToProduct = new Map<string, string>(builderComponents.map((c) => [c.variantId, c.productId]));
  let consolidated: ReturnType<typeof consolidateCheckoutItems>;
  try {
    consolidated = consolidateCheckoutItems(checkout.data.items, 10, variantToProduct);
  } catch (error) {
    if (error instanceof CheckoutCartError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const orderItems: DemoOrderRecord["items"] = [];
  const totalQuantityByProduct = new Map<string, number>();

  for (const item of consolidated) {
    if ("variantId" in item) {
      const component = builderComponents.find((candidate) => candidate.variantId === item.variantId);
      if (!component) return NextResponse.json({ error: "Una pieza del montaje ya no está disponible." }, { status: 409 });
      const current = totalQuantityByProduct.get(component.productId) ?? 0;
      const next = current + item.quantity;
      if (next > 10) return NextResponse.json({ error: `No se pueden pedir más de 10 unidades del mismo artículo (${component.name}).` }, { status: 400 });
      totalQuantityByProduct.set(component.productId, next);
      orderItems.push({
        productId: component.productId,
        name: component.name,
        sku: component.sku,
        quantity: item.quantity,
        unitPrice: component.priceEur,
        lineTotal: money(component.priceEur * item.quantity),
        source: "pc_builder",
      });
      continue;
    }
    if (!("productId" in item)) continue;
    const { productId, quantity } = item;
    const product = demoProducts.find((p) => p.id === productId);
    if (!product) return NextResponse.json({ error: "Uno de los productos del carrito ya no está disponible." }, { status: 409 });
    const current = totalQuantityByProduct.get(productId) ?? 0;
    const next = current + quantity;
    if (next > 10) return NextResponse.json({ error: `No se pueden pedir más de 10 unidades del mismo artículo (${product.name}).` }, { status: 400 });
    totalQuantityByProduct.set(productId, next);
    orderItems.push({
      productId,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice: product.price,
      lineTotal: money(product.price * quantity),
      source: "catalogue",
    });
  }

  for (const [productId, aggregateQty] of totalQuantityByProduct.entries()) {
    const product = demoProducts.find((p) => p.id === productId);
    const stockLimit = product ? product.stock : 12;
    if (aggregateQty > stockLimit) {
      const name = product?.name ?? "Artículo";
      return NextResponse.json({ error: `${name} no tiene stock suficiente. Disponibles: ${stockLimit}. Solicitadas: ${aggregateQty}.` }, { status: 409 });
    }
  }

  const subtotal = money(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const shipping = 0;
  const total = money(subtotal + shipping);
  const tax = money(total - total / 1.21);
  const timestamp = new Date().toISOString();
  const payment = "approved" as const;
  const orderStatus = "confirmed" as const;
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
    paymentAttempt: { id: crypto.randomUUID(), method: "nodria_demo", status: payment, createdAt: timestamp },
    timeline: [
      { event: "order_created", label: "Pedido demo registrado", createdAt: timestamp },
      { event: `payment_${payment}`, label: `Intento de pago simulado: ${payment}`, createdAt: timestamp },
    ],
  };

  try {
    const saved = await persistDemoOrder(record);
    const responseBody = {
      mode: "demo" as const,
      orderNumber: saved.orderNumber,
      idempotencyKey: checkout.data.idempotencyKey,
      paymentStatus: saved.paymentStatus === "invalid" ? "temporary_error" as const : saved.paymentStatus,
      orderStatus: demoOrderStatusSchema.parse(saved.status),
      message: "Pedido confirmado. El pago de demostración se ha aprobado automáticamente; no se ha realizado ningún cargo ni envío real.",
    };
    const response = NextResponse.json(responseBody, { status: saved.id === record.id ? 201 : 200 });

    try {
      const rawCookies = checkout.request.headers.get("cookie") ?? "";
      const cookieMap = new Map(rawCookies.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      }));
      const existingToken = cookieMap.get(DEMO_SESSION_COOKIE);
      const verified = verifyDemoSession(existingToken);
      const existingIds = verified?.orderIds ?? [];
      const updatedIds = Array.from(new Set([...existingIds, saved.id])).slice(-50);
      const signedToken = signDemoSession({
        orderIds: updatedIds,
        customerName: checkout.data.customer.name,
        createdAt: Date.now(),
      });

      response.cookies.set(DEMO_SESSION_COOKIE, signedToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 86400 * 30,
        secure: process.env.NODE_ENV === "production",
      });
      response.cookies.delete("nodria_demo_email");
      response.cookies.delete("nodria_demo_name");
    } catch (sessionError) {
      console.error("Failed to set demo session cookie", sessionError);
    }

    return response;
  } catch (error) {
    if (error instanceof DemoOrderIdempotencyConflict) {
      return NextResponse.json({ error: "Esta referencia de compra ya se usó con otros artículos o datos de entrega. Inicia otra compra." }, { status: 409 });
    }
    console.error("NODRIA demo checkout persistence failed", error);
    return NextResponse.json({ error: "No se ha podido guardar el pedido demo. Repite el intento con la misma referencia." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const mode = getCheckoutMode();
  if (mode === "unavailable") {
    return NextResponse.json({ error: "La finalización de pedidos no está disponible en este momento." }, { status: 503 });
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
