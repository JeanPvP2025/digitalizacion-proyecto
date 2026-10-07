import { describe, expect, it } from "vitest";
import {
  AnalyticsDataIntegrityError,
  calculateAnalyticsMetrics,
  createAnalyticsPeriod,
  type AnalyticsCrmRow,
  type AnalyticsInventoryRow,
  type AnalyticsOrderRow,
  type AnalyticsPaymentEventRow,
  type AnalyticsPaymentRow,
} from "@/lib/analytics/metrics";

const asOf = new Date("2026-10-07T12:00:00.000Z");
const period = createAnalyticsPeriod(asOf);
const start = period.startInclusive;
const end = period.endExclusive;

const orderRows: AnalyticsOrderRow[] = [
  { id: "order-paid", placed_at: "2026-10-01T12:00:00.000Z", status: "paid" },
  { id: "order-shipped", placed_at: "2026-10-02T12:00:00.000Z", status: "shipped" },
  { id: "order-failed", placed_at: "2026-10-03T12:00:00.000Z", status: "cancelled" },
  { id: "order-pending", placed_at: "2026-10-04T12:00:00.000Z", status: "pending_payment" },
  { id: "order-refunded", placed_at: "2026-10-05T12:00:00.000Z", status: "refunded" },
  { id: "order-at-start", placed_at: start, status: "paid" },
  { id: "order-at-end", placed_at: end, status: "paid" },
];

const paymentEventRows: AnalyticsPaymentEventRow[] = [
  { id: 10, order_id: "order-paid", event_key: "payment_paid", occurred_at: "2026-10-01T12:00:00.000Z" },
  { id: 11, order_id: "order-paid", event_key: "payment_paid", occurred_at: "2026-10-01T12:00:00.000Z" },
  { id: 12, order_id: "order-shipped", event_key: "payment_paid", occurred_at: "2026-10-02T12:00:00.000Z" },
  { id: 13, order_id: "order-failed", event_key: "payment_failed", occurred_at: "2026-10-03T12:00:00.000Z" },
  { id: 14, order_id: "order-paid", event_key: "payment_paid", occurred_at: end },
];

const paymentRows: AnalyticsPaymentRow[] = [
  {
    id: "payment-paid",
    order_id: "order-paid",
    status: "paid",
    amount: "121.00",
    currency: "EUR",
    processed_at: "2026-10-01T12:00:00.000Z",
    order: { id: "order-paid", status: "paid", grand_total: "121.00", currency: "EUR" },
  },
  {
    id: "payment-paid-retry",
    order_id: "order-paid",
    status: "paid",
    amount: "121.00",
    currency: "EUR",
    processed_at: "2026-10-01T12:00:00.000Z",
    order: { id: "order-paid", status: "paid", grand_total: "121.00", currency: "EUR" },
  },
  {
    id: "payment-shipped",
    order_id: "order-shipped",
    status: "partially_refunded",
    amount: "80.50",
    currency: "EUR",
    processed_at: "2026-10-02T12:00:00.000Z",
    order: { id: "order-shipped", status: "shipped", grand_total: "80.50", currency: "EUR" },
  },
  {
    id: "payment-failed",
    order_id: "order-failed",
    status: "failed",
    amount: "50.00",
    currency: "EUR",
    processed_at: "2026-10-03T12:00:00.000Z",
    order: { id: "order-failed", status: "cancelled", grand_total: "50.00", currency: "EUR" },
  },
  {
    id: "payment-at-end",
    order_id: "order-paid",
    status: "paid",
    amount: "121.00",
    currency: "EUR",
    processed_at: end,
    order: { id: "order-paid", status: "paid", grand_total: "121.00", currency: "EUR" },
  },
];

const inventoryRows: AnalyticsInventoryRow[] = [
  { warehouse_id: "warehouse-madrid", variant_id: "variant-a", on_hand: 10, reserved: 3 },
  { warehouse_id: "warehouse-madrid", variant_id: "variant-b", on_hand: 2, reserved: 2 },
  { warehouse_id: "warehouse-sevilla", variant_id: "variant-a", on_hand: 6, reserved: 1 },
];

const crmRows: AnalyticsCrmRow[] = [
  { id: "request-converted", created_at: "2026-10-01T12:00:00.000Z", status: "converted" },
  { id: "request-new", created_at: start, status: "new" },
  { id: "request-outside", created_at: "2026-09-07T21:59:59.999Z", status: "converted" },
  { id: "request-at-end", created_at: end, status: "converted" },
];

function calculate(overrides: Partial<{
  orders: AnalyticsOrderRow[];
  paymentEvents: AnalyticsPaymentEventRow[];
  payments: AnalyticsPaymentRow[];
  inventory: AnalyticsInventoryRow[];
  crmRequests: AnalyticsCrmRow[];
}> = {}) {
  return calculateAnalyticsMetrics({
    period,
    orders: overrides.orders ?? orderRows,
    paymentEvents: overrides.paymentEvents ?? paymentEventRows,
    payments: overrides.payments ?? paymentRows,
    inventory: overrides.inventory ?? inventoryRows,
    crmRequests: overrides.crmRequests ?? crmRows,
  });
}

describe("analytics calculation contract", () => {
  it("uses 30 Madrid calendar dates and converts local midnight across DST", () => {
    expect(period.startLocalDate).toBe("2026-09-08");
    expect(period.endLocalDate).toBe("2026-10-07");
    expect(period.startInclusive).toBe("2026-09-07T22:00:00.000Z");
    expect(period.endExclusive).toBe(asOf.toISOString());

    const spring = createAnalyticsPeriod(new Date("2026-04-01T12:00:00.000Z"));
    expect(spring.startLocalDate).toBe("2026-03-03");
    expect(spring.startInclusive).toBe("2026-03-02T23:00:00.000Z");
  });

  it("deduplicates by order and reconciles payment events with transaction and order totals", () => {
    expect(calculate()).toEqual({
      orderCount: 3,
      grossSalesEurCents: 20_150,
      grossSalesExcludedCurrencyOrders: 0,
      approvedPaymentOrders: 2,
      resolvedPaymentOrders: 3,
      paymentApprovalRate: 2 / 3,
      inventory: { availableUnits: 12, reservedUnits: 6, rowCount: 3 },
      crm: { convertedRequests: 1, totalRequests: 2, conversionRate: 0.5 },
    });
  });

  it("does not treat failed, pending, refunded or end-boundary orders as valid orders or sales", () => {
    const metrics = calculate();
    expect(metrics.orderCount).toBe(3);
    expect(metrics.approvedPaymentOrders).toBe(2);
    expect(metrics.grossSalesEurCents).toBe(20_150);
    expect(metrics.resolvedPaymentOrders).toBe(3);
  });

  it("keeps sales gross before refunds and excludes non-EUR totals without FX conversion", () => {
    const gbpEvent: AnalyticsPaymentEventRow = {
      id: 20,
      order_id: "order-gbp",
      event_key: "payment_paid",
      occurred_at: "2026-10-06T10:00:00.000Z",
    };
    const gbpPayment: AnalyticsPaymentRow = {
      id: "payment-gbp",
      order_id: "order-gbp",
      status: "refunded",
      amount: "25.25",
      currency: "GBP",
      processed_at: "2026-10-06T10:00:00.000Z",
      order: { id: "order-gbp", status: "refunded", grand_total: "25.25", currency: "GBP" },
    };
    const metrics = calculate({
      paymentEvents: [...paymentEventRows, gbpEvent],
      payments: [...paymentRows, gbpPayment],
    });

    expect(metrics.grossSalesEurCents).toBe(20_150);
    expect(metrics.grossSalesExcludedCurrencyOrders).toBe(1);
    expect(metrics.approvedPaymentOrders).toBe(3);
  });

  it("returns null rates when there is no denominator", () => {
    const metrics = calculate({
      orders: [],
      paymentEvents: [],
      payments: [],
      inventory: [],
      crmRequests: [],
    });

    expect(metrics.paymentApprovalRate).toBeNull();
    expect(metrics.crm.conversionRate).toBeNull();
    expect(metrics.inventory).toEqual({ availableUnits: 0, reservedUnits: 0, rowCount: 0 });
  });

  it("withholds a result when the payment event and order snapshot disagree", () => {
    const mismatchedPayments = paymentRows.map((payment) => payment.order_id === "order-paid"
      ? { ...payment, order: { ...payment.order, grand_total: "122.00" } }
      : payment);
    expect(() => calculate({ payments: mismatchedPayments }))
      .toThrow(AnalyticsDataIntegrityError);
  });

  it("does not treat a cancelled order with a paid event as a sale", () => {
    const invalidPayment = {
      ...paymentRows[0],
      order: { ...paymentRows[0].order, status: "cancelled" as const },
    };
    expect(() => calculate({
      orders: [orderRows[0]],
      paymentEvents: [paymentEventRows[0]],
      payments: [invalidPayment],
      inventory: [],
      crmRequests: [],
    })).toThrow(AnalyticsDataIntegrityError);
  });

  it("rejects invalid stock quantities instead of silently understating availability", () => {
    expect(() => calculate({ inventory: [{ warehouse_id: "warehouse-a", variant_id: "variant-a", on_hand: 2, reserved: 3 }] }))
      .toThrow(AnalyticsDataIntegrityError);
  });
});
