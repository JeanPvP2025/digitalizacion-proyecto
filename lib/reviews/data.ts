import "server-only";

import type { SupabaseServerClient } from "@/lib/supabase/auth";
import type {
  PendingProductReview,
  PublishedProductReview,
  ReviewDecision,
  ReviewSubmission,
  ReviewableOrderItem,
} from "@/lib/reviews/contracts";

type DataResult<T> = { ok: true; data: T } | { ok: false };

type ReviewRow = {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  status?: "pending";
};

export async function listPublishedProductReviews(
  supabase: SupabaseServerClient,
  productId: string,
): Promise<DataResult<{ reviews: PublishedProductReview[]; total: number }>> {
  try {
    const { data, count, error } = await supabase
      .from("product_reviews")
      .select("id, rating, title, body, created_at", { count: "exact" })
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { ok: false };
    const rows = (data ?? []) as Array<Omit<ReviewRow, "product_id">>;
    return {
      ok: true,
      data: {
        reviews: rows.map((row) => ({
          id: String(row.id),
          rating: Number(row.rating),
          title: String(row.title),
          body: String(row.body),
          createdAt: String(row.created_at),
        })),
        total: count ?? rows.length,
      },
    };
  } catch {
    return { ok: false };
  }
}

export async function listReviewableOrderItems(
  supabase: SupabaseServerClient,
  userId: string,
  productId: string,
): Promise<DataResult<ReviewableOrderItem[]>> {
  try {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("customer_id", userId)
      .eq("status", "delivered")
      .order("placed_at", { ascending: false });

    if (ordersError) return { ok: false };
    if (!orders?.length) return { ok: true, data: [] };

    const orderIds = orders.map((order) => String(order.id));
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, variant_title")
      .in("order_id", orderIds)
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (itemsError) return { ok: false };
    if (!items?.length) return { ok: true, data: [] };

    const { data: reviewedItems, error: reviewsError } = await supabase.rpc(
      "my_reviewed_order_items",
      { p_product_id: productId },
    );
    if (reviewsError) return { ok: false };

    const reviewedRows = (reviewedItems ?? []) as Array<{ order_item_id: string }>;
    if (reviewedRows.length > 0) return { ok: true, data: [] };
    const orderNumbers = new Map(orders.map((order) => [String(order.id), String(order.order_number)]));
    return {
      ok: true,
      data: items.map((item) => ({
        id: String(item.id),
        orderNumber: orderNumbers.get(String(item.order_id)) ?? "Pedido entregado",
        productName: String(item.product_name),
        variantTitle: String(item.variant_title),
      })),
    };
  } catch {
    return { ok: false };
  }
}

export async function createProductReview(
  supabase: SupabaseServerClient,
  submission: ReviewSubmission,
): Promise<{ ok: true; reviewId: string } | { ok: false; reason: "duplicate" | "not_eligible" | "database_error" }> {
  const { data, error } = await supabase
    .from("product_reviews")
    .insert({
      product_id: submission.productId,
      order_item_id: submission.orderItemId,
      rating: submission.rating,
      title: submission.title,
      body: submission.body,
    })
    .select("id")
    .single();

  if (!error && data) return { ok: true, reviewId: String(data.id) };
  if (error?.code === "23505") return { ok: false, reason: "duplicate" };
  if (error?.code === "42501" || error?.code === "23514") return { ok: false, reason: "not_eligible" };
  return { ok: false, reason: "database_error" };
}

export async function listPendingProductReviews(
  supabase: SupabaseServerClient,
): Promise<DataResult<PendingProductReview[]>> {
  try {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id, product_id, rating, title, body, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) return { ok: false };
    const rows = (data ?? []) as ReviewRow[];
    if (rows.length === 0) return { ok: true, data: [] };
    const productIds = [...new Set(rows.map((row) => String(row.product_id)))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    if (productsError) return { ok: false };
    const productNames = new Map((products ?? []).map((product) => [String(product.id), String(product.name)]));
    return {
      ok: true,
      data: rows
        .filter((row) => row.status === "pending")
        .map((row) => ({
          id: String(row.id),
          productId: String(row.product_id),
          productName: productNames.get(String(row.product_id)) ?? "Producto no disponible",
          rating: Number(row.rating),
          title: String(row.title),
          body: String(row.body),
          createdAt: String(row.created_at),
          status: "pending",
        })),
    };
  } catch {
    return { ok: false };
  }
}

export async function moderateProductReview(
  supabase: SupabaseServerClient,
  reviewId: string,
  decision: ReviewDecision,
): Promise<{ ok: true } | { ok: false; reason: "not_pending" | "database_error" }> {
  try {
    const { data, error } = await supabase
      .from("product_reviews")
      .update({
        status: decision.status,
        moderation_note: decision.note || null,
      })
      .eq("id", reviewId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23514") return { ok: false, reason: "not_pending" };
      return { ok: false, reason: "database_error" };
    }
    return data ? { ok: true } : { ok: false, reason: "not_pending" };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}
