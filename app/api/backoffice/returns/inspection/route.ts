import { NextResponse } from "next/server";
import { z } from "zod";
import { getProcurementAccess } from "@/lib/inventory/procurement/access";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };
const uuid = z.uuid();
const inspectionSchema = z.object({
  returnRequestId: uuid,
  returnItemId: uuid,
  warehouseId: uuid,
  disposition: z.enum(["restocked", "disposed"]),
  quantity: z.number().int().min(1).max(100000),
  reason: z.string().trim().min(10).max(500),
  idempotencyKey: uuid,
}).strict();
const resultSchema = z.array(z.object({
  return_request_id: uuid,
  return_item_id: uuid,
  disposition: z.enum(["restocked", "disposed"]),
  quantity: z.number().int().positive(),
  inventory_movement_id: z.number().int().positive().nullable(),
  replayed: z.boolean(),
}).strict()).length(1);

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: privateHeaders });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return errorResponse("Origen de solicitud no permitido.", 403);
    } catch {
      return errorResponse("Origen de solicitud no permitido.", 403);
    }
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400); }
  const parsed = inspectionSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Revisa la disposición, cantidad, almacén y motivo de inspección.", 400);

  const access = await getProcurementAccess();
  if (access.status === "not_configured") return errorResponse("La inspección requiere Supabase conectado.", 503);
  if (access.status === "unauthenticated") return errorResponse("Inicia sesión con una cuenta de almacén.", 401);
  if (access.status === "forbidden") return errorResponse("Esta acción requiere fulfillment_manager o super_admin.", 403);
  if (access.status === "error") return errorResponse("No se han podido comprobar los permisos de almacén.", 503);

  const input = parsed.data;
  const { data, error } = await access.supabase.rpc("inspect_return_item", {
    p_return_request_id: input.returnRequestId,
    p_return_item_id: input.returnItemId,
    p_warehouse_id: input.warehouseId,
    p_disposition: input.disposition,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    if (error.code === "42501") return errorResponse("La base de datos ha rechazado la inspección por permisos.", 403);
    if (error.code === "22023") return errorResponse("Los datos de inspección no son válidos.", 400);
    if (error.code === "23505") return errorResponse("Esta devolución ya se inspeccionó o la clave se usó con otros datos.", 409);
    if (error.code === "23514") return errorResponse("La devolución ya no admite esa cantidad o disposición.", 409);
    if (error.code === "P0002") return errorResponse("No encontramos la devolución, línea o almacén activo.", 404);
    console.error("NODRIA return inspection failed", { code: error.code ?? "unknown" });
    return errorResponse("No se pudo registrar la inspección. Reintenta con la misma clave.", 503);
  }

  const result = resultSchema.safeParse(data);
  if (!result.success) return errorResponse("La base de datos devolvió una respuesta de inspección inválida.", 503);
  return NextResponse.json({ inspection: result.data[0] }, { headers: privateHeaders });
}
