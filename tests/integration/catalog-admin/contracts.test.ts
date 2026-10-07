import { describe, expect, it } from "vitest";
import { catalogProductChangesSchema, updateCatalogProductRequestSchema } from "@/lib/catalog/admin/contracts";

describe("catalog admin request contracts", () => {
  it("accepts only the six editorial fields and normalizes optional values", () => {
    const result = updateCatalogProductRequestSchema.safeParse({
      productId: "pr_fluxbook14",
      changes: { name: " FluxBook 14 Pro ", image_url: "", badge: " " },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.changes).toEqual({ name: "FluxBook 14 Pro", image_url: null, badge: null });
  });

  it("rejects protected/unknown keys and empty updates", () => {
    expect(catalogProductChangesSchema.safeParse({ is_published: true }).success).toBe(false);
    expect(catalogProductChangesSchema.safeParse({ rating_average: 5 }).success).toBe(false);
    expect(catalogProductChangesSchema.safeParse({ name: "Producto", price: 10 }).success).toBe(false);
    expect(catalogProductChangesSchema.safeParse({}).success).toBe(false);
  });

  it("enforces field lengths, product ids, and safe image URL formats", () => {
    expect(catalogProductChangesSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(catalogProductChangesSchema.safeParse({ summary: "x".repeat(501) }).success).toBe(false);
    expect(catalogProductChangesSchema.safeParse({ image_url: "javascript:alert(1)" }).success).toBe(false);
    expect(catalogProductChangesSchema.safeParse({ image_url: "/products/item.webp" }).success).toBe(true);
    expect(catalogProductChangesSchema.safeParse({ image_url: "https://cdn.example.test/item.webp" }).success).toBe(true);
    expect(updateCatalogProductRequestSchema.safeParse({ productId: "bad/id", changes: { name: "Producto" } }).success).toBe(false);
  });
});
