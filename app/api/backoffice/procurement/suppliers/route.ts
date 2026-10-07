import { z } from "zod";
import { authorizeProcurementApi, callProcurementRpc, errorResponse, isSameOriginMutation, mapRpcError, privateHeaders } from "@/lib/inventory/procurement/http";
import { createSupplierSchema } from "@/lib/inventory/procurement/contracts";

export const runtime = "nodejs";

const supplierResponseSchema = z.array(z.object({
  id: z.uuid(), supplier_code: z.string(), name: z.string(), contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(), notes: z.string().nullable(), is_active: z.boolean(), created_at: z.string(),
}).strict()).length(1);

export async function POST(request: Request) {
  const access = await authorizeProcurementApi();
  if (access.status !== "ready") return access.response;
  if (!isSameOriginMutation(request)) return errorResponse("Origen de solicitud no permitido.", 403);

  let body: unknown;
  try { body = await request.json(); }
  catch { return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400); }
  const parsed = createSupplierSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Revisa los datos del proveedor.", 400);

  const input = parsed.data;
  const { data, error } = await callProcurementRpc(access.supabase, "create_procurement_supplier", {
    p_name: input.name, p_contact_email: input.contactEmail || null,
    p_contact_phone: input.contactPhone, p_notes: input.notes,
  });
  if (error) {
    const mapped = mapRpcError(error.code);
    console.error("NODRIA procurement supplier create failed", { code: error.code ?? "unknown" });
    return errorResponse(mapped.message, mapped.status);
  }
  const result = supplierResponseSchema.safeParse(data);
  if (!result.success) return errorResponse("La base de datos devolvió un proveedor inválido.", 503);
  const row = result.data[0];
  return Response.json({ supplier: {
    id: row.id, code: row.supplier_code, name: row.name, contactEmail: row.contact_email,
    contactPhone: row.contact_phone, notes: row.notes, isActive: row.is_active, createdAt: row.created_at,
  } }, { status: 201, headers: privateHeaders });
}
