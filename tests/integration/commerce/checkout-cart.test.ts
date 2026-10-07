import { describe, expect, it } from "vitest";
import { CheckoutCartError, consolidateCheckoutItems, resolveCheckoutCartItems } from "@/lib/commerce/cart";

const variantId = "11111111-1111-4111-8111-111111111111";
const siblingVariantId = "22222222-2222-4222-8222-222222222222";

describe("checkout cart variant contract", () => {
  it("consolidates repeated explicit variant lines", () => {
    expect(consolidateCheckoutItems([
      { variantId, quantity: 2 },
      { variantId, quantity: 3 },
    ])).toEqual([{ variantId, quantity: 5 }]);
  });

  it("applies the quantity limit across product and explicit variant references after resolution", () => {
    expect(() => resolveCheckoutCartItems([
      { productId: "pr_loom27", quantity: 6 },
      { variantId, quantity: 5 },
    ], [{ id: variantId, product_id: "pr_loom27" }])).toThrowError(
      expect.objectContaining<Partial<CheckoutCartError>>({ code: "quantity_limit" }),
    );
  });

  it("resolves an explicit variant without selecting its sibling", () => {
    expect(resolveCheckoutCartItems(
      [{ variantId, quantity: 2 }],
      [
        { id: variantId, product_id: "pr_loom27" },
        { id: siblingVariantId, product_id: "pr_loom27" },
      ],
    )).toEqual([{ variant_id: variantId, quantity: 2 }]);
  });

  it("continues to resolve a legacy product only when exactly one variant is visible", () => {
    expect(resolveCheckoutCartItems(
      [{ productId: "pr_loom27", quantity: 1 }],
      [{ id: variantId, product_id: "pr_loom27" }],
    )).toEqual([{ variant_id: variantId, quantity: 1 }]);

    expect(() => resolveCheckoutCartItems(
      [{ productId: "pr_loom27", quantity: 1 }],
      [
        { id: variantId, product_id: "pr_loom27" },
        { id: siblingVariantId, product_id: "pr_loom27" },
      ],
    )).toThrowError(expect.objectContaining<Partial<CheckoutCartError>>({ code: "ambiguous_variant" }));
  });

  it("rejects a selected variant that is not in the server-validated sellable set", () => {
    expect(() => resolveCheckoutCartItems([{ variantId, quantity: 1 }], [])).toThrowError(
      expect.objectContaining<Partial<CheckoutCartError>>({ code: "unavailable" }),
    );
  });
});
