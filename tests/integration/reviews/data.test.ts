import { describe, expect, it, vi } from "vitest";
import type { SupabaseServerClient } from "@/lib/supabase/auth";
import { createProductReview, listReviewableOrderItems } from "@/lib/reviews/data";

function query(result: unknown) {
  const current: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "insert", "update", "single", "maybeSingle"]) {
    current[method] = vi.fn(() => current);
  }
  current.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return current;
}

describe("review data access", () => {
  it("inserts only customer-authored content and relies on the database for identity", async () => {
    const insertQuery = query({ data: { id: "review-1" }, error: null });
    const supabase = {
      from: vi.fn(() => insertQuery),
    } as unknown as SupabaseServerClient;

    const result = await createProductReview(supabase, {
      productId: "product-1",
      orderItemId: "10000000-0000-4000-8000-000000000001",
      rating: 4,
      title: "Buena compra",
      body: "Llegó en el plazo previsto y cumple con lo que necesitaba.",
    });

    expect(result).toEqual({ ok: true, reviewId: "review-1" });
    const payload = (insertQuery.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("author_id");
    expect(payload).not.toHaveProperty("status");
    expect(payload).toMatchObject({ product_id: "product-1", rating: 4 });
  });

  it("hides every purchase option once the customer has reviewed the product", async () => {
    const tables: Record<string, ReturnType<typeof query>> = {
      orders: query({
        data: [
          { id: "order-1", order_number: "NDR-0001" },
          { id: "order-2", order_number: "NDR-0002" },
        ],
        error: null,
      }),
      order_items: query({
        data: [
          { id: "item-reviewed", order_id: "order-1", product_name: "Portátil", variant_title: "16 GB" },
          { id: "item-available", order_id: "order-2", product_name: "Portátil", variant_title: "32 GB" },
        ],
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn((table: string) => tables[table]),
      rpc: vi.fn().mockResolvedValue({ data: [{ order_item_id: "item-reviewed" }], error: null }),
    } as unknown as SupabaseServerClient;

    const result = await listReviewableOrderItems(supabase, "customer-1", "product-1");
    expect(result).toEqual({ ok: true, data: [] });
    expect(supabase.rpc).toHaveBeenCalledWith("my_reviewed_order_items", { p_product_id: "product-1" });
  });

  it("keeps delivered purchase options when the customer has not reviewed the product", async () => {
    const tables: Record<string, ReturnType<typeof query>> = {
      orders: query({ data: [{ id: "order-1", order_number: "NDR-0001" }], error: null }),
      order_items: query({
        data: [{ id: "item-available", order_id: "order-1", product_name: "Portátil", variant_title: "16 GB" }],
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn((table: string) => tables[table]),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseServerClient;

    const result = await listReviewableOrderItems(supabase, "customer-1", "product-1");
    expect(result).toEqual({
      ok: true,
      data: [{
        id: "item-available",
        orderNumber: "NDR-0001",
        productName: "Portátil",
        variantTitle: "16 GB",
      }],
    });
  });

  it("maps unique-constraint conflicts to duplicate submissions", async () => {
    const insertQuery = query({ data: null, error: { code: "23505" } });
    const supabase = { from: vi.fn(() => insertQuery) } as unknown as SupabaseServerClient;
    const result = await createProductReview(supabase, {
      productId: "product-1",
      orderItemId: "10000000-0000-4000-8000-000000000001",
      rating: 5,
      title: "Segunda opinión",
      body: "Esta línea de pedido ya tenía una opinión enviada anteriormente.",
    });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });
});
