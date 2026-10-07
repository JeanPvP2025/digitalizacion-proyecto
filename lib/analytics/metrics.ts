import "server-only";

export const ANALYTICS_TIME_ZONE = "Europe/Madrid";
export const ANALYTICS_PERIOD_DAYS = 30;

export const VALID_ORDER_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;
export const SUCCESSFUL_PAYMENT_STATUSES = ["paid", "partially_refunded", "refunded"] as const;
export const TERMINAL_PAYMENT_STATUSES = [...SUCCESSFUL_PAYMENT_STATUSES, "failed"] as const;

export const ANALYTICS_METRIC_DEFINITIONS = [
  {
    id: "orders",
    label: "Pedidos válidos",
    numerator: "Pedidos únicos por placed_at con estado paid, processing, shipped o delivered.",
    denominator: "No aplica: recuento de pedidos.",
    period: "placed_at dentro de las últimas 30 fechas locales, [inicio, consulta).",
    timeZone: ANALYTICS_TIME_ZONE,
    states: "Se excluyen pending_payment, cancelled y refunded.",
  },
  {
    id: "gross-sales",
    label: "Ventas brutas aprobadas",
    numerator: "Suma una vez por pedido del grand_total (IVA y envío incluidos, descuentos restados) en EUR con evento payment_paid y pago paid, partially_refunded o refunded.",
    denominator: "No aplica: importe bruto aprobado.",
    period: "occurred_at del evento payment_paid dentro de las últimas 30 fechas locales.",
    timeZone: ANALYTICS_TIME_ZONE,
    states: "Se excluyen pagos fallidos, pendientes y autorizaciones. No resta devoluciones.",
  },
  {
    id: "payment-approval",
    label: "Aprobación de pagos",
    numerator: "Pedidos únicos con evento payment_paid y transacción compatible en estado paid, partially_refunded o refunded.",
    denominator: "Pedidos únicos con resultado terminal compatible: payment_paid o payment_failed.",
    period: "occurred_at del evento y processed_at del pago dentro de las últimas 30 fechas locales.",
    timeZone: ANALYTICS_TIME_ZONE,
    states: "payment_processing y otros resultados pendientes no entran en numerador ni denominador.",
  },
  {
    id: "inventory",
    label: "Unidades disponibles",
    numerator: "Suma de on_hand − reserved para cada combinación de almacén y variante.",
    denominator: "No aplica: suma de existencias actuales.",
    period: "Instantánea al consultar; no existe historial de movimientos.",
    timeZone: `${ANALYTICS_TIME_ZONE} para la marca temporal; sin periodo de calendario.`,
    states: "Incluye todas las filas de inventario visibles a super_admin.",
  },
  {
    id: "crm-conversion",
    label: "Conversión de solicitudes CRM",
    numerator: "Solicitudes de presupuesto con estado actual converted.",
    denominator: "Solicitudes de presupuesto únicas creadas en el periodo.",
    period: "created_at dentro de las últimas 30 fechas locales; estado evaluado al consultar.",
    timeZone: ANALYTICS_TIME_ZONE,
    states: "Se cuentan todos los estados en el denominador; solo converted en el numerador.",
  },
] as const;

export type AnalyticsPeriod = {
  startInclusive: string;
  endExclusive: string;
  startLocalDate: string;
  endLocalDate: string;
  timeZone: typeof ANALYTICS_TIME_ZONE;
};

export type AnalyticsOrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type AnalyticsPaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

export type AnalyticsOrderRow = {
  id: string;
  placed_at: string;
  status: AnalyticsOrderStatus;
};

export type AnalyticsPaymentEventRow = {
  id: number;
  order_id: string;
  event_key: "payment_paid" | "payment_failed";
  occurred_at: string;
};

export type AnalyticsPaymentRow = {
  id: string;
  order_id: string;
  status: AnalyticsPaymentStatus;
  amount: number | string;
  currency: string;
  processed_at: string;
  order: {
    id: string;
    status: AnalyticsOrderStatus;
    grand_total: number | string;
    currency: string;
  };
};

export type AnalyticsInventoryRow = {
  warehouse_id: string;
  variant_id: string;
  on_hand: number;
  reserved: number;
};

export type AnalyticsCrmRow = {
  id: string;
  created_at: string;
  status: "new" | "qualified" | "contacted" | "converted" | "closed";
};

export type AnalyticsMetrics = {
  orderCount: number;
  grossSalesEurCents: number;
  grossSalesExcludedCurrencyOrders: number;
  approvedPaymentOrders: number;
  resolvedPaymentOrders: number;
  paymentApprovalRate: number | null;
  inventory: {
    availableUnits: number;
    reservedUnits: number;
    rowCount: number;
  };
  crm: {
    convertedRequests: number;
    totalRequests: number;
    conversionRate: number | null;
  };
};

export class AnalyticsDataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsDataIntegrityError";
  }
}

const madridParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const PAID_ORDER_STATES = new Set<AnalyticsOrderStatus>([...VALID_ORDER_STATUSES, "refunded"]);

function dateKeyAtMadrid(instant: Date): string {
  const parts = madridParts.formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

/** Converts Madrid wall-clock midnight to UTC without assuming a fixed CET/CEST offset. */
function madridMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day);
  let candidate = new Date(targetWallTime);

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = madridParts.formatToParts(candidate);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const wallTimeAsUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    candidate = new Date(candidate.getTime() + targetWallTime - wallTimeAsUtc);
  }

  return candidate;
}

/** Half-open period [start, asOf) covering 30 calendar dates in Europe/Madrid. */
export function createAnalyticsPeriod(asOf: Date): AnalyticsPeriod {
  if (!Number.isFinite(asOf.getTime())) throw new Error("Analytics cutoff must be a valid date.");
  const endLocalDate = dateKeyAtMadrid(asOf);
  const startLocalDate = addCalendarDays(endLocalDate, -(ANALYTICS_PERIOD_DAYS - 1));

  return {
    startInclusive: madridMidnight(startLocalDate).toISOString(),
    endExclusive: asOf.toISOString(),
    startLocalDate,
    endLocalDate,
    timeZone: ANALYTICS_TIME_ZONE,
  };
}

function isInsidePeriod(instant: string, period: AnalyticsPeriod): boolean {
  const timestamp = Date.parse(instant);
  return Number.isFinite(timestamp)
    && timestamp >= Date.parse(period.startInclusive)
    && timestamp < Date.parse(period.endExclusive);
}

function moneyToCents(value: number | string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AnalyticsDataIntegrityError("A payment or order total is not a valid non-negative amount.");
  }
  return Math.round(amount * 100);
}

function latestByOrder<T>(
  rows: readonly T[],
  orderId: (row: T) => string,
  occurredAt: (row: T) => string,
  tieBreaker: (row: T) => number | string,
): Map<string, T> {
  const latest = new Map<string, T>();

  for (const row of rows) {
    const id = orderId(row);
    const previous = latest.get(id);
    if (!previous) {
      latest.set(id, row);
      continue;
    }

    const currentTime = Date.parse(occurredAt(row));
    const previousTime = Date.parse(occurredAt(previous));
    if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) {
      throw new AnalyticsDataIntegrityError("A payment timestamp is invalid.");
    }

    const currentTie = String(tieBreaker(row));
    const previousTie = String(tieBreaker(previous));
    if (currentTime > previousTime || (currentTime === previousTime && currentTie > previousTie)) {
      latest.set(id, row);
    }
  }

  return latest;
}

/** Pure aggregation shared by the dashboard and deterministic contract fixtures. */
export function calculateAnalyticsMetrics(input: {
  period: AnalyticsPeriod;
  orders: readonly AnalyticsOrderRow[];
  paymentEvents: readonly AnalyticsPaymentEventRow[];
  payments: readonly AnalyticsPaymentRow[];
  inventory: readonly AnalyticsInventoryRow[];
  crmRequests: readonly AnalyticsCrmRow[];
}): AnalyticsMetrics {
  const { period } = input;
  const orderIds = new Set(
    input.orders
      .filter((order) => isInsidePeriod(order.placed_at, period) && VALID_ORDER_STATUSES.includes(order.status as (typeof VALID_ORDER_STATUSES)[number]))
      .map((order) => order.id),
  );

  const events = input.paymentEvents.filter((event) => isInsidePeriod(event.occurred_at, period));
  const payments = input.payments.filter((payment) => isInsidePeriod(payment.processed_at, period));
  const latestEvents = latestByOrder(events, (event) => event.order_id, (event) => event.occurred_at, (event) => event.id);
  const latestPayments = latestByOrder(payments, (payment) => payment.order_id, (payment) => payment.processed_at, (payment) => payment.id);
  const terminalOrderIds = new Set([...latestEvents.keys(), ...latestPayments.keys()]);
  const approvedPaymentOrderIds = new Set<string>();
  const resolvedPaymentOrderIds = new Set<string>();
  const grossSaleByOrder = new Map<string, number>();
  let grossSalesExcludedCurrencyOrders = 0;

  for (const orderId of terminalOrderIds) {
    const event = latestEvents.get(orderId);
    const payment = latestPayments.get(orderId);
    if (!event || !payment) {
      throw new AnalyticsDataIntegrityError("A terminal payment event has no matching processed payment transaction in the reporting period.");
    }

    if (payment.order_id !== orderId || payment.order.id !== orderId) {
      throw new AnalyticsDataIntegrityError("A payment transaction does not match its order.");
    }

    const isPaidEvent = event.event_key === "payment_paid";
    const isSuccessfulPayment = SUCCESSFUL_PAYMENT_STATUSES.includes(payment.status as (typeof SUCCESSFUL_PAYMENT_STATUSES)[number]);
    const isFailedEvent = event.event_key === "payment_failed";
    const matchesEvent = (isPaidEvent && isSuccessfulPayment) || (isFailedEvent && payment.status === "failed");
    if (!matchesEvent) {
      throw new AnalyticsDataIntegrityError("Payment event and transaction status disagree; analytics totals were withheld.");
    }

    if ((isPaidEvent && !PAID_ORDER_STATES.has(payment.order.status))
      || (isFailedEvent && payment.order.status !== "cancelled")) {
      throw new AnalyticsDataIntegrityError("Payment event and order status disagree; analytics totals were withheld.");
    }

    const paymentAmountCents = moneyToCents(payment.amount);
    const orderAmountCents = moneyToCents(payment.order.grand_total);
    if (paymentAmountCents !== orderAmountCents || payment.currency !== payment.order.currency) {
      throw new AnalyticsDataIntegrityError("Payment amount or currency does not match the order snapshot.");
    }

    resolvedPaymentOrderIds.add(orderId);
    if (!isPaidEvent) continue;

    approvedPaymentOrderIds.add(orderId);
    if (payment.currency !== "EUR") {
      grossSalesExcludedCurrencyOrders += 1;
      continue;
    }
    grossSaleByOrder.set(orderId, orderAmountCents);
  }

  const periodRequests = new Map(
    input.crmRequests
      .filter((request) => isInsidePeriod(request.created_at, period))
      .map((request) => [request.id, request]),
  );
  const convertedRequests = [...periodRequests.values()].filter((request) => request.status === "converted").length;
  const inventory = new Map(
    input.inventory.map((row) => [`${row.warehouse_id}:${row.variant_id}`, row]),
  );
  let availableUnits = 0;
  let reservedUnits = 0;
  for (const row of inventory.values()) {
    if (!Number.isInteger(row.on_hand) || !Number.isInteger(row.reserved) || row.on_hand < 0 || row.reserved < 0 || row.reserved > row.on_hand) {
      throw new AnalyticsDataIntegrityError("Inventory contains an invalid on-hand or reserved quantity.");
    }
    availableUnits += row.on_hand - row.reserved;
    reservedUnits += row.reserved;
  }

  return {
    orderCount: orderIds.size,
    grossSalesEurCents: [...grossSaleByOrder.values()].reduce((total, amount) => total + amount, 0),
    grossSalesExcludedCurrencyOrders,
    approvedPaymentOrders: approvedPaymentOrderIds.size,
    resolvedPaymentOrders: resolvedPaymentOrderIds.size,
    paymentApprovalRate: resolvedPaymentOrderIds.size === 0 ? null : approvedPaymentOrderIds.size / resolvedPaymentOrderIds.size,
    inventory: {
      availableUnits,
      reservedUnits,
      rowCount: inventory.size,
    },
    crm: {
      convertedRequests,
      totalRequests: periodRequests.size,
      conversionRate: periodRequests.size === 0 ? null : convertedRequests / periodRequests.size,
    },
  };
}
