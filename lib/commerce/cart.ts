export type RequestedCheckoutItem =
  | { productId: string; quantity: number }
  | { variantId: string; quantity: number };
export type CheckoutVariantRow = { id: string; product_id: string };
export type CheckoutCartItem = { variant_id: string; quantity: number };

export class CheckoutCartError extends Error {
  readonly code: "quantity_limit" | "demo_only" | "unavailable" | "ambiguous_variant";

  constructor(code: "quantity_limit" | "demo_only" | "unavailable" | "ambiguous_variant", message: string) {
    super(message);
    this.code = code;
    this.name = "CheckoutCartError";
  }
}

export function consolidateCheckoutItems(items: RequestedCheckoutItem[], maxQuantity = 10) {
  const consolidated = new Map<string, RequestedCheckoutItem>();

  for (const item of items) {
    const key = "productId" in item ? `product:${item.productId}` : `variant:${item.variantId}`;
    const existing = consolidated.get(key);
    const quantity = (existing?.quantity ?? 0) + item.quantity;
    if (quantity > maxQuantity) {
      throw new CheckoutCartError("quantity_limit", "No se pueden pedir más de 10 unidades del mismo artículo.");
    }
    consolidated.set(key, "productId" in item
      ? { productId: item.productId, quantity }
      : { variantId: item.variantId, quantity });
  }

  return [...consolidated.values()];
}

export function resolveCheckoutCartItems(items: RequestedCheckoutItem[], variants: CheckoutVariantRow[]): CheckoutCartItem[] {
  if (items.some((item) => "productId" in item && item.productId.startsWith("builder:"))) {
    throw new CheckoutCartError("demo_only", "Las piezas del configurador solo se pueden pedir en el checkout demo local.");
  }

  const variantsByProduct = new Map<string, CheckoutVariantRow[]>();
  const variantsById = new Map<string, CheckoutVariantRow>();
  for (const variant of variants) {
    variantsById.set(variant.id, variant);
    const productVariants = variantsByProduct.get(variant.product_id) ?? [];
    productVariants.push(variant);
    variantsByProduct.set(variant.product_id, productVariants);
  }

  const cartItems = new Map<string, number>();
  for (const item of items) {
    let variant: CheckoutVariantRow | undefined;
    if ("variantId" in item) {
      variant = variantsById.get(item.variantId);
      if (!variant) {
        throw new CheckoutCartError("unavailable", "La variante seleccionada ya no está disponible para compra.");
      }
    } else {
      const productVariants = variantsByProduct.get(item.productId) ?? [];
      if (productVariants.length === 0) {
        throw new CheckoutCartError("unavailable", "Uno de los productos ya no está disponible para compra.");
      }
      if (productVariants.length !== 1) {
        throw new CheckoutCartError("ambiguous_variant", "Este producto tiene varias configuraciones; selecciona una variante antes de continuar.");
      }
      [variant] = productVariants;
    }

    const quantity = (cartItems.get(variant.id) ?? 0) + item.quantity;
    if (quantity > 10) {
      throw new CheckoutCartError("quantity_limit", "No se pueden pedir más de 10 unidades del mismo artículo.");
    }
    cartItems.set(variant.id, quantity);
  }

  return [...cartItems].map(([variant_id, quantity]) => ({ variant_id, quantity }));
}
