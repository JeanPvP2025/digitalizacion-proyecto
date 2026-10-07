import { z } from "zod";
import { authorizeProcurementApi, callProcurementRpc, errorResponse, isSameOriginMutation, mapRpcError, privateHeaders } from "@/lib/inventory/procurement/http";
import { receivePurchaseOrderSchema } from "@/lib/inventory/procurement/contracts";

export const runtime = "nodejs";

const resultSchema = z.object({
  success: z.boolean(), replayed: z.boolean(), receiptId: z.uuid().optional(),
  status: z.string().optional(), errorCode: z.string().nullable().optional(),
}).strict();

const receiptErrors: Record<string, { message: string; status: number }> = {
  idempotency_conflict: { message: "La clave de reintento ya pertenece a otra recepción. Se ha guardado el conflicto; inicia un intento nuevo.", status: 409 },
  purchase_order_not_receivable: { message: "Este pedido no admite recepciones en su estado actual. El intento quedó en el historial.", status: 409 },
  purchase_order_line_not_found: { message: "Una línea ya no pertenece a este pedido. El intento quedó en el historial.", status: 409 },
  quantity_exceeds_pending: { message: "La cantidad supera lo pendiente. No se ha aplicado stock y el rechazo quedó en el historial.", status: 409 },
  inventory_write_failed: { message: "No se pudo aplicar el movimiento de inventario. El fallo quedó registrado; inicia un nuevo intento después de corregir la causa.", status: 503 },
};

export async function POST(request: Request, context: { params: Promise<{ purchaseOrderId: string }> }) {
  const access = await authorizeProcurementApi();
  if (access.status !== "ready") return access.response;
  if (!isSameOriginMutation(request)) return errorResponse("Origen de solicitud no permitido.", 403);
  const { purchaseOrderId } = await context.params;
  if (!z.uuid().safeParse(purchaseOrderId).success) return errorResponse("El pedido solicitado no es válido.", 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400); }
  const parsed = receivePurchaseOrderSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Revisa albarán y cantidades de las líneas seleccionadas.", 400);

  const { data, error } = await callProcurementRpc(access.supabase, "receive_purchase_order", {
    p_purchase_order_id: purchaseOrderId,
    p_supplier_reference: parsed.data.supplierReference,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_lines: parsed.data.lines,
  });
  if (error) {
    const mapped = mapRpcError(error.code);
    console.error("NODRIA purchase order receipt RPC failed", { code: error.code ?? "unknown" });
    return errorResponse(mapped.message, mapped.status);
  }
  const result = resultSchema.safeParse(data);
  if (!result.success) return errorResponse("La base de datos devolvió una recepción inválida.", 503);
  if (!result.data.success) {
    const mapped = receiptErrors[result.data.errorCode ?? ""] ?? { message: "No se ha podido completar la recepción. El intento puede consultarse en el pedido.", status: 409 };
    return errorResponse(mapped.message, mapped.status, { receipt: result.data, code: result.data.errorCode });
  }
  return Response.json({ receipt: result.data }, { headers: privateHeaders });
}
