import { z } from "zod";

const imageUrlSchema = z.string().trim().max(2048).nullable().transform((value, context) => {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return value;
  } catch {
    // The message below covers malformed URLs.
  }
  context.addIssue({ code: "custom", message: "Usa una URL HTTP(S) o una ruta de imagen local." });
  return z.NEVER;
});

export const catalogProductChangesSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  summary: z.string().trim().max(500).optional(),
  description: z.string().trim().max(10_000).optional(),
  image_url: imageUrlSchema.optional(),
  image_alt: z.string().trim().max(300).optional(),
  badge: z.string().trim().max(80).nullable().transform((value) => value === "" ? null : value).optional(),
}).strict().refine((changes) => Object.keys(changes).length > 0, {
  message: "Indica al menos un campo editorial para guardar.",
});

export const updateCatalogProductRequestSchema = z.object({
  productId: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  changes: catalogProductChangesSchema,
}).strict();

export type CatalogProductChanges = z.infer<typeof catalogProductChangesSchema>;

export type CatalogAdminProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  summary: string;
  description: string;
  image_url: string | null;
  image_alt: string;
  badge: string | null;
  is_published: boolean;
  updated_at: string;
};

export const CATALOG_UPDATE_RPC = "update_catalog_product_editorial" as const;
