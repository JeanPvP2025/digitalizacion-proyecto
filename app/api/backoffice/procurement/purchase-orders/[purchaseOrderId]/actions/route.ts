import { z } from "zod";
import { authorizeProcurementApi, callProcurementRpc, errorResponse, isSameOriginMutation, mapRpcError, privateHeaders } from "@/lib/inventory/procurement/http";
import { purchaseOrderActionSchema } from "@/lib/inventory/procurement/contracts";

export const runtime = "nodejs";

const resultSchema = z.object({
  success: z.boolean(), replayed: z.boolean().optional(), purchaseOrderId: z.uuid().optional(),
  status: z.string().optional(), errorCode: z.string().optional(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ purchaseOrderId: string }> }) {
  const access = await authorizeProcurementApi();
  if (access.status !== "ready") return access.response;
  if (!isSameOriginMutation(request)) return errorResponse("Origen de solicitud no permitido.", 403);
  const { purchaseOrderId } = await context.params;
  if (!z.uuid().safeParse(purchaseOrderId).success) return errorResponse("El pedido solicitado no es válido.", 400);

  let body: unknown;
  try { body = await request.json(); }
  catch { return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400); }
  const parsed = purchaseOrderActionSchema.safeParse(body);
  if (!parsed.success) return errorResponse("La acción del pedido no es válida.", 400);

  const { data, error } = await callProcurementRpc(access.supabase, "transition_purchase_order", {
    p_purchase_order_id: purchaseOrderId, p_action: parsed.data.action,
  });
  if (error) {
    const mapped = mapRpcError(error.code);
    console.error("NODRIA purchase order transition failed", { code: error.code ?? "unknown" });
    return errorResponse(mapped.message, mapped.status);
  }
  const result = resultSchema.safeParse(data);
  if (!result.success) return errorResponse("La base de datos devolvió un estado de pedido inválido.", 503);
  if (!result.data.success) return errorResponse("El estado actual del pedido no permite esta acción.", 409, { code: result.data.errorCode });
  return Response.json({ purchaseOrder: result.data }, { headers: privateHeaders });
}
