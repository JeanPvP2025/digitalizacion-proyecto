import "server-only";

import { getOperationsAccess } from "@/lib/operations/access";

const QUEUE_LIMIT = 24;
const EVENT_FEED_LIMIT = 12;
const DAYS_FOR_EVENT_FEED = 7;

type RawAddress = {
  fullName?: unknown;
  city?: unknown;
  province?: unknown;
  postalCode?: unknown;
};

export type OperationsOrderStatus = "paid" | "processing" | "shipped";

export type OperationsOrder = {
  id: string;
  orderNumber: string;
  status: OperationsOrderStatus;
  total: number;
  currency: string;
  createdAt: string;
  recipient: string;
  destination: string;
  items: Array<{ name: string; sku: string; quantity: number }>;
};

export type OperationsEvent = {
  id: number;
  orderId: string;
  orderNumber: string;
  key: string;
  note: string;
  occurredAt: string;
};

export type OperationsWorkspace =
  | { status: "unconfigured" | "unauthenticated" | "forbidden" | "error" }
  | {
      status: "ready";
      orders: OperationsOrder[];
      events: OperationsEvent[];
      readyForDispatch: number;
      inTransit: number;
      eventsLast24Hours: number;
      deliveriesLast7Days: number;
      queueIsLimited: boolean;
      fetchedAt: string;
    };

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asAddress(value: unknown): RawAddress {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RawAddress
    : {};
}

function orderDestination(value: unknown): { recipient: string; destination: string } {
  const address = asAddress(value);
  const city = asText(address.city);
  const province = asText(address.province);
  const postalCode = asText(address.postalCode);
  return {
    recipient: asText(address.fullName) || "Destinatario no indicado",
    destination: [postalCode, city, province].filter(Boolean).join(" · ") || "Destino no indicado",
  };
}

function eventOrderLabel(key: string): string {
  const labels: Record<string, string> = {
    order_created: "Pedido creado",
    payment_processing: "Pago en revisión",
    payment_paid: "Pago confirmado",
    payment_failed: "Pago rechazado",
    payment_temporary_error: "Incidencia temporal de pago",
    order_shipped: "Pedido expedido",
    order_delivered: "Entrega confirmada",
    order_cancelled: "Pedido cancelado",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

export async function getOperationsWorkspace(now = new Date()): Promise<OperationsWorkspace> {
  const access = await getOperationsAccess();
  if (access.state !== "ready") return { status: access.state };

  const day = 24 * 60 * 60 * 1000;
  const oneDayAgo = new Date(now.getTime() - day).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - DAYS_FOR_EVENT_FEED * day).toISOString();

  try {
    const [queueResult, readyCountResult, shippedCountResult, eventCountResult, deliveredCountResult, activityResult] = await Promise.all([
      access.supabase
        .from("orders")
        .select("id, order_number, status, grand_total, currency, created_at, shipping_address")
        .in("status", ["paid", "processing", "shipped"])
        .order("created_at", { ascending: true })
        .limit(QUEUE_LIMIT),
      access.supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
      access.supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "shipped"),
      access.supabase.from("order_events").select("id", { count: "exact", head: true }).gte("occurred_at", oneDayAgo),
      access.supabase.from("order_events").select("id", { count: "exact", head: true }).eq("event_key", "order_delivered").gte("occurred_at", sevenDaysAgo),
      access.supabase
        .from("order_events")
        .select("id, order_id, event_key, note, occurred_at")
        .gte("occurred_at", sevenDaysAgo)
        .order("occurred_at", { ascending: false })
        .limit(EVENT_FEED_LIMIT),
    ]);

    if ([queueResult, readyCountResult, shippedCountResult, eventCountResult, deliveredCountResult, activityResult].some((result) => result.error)) {
      return { status: "error" };
    }

    const queueRows = queueResult.data ?? [];
    const orderIds = queueRows.map((row) => row.id as string);
    const eventRows = activityResult.data ?? [];
    const eventOrderIds = [...new Set(eventRows.map((event) => event.order_id as string))];

    const [itemResult, eventOrdersResult] = await Promise.all([
      orderIds.length
        ? access.supabase.from("order_items").select("order_id, product_name, product_sku, quantity").in("order_id", orderIds).order("created_at", { ascending: true }).limit(768)
        : Promise.resolve({ data: [], error: null }),
      eventOrderIds.length
        ? access.supabase.from("orders").select("id, order_number").in("id", eventOrderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (itemResult.error || eventOrdersResult.error) return { status: "error" };

    const itemsByOrder = new Map<string, OperationsOrder["items"]>();
    for (const item of itemResult.data ?? []) {
      const orderId = item.order_id as string;
      const items = itemsByOrder.get(orderId) ?? [];
      items.push({
        name: item.product_name as string,
        sku: item.product_sku as string,
        quantity: item.quantity as number,
      });
      itemsByOrder.set(orderId, items);
    }

    const ordersById = new Map<string, string>(
      (eventOrdersResult.data ?? []).map((order) => [order.id as string, order.order_number as string]),
    );
    for (const row of queueRows) ordersById.set(row.id as string, row.order_number as string);

    const orders: OperationsOrder[] = queueRows.flatMap((row) => {
      const status = row.status as string;
      if (status !== "paid" && status !== "processing" && status !== "shipped") return [];
      const destination = orderDestination(row.shipping_address);
      return [{
        id: row.id as string,
        orderNumber: row.order_number as string,
        status,
        total: Number(row.grand_total),
        currency: row.currency as string,
        createdAt: row.created_at as string,
        ...destination,
        items: itemsByOrder.get(row.id as string) ?? [],
      }];
    });

    const events: OperationsEvent[] = eventRows.map((event) => ({
      id: event.id as number,
      orderId: event.order_id as string,
      orderNumber: ordersById.get(event.order_id as string) ?? "Pedido asociado",
      key: eventOrderLabel(event.event_key as string),
      note: asText(event.note),
      occurredAt: event.occurred_at as string,
    }));

    return {
      status: "ready",
      orders,
      events,
      readyForDispatch: readyCountResult.count ?? 0,
      inTransit: shippedCountResult.count ?? 0,
      eventsLast24Hours: eventCountResult.count ?? 0,
      deliveriesLast7Days: deliveredCountResult.count ?? 0,
      queueIsLimited: (queueResult.data?.length ?? 0) === QUEUE_LIMIT,
      fetchedAt: now.toISOString(),
    };
  } catch {
    return { status: "error" };
  }
}
