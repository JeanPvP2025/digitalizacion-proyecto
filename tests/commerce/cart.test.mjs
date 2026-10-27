import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutCartError, consolidateCheckoutItems, resolveCheckoutCartItems } from "../../lib/commerce/cart.ts";

test("consolidates duplicate product lines without using client prices", () => {
  assert.deepEqual(
    consolidateCheckoutItems([
      { productId: "pr_fluxbook14", quantity: 2 },
      { productId: "pr_fluxbook14", quantity: 3 },
      { productId: "pr_loom27", quantity: 1 },
    ]),
    [
      { productId: "pr_fluxbook14", quantity: 5 },
      { productId: "pr_loom27", quantity: 1 },
    ],
  );
});

test("rejects a combined quantity over the checkout limit", () => {
  assert.throws(
    () => consolidateCheckoutItems([{ productId: "pr_fluxbook14", quantity: 6 }, { productId: "pr_fluxbook14", quantity: 5 }]),
    (error) => error instanceof CheckoutCartError && error.code === "quantity_limit",
  );
});

test("maps each product to its only active, visible variant", () => {
  assert.deepEqual(
    resolveCheckoutCartItems(
      [{ productId: "pr_fluxbook14", quantity: 2 }, { productId: "pr_loom27", quantity: 1 }],
      [{ id: "variant-fluxbook", product_id: "pr_fluxbook14" }, { id: "variant-loom", product_id: "pr_loom27" }],
    ),
    [{ variant_id: "variant-fluxbook", quantity: 2 }, { variant_id: "variant-loom", quantity: 1 }],
  );
});

test("rejects PC builder fixtures from the connected Supabase checkout", () => {
  assert.throws(
    () => resolveCheckoutCartItems([{ productId: "builder:cpu-amd", quantity: 1 }], []),
    (error) => error instanceof CheckoutCartError && error.code === "demo_only",
  );
});

test("rejects products with no variant or multiple indistinguishable variants", () => {
  assert.throws(
    () => resolveCheckoutCartItems([{ productId: "pr_missing", quantity: 1 }], []),
    (error) => error instanceof CheckoutCartError && error.code === "unavailable",
  );
  assert.throws(
    () => resolveCheckoutCartItems([{ productId: "pr_fluxbook14", quantity: 1 }], [
      { id: "variant-a", product_id: "pr_fluxbook14" },
      { id: "variant-b", product_id: "pr_fluxbook14" },
    ]),
    (error) => error instanceof CheckoutCartError && error.code === "ambiguous_variant",
  );
});


test("consolidates matching product lines across catalogue and variant mapping", () => {
  const variantToProduct = new Map([["var_flux1", "pr_fluxbook14"]]);
  assert.deepEqual(
    consolidateCheckoutItems(
      [
        { productId: "pr_fluxbook14", quantity: 3 },
        { variantId: "var_flux1", quantity: 2 },
      ],
      10,
      variantToProduct,
    ),
    [
      { productId: "pr_fluxbook14", quantity: 5 },
    ],
  );
});

test("rejects combined quantity across catalogue and builder variant exceeding limit", () => {
  const variantToProduct = new Map([["var_flux1", "pr_fluxbook14"]]);
  assert.throws(
    () =>
      consolidateCheckoutItems(
        [
          { productId: "pr_fluxbook14", quantity: 6 },
          { variantId: "var_flux1", quantity: 6 },
        ],
        10,
        variantToProduct,
      ),
    (error) => error instanceof CheckoutCartError && error.code === "quantity_limit",
  );
});
