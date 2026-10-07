import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasStaffSurfaceRole, STAFF_SURFACE_ROLES } from "@/lib/supabase/policies";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "no-store" };
const uuid = z.uuid();
const movementRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("receipt"), warehouseId: uuid, variantId: uuid,
    quantity: z.number().int().min(1).max(100000), supplierName: z.string().trim().min(2).max(120),
    supplierReference: z.string().trim().min(1).max(80), idempotencyKey: uuid,
  }).strict(),
  z.object({
    type: z.literal("adjustment"), warehouseId: uuid, variantId: uuid,
    delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0),
    reason: z.string().trim().min(3).max(500), idempotencyKey: uuid,
  }).strict(),
]);

const resultSchema = z.array(z.object({
  movement_id: z.number().int().positive(),
  on_hand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
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

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400);
  }
  const parsed = movementRequestSchema.safeParse(input);
  if (!parsed.success) return errorResponse("Revisa los datos del movimiento y vuelve a intentarlo.", 400);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return errorResponse("Las recepciones requieren una sesión Supabase conectada.", 503);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) return errorResponse("No se ha podido validar la sesión.", 503);
  if (!auth.user) return errorResponse("Inicia sesión con una cuenta de almacén.", 401);

  const { data: grants, error: grantsError } = await supabase.from("user_role_grants")
    .select("role")
    .eq("user_id", auth.user.id)
    .in("role", [...STAFF_SURFACE_ROLES.inventory])
    .returns<{ role: string }[]>();
  if (grantsError) return errorResponse("No se han podido comprobar los permisos de almacén.", 503);
  if (!hasStaffSurfaceRole((grants ?? []).map(({ role }) => role), "inventory")) {
    return errorResponse("Esta acción requiere el rol fulfillment_manager o super_admin.", 403);
  }

  const operation = parsed.data;
  const { data, error } = operation.type === "receipt"
    ? await supabase.rpc("receive_inventory", {
        p_warehouse_id: operation.warehouseId,
        p_variant_id: operation.variantId,
        p_quantity: operation.quantity,
        p_supplier_name: operation.supplierName,
        p_supplier_reference: operation.supplierReference,
        p_idempotency_key: operation.idempotencyKey,
      })
    : await supabase.rpc("adjust_inventory", {
        p_warehouse_id: operation.warehouseId,
        p_variant_id: operation.variantId,
        p_delta: operation.delta,
        p_reason: operation.reason,
        p_idempotency_key: operation.idempotencyKey,
      });

  if (error) {
    if (error.code === "42501") return errorResponse("La base de datos ha rechazado este movimiento por permisos.", 403);
    if (error.code === "22023") return errorResponse("Los datos del movimiento no son válidos.", 400);
    if (error.code === "23505") return errorResponse("Esta clave de reintento ya se usó con otros datos. Inicia un movimiento nuevo.", 409);
    if (error.code === "23514") return errorResponse("El ajuste no puede reducir el stock por debajo de las unidades reservadas.", 409);
    if (error.code === "P0002") return errorResponse("No encontramos esa referencia de stock en el almacén.", 404);
    console.error("NODRIA inventory movement failed", { code: error.code ?? "unknown" });
    return errorResponse("No se ha podido guardar el movimiento. Reintenta con la misma referencia.", 503);
  }

  const result = resultSchema.safeParse(data);
  if (!result.success) return errorResponse("La base de datos devolvió una respuesta de movimiento inválida.", 503);
  return NextResponse.json({ movement: result.data[0] }, { status: 200, headers: privateHeaders });
}
