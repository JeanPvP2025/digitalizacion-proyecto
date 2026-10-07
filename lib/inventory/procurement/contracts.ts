import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);

const supplierFields = {
  name: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().max(254).refine((value) => value === "" || z.email().safeParse(value).success),
  contactPhone: optionalText(40),
  notes: optionalText(500),
};

export const createSupplierSchema = z.object(supplierFields).strict();
export const updateSupplierSchema = z.object({ ...supplierFields, isActive: z.boolean() }).strict();

const purchaseOrderLineSchema = z.object({
  variantId: uuid,
  quantity: z.number().int().min(1).max(100000),
  unitCost: z.string().trim().regex(/^\d{1,10}(?:\.\d{1,2})?$/).transform(Number),
}).strict();

const purchaseOrderFields = {
  supplierId: uuid,
  warehouseId: uuid,
  expectedDelivery: isoDate.or(z.literal("")).transform((value) => value || null),
  notes: z.string().trim().max(1000),
  lines: z.array(purchaseOrderLineSchema).min(1).max(100)
    .refine((lines) => new Set(lines.map((line) => line.variantId)).size === lines.length, "No repitas una variante en el mismo pedido."),
};

export const createPurchaseOrderSchema = z.object(purchaseOrderFields).strict();
export const updatePurchaseOrderSchema = z.object(purchaseOrderFields).strict();

export const purchaseOrderActionSchema = z.object({ action: z.enum(["place", "cancel"]) }).strict();
export const receivePurchaseOrderSchema = z.object({
  supplierReference: z.string().trim().min(1).max(80),
  idempotencyKey: uuid,
  lines: z.array(z.object({ lineId: uuid, quantity: z.number().int().min(1).max(100000) }).strict())
    .min(1).max(100)
    .refine((lines) => new Set(lines.map((line) => line.lineId)).size === lines.length, "No repitas una línea de pedido."),
}).strict();

export type SupplierInput = z.infer<typeof createSupplierSchema>;
export type PurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;
export type ReceiptInput = z.infer<typeof receivePurchaseOrderSchema>;
