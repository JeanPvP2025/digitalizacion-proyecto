import { z } from "zod";

const checkoutItemSelectorError = "Cada artículo debe incluir exactamente uno: productId o variantId.";
export type CheckoutRequestItem =
  | { productId: string; quantity: number }
  | { variantId: string; quantity: number };

export const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1).max(140).optional(),
  variantId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(10),
}).strict()
  .superRefine((item, context) => {
    if (Boolean(item.productId) === Boolean(item.variantId)) {
      context.addIssue({ code: "custom", message: checkoutItemSelectorError, path: ["variantId"] });
    }
  })
  .transform((item): CheckoutRequestItem => item.productId
    ? { productId: item.productId, quantity: item.quantity }
    : { variantId: item.variantId!, quantity: item.quantity });

export { checkoutItemSelectorError };

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(200),
  phone: z.string().trim().max(30).default(""),
  address: z.string().trim().min(5).max(160),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
}).strict();

export const checkoutPaymentMethodSchema = z.enum([
  "approved",
  "declined",
  "insufficient_funds",
  "processing",
  "temporary_error",
]);

export const checkoutRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(32),
  idempotencyKey: z.uuid(),
  customer: checkoutCustomerSchema,
  paymentMethod: checkoutPaymentMethodSchema.optional(),
}).strict();

const demoCheckoutResponseSchema = z.object({
  mode: z.literal("demo"),
  orderNumber: z.string().min(8).max(64),
  idempotencyKey: z.uuid(),
  paymentStatus: z.enum(["approved", "declined", "insufficient_funds", "processing", "temporary_error"]),
  orderStatus: z.enum(["confirmed", "payment_processing", "pending"]),
  message: z.string().min(1).max(300),
}).strict();

const supabaseCheckoutResponseSchema = z.object({
  mode: z.literal("supabase"),
  orderId: z.uuid(),
  orderNumber: z.string().min(8).max(64),
  idempotencyKey: z.uuid(),
  paymentStatus: z.enum(["approved", "declined", "insufficient_funds", "processing", "temporary_error"]),
  orderStatus: z.enum(["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]),
  total: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  message: z.string().min(1).max(300),
}).strict();

export const checkoutResponseSchema = z.discriminatedUnion("mode", [
  demoCheckoutResponseSchema,
  supabaseCheckoutResponseSchema,
]);

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
