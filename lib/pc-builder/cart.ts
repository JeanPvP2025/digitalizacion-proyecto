import type { PcBuilderCatalogComponent } from "./types";

export type PcBuilderCartLine = {
  id: string;
  variantId: string;
  name: string;
  price: number;
  sku: string;
  quantity: number;
  type: "builder";
};

export type CheckoutCartItem = { productId: string; quantity: number } | { variantId: string; quantity: number };

/** Preserve the exact sellable variant selected from the server catalogue. */
export function toPcBuilderCartLines(components: readonly PcBuilderCatalogComponent[]): PcBuilderCartLine[] {
  return components.map((component) => ({
    id: `variant:${component.variantId}`,
    variantId: component.variantId,
    name: component.name,
    price: component.priceEur,
    sku: component.sku,
    quantity: 1,
    type: "builder",
  }));
}

/** Keep variant-backed cart lines explicit when building the checkout payload. */
export function toCheckoutCartItems(lines: readonly { id: string; variantId?: string; quantity: number }[]): CheckoutCartItem[] {
  return lines.map(({ id, variantId, quantity }) => variantId
    ? { variantId, quantity }
    : { productId: id, quantity });
}
