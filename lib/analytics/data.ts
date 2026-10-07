import "server-only";

import { getServerDataMode } from "@/lib/server/data-mode";
import { getServerAuthState } from "@/lib/supabase/auth";
import {
  AnalyticsDataIntegrityError,
  calculateAnalyticsMetrics,
  createAnalyticsPeriod,
  TERMINAL_PAYMENT_STATUSES,
  type AnalyticsCrmRow,
  type AnalyticsInventoryRow,
  type AnalyticsMetrics,
  type AnalyticsOrderRow,
  type AnalyticsPaymentEventRow,
  type AnalyticsPaymentRow,
  type AnalyticsPeriod,
} from "@/lib/analytics/metrics";

const PAGE_SIZE = 500;
const MAX_ROWS_PER_SOURCE = 5_000;

type QueryResult<T> = {
  data: T[] | null;
  error: { code?: string } | null;
};

type ReadResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; reason: "query" | "limit" };

export type AnalyticsSnapshot =
  | { state: "not_configured" }
  | { state: "unauthenticated" }
  | { state: "forbidden" }
  | { state: "error"; reason: "query" | "limit" | "inconsistent" }
  | {
      state: "ready";
      period: AnalyticsPeriod;
      generatedAt: string;
      metrics: AnalyticsMetrics;
    };

/** Reads every page in a stable order and fails closed if a source exceeds its safety cap. */
async function readAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<QueryResult<T>>,
): Promise<ReadResult<T>> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    if (page.error || !page.data) return { ok: false, reason: "query" };

    rows.push(...page.data);
    if (rows.length > MAX_ROWS_PER_SOURCE) return { ok: false, reason: "limit" };
    if (page.data.length < PAGE_SIZE) return { ok: true, rows };
  }
}

function failureReason(results: ReadResult<unknown>[]): "query" | "limit" | null {
  if (results.some((result) => !result.ok && result.reason === "query")) return "query";
  if (results.some((result) => !result.ok && result.reason === "limit")) return "limit";
  return null;
}

/** Server-only, RLS-backed analytics read. No filesystem fixtures or service-role client are used. */
export async function getAnalyticsSnapshot(asOf = new Date()): Promise<AnalyticsSnapshot> {
  try {
    if (getServerDataMode() !== "supabase") return { state: "not_configured" };

    const auth = await getServerAuthState();
    if (auth.kind === "demo") return { state: "not_configured" };
    if (auth.kind === "signed-out") return { state: "unauthenticated" };

    const roleResult = await auth.supabase
      .from("user_role_grants")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleResult.error) return { state: "error", reason: "query" };
    if (!roleResult.data) return { state: "forbidden" };

    // Use only the persisted grant and authenticated Supabase client. RLS remains active.
    const supabase = auth.supabase;

    const period = createAnalyticsPeriod(asOf);
    const [orders, events, payments, inventory, crmRequests] = await Promise.all([
      readAllRows<AnalyticsOrderRow>((from, to) => supabase
        .from("orders")
        .select("id, placed_at, status")
        .gte("placed_at", period.startInclusive)
        .lt("placed_at", period.endExclusive)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<AnalyticsOrderRow[]>()),
      readAllRows<AnalyticsPaymentEventRow>((from, to) => supabase
        .from("order_events")
        .select("id, order_id, event_key, occurred_at")
        .in("event_key", ["payment_paid", "payment_failed"])
        .gte("occurred_at", period.startInclusive)
        .lt("occurred_at", period.endExclusive)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<AnalyticsPaymentEventRow[]>()),
      readAllRows<AnalyticsPaymentRow>((from, to) => supabase
        .from("payment_transactions")
        .select("id, order_id, status, amount, currency, processed_at, order:orders!inner(id, status, grand_total, currency)")
        .in("status", [...TERMINAL_PAYMENT_STATUSES])
        .gte("processed_at", period.startInclusive)
        .lt("processed_at", period.endExclusive)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<AnalyticsPaymentRow[]>()),
      readAllRows<AnalyticsInventoryRow>((from, to) => supabase
        .from("inventory")
        .select("warehouse_id, variant_id, on_hand, reserved")
        .order("warehouse_id", { ascending: true })
        .order("variant_id", { ascending: true })
        .range(from, to)
        .returns<AnalyticsInventoryRow[]>()),
      readAllRows<AnalyticsCrmRow>((from, to) => supabase
        .from("quote_inquiries")
        .select("id, created_at, status")
        .gte("created_at", period.startInclusive)
        .lt("created_at", period.endExclusive)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<AnalyticsCrmRow[]>()),
    ]);

    const reads = [orders, events, payments, inventory, crmRequests];
    const reason = failureReason(reads);
    if (!orders.ok || !events.ok || !payments.ok || !inventory.ok || !crmRequests.ok) {
      return { state: "error", reason: reason ?? "query" };
    }

    try {
      const metrics = calculateAnalyticsMetrics({
        period,
        orders: orders.rows,
        paymentEvents: events.rows,
        payments: payments.rows,
        inventory: inventory.rows,
        crmRequests: crmRequests.rows,
      });

      return {
        state: "ready",
        period,
        generatedAt: asOf.toISOString(),
        metrics,
      };
    } catch (error) {
      if (error instanceof AnalyticsDataIntegrityError) return { state: "error", reason: "inconsistent" };
      throw error;
    }
  } catch {
    return { state: "error", reason: "query" };
  }
}
