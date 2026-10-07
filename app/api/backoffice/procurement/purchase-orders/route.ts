import { z } from "zod";
import { authorizeProcurementApi, callProcurementRpc, errorResponse, isSameOriginMutation, mapRpcError, privateHeaders } from "@/lib/inventory/procurement/http";
import { createPurchaseOrderSchema } from "@/lib/inventory/procurement/contracts";

export const runtime = "nodejs";

const resultSchema = z.object({
  success: z.literal(true), purchaseOrderId: z.uuid(), orderNumber: z.string(), status: z.literal("draft"),
}).strict();

export async function POST(request: Request) {
  const access = await authorizeProcurementApi();
  if (access.status !== "ready") return access.response;
  if (!isSameOriginMutation(request)) return errorResponse("Origen de solicitud no permitido.", 403);

  let body: unknown;
  try { body = await request.json(); }
  catch { return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400); }
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Revisa proveedor, almacén y líneas del pedido.", 400);

  const input = parsed.data;
  const { data, error } = await callProcurementRpc(access.supabase, "create_purchase_order", {
    p_supplier_id: input.supplierId, p_warehouse_id: input.warehouseId,
    p_expected_delivery: input.expectedDelivery, p_notes: input.notes,
    p_lines: input.lines,
  });
  if (error) {
    const mapped = mapRpcError(error.code);
    console.error("NODRIA purchase order create failed", { code: error.code ?? "unknown" });
    return errorResponse(mapped.message, mapped.status);
  }
  const result = resultSchema.safeParse(data);
  if (!result.success) return errorResponse("La base de datos devolvió una respuesta de pedido inválida.", 503);
  return Response.json({ purchaseOrder: result.data }, { status: 201, headers: privateHeaders });
}
