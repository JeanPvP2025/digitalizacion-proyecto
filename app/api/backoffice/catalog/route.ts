import { getCatalogAdminAccess } from "@/lib/catalog/admin/access";
import { CATALOG_UPDATE_RPC, updateCatalogProductRequestSchema } from "@/lib/catalog/admin/contracts";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}

function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; }
  catch { return false; }
}

export async function PATCH(request: Request) {
  const access = await getCatalogAdminAccess();
  if (access.status === "unauthenticated") return errorResponse("Inicia sesión con una cuenta de catálogo.", 401);
  if (access.status === "forbidden") return errorResponse("Tu cuenta no tiene permiso para editar el catálogo.", 403);
  if (access.status === "not_configured") return errorResponse("La gestión de catálogo no está disponible en este momento.", 503);
  if (access.status === "error") return errorResponse("No se han podido comprobar los permisos de catálogo.", 503);
  if (!isSameOriginMutation(request)) return errorResponse("Origen de solicitud no permitido.", 403);

  let body: unknown;
  try { body = await request.json(); }
  catch { return errorResponse("El cuerpo de la solicitud no es JSON válido.", 400); }

  const parsed = updateCatalogProductRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Revisa los campos editoriales del producto.", 400);

  try {
    // This exact RPC is the sole mutation boundary. The session client preserves the caller's JWT for RLS.
    const { error } = await access.supabase.rpc(CATALOG_UPDATE_RPC, {
      p_product_id: parsed.data.productId,
      p_changes: parsed.data.changes,
    });
    if (error) {
      console.error("NODRIA catalog update failed", { code: error.code ?? "unknown" });
      if (error.code === "PGRST202") return errorResponse("La edición del catálogo aún no está disponible en este entorno.", 503);
      if (error.code === "42501") return errorResponse("Tu cuenta no tiene permiso para editar este producto.", 403);
      if (error.code === "P0002") return errorResponse("No encontramos ese producto.", 404);
      if (error.code === "22023" || error.code === "22P02" || error.code === "23514") {
        return errorResponse("Revisa los valores indicados y vuelve a intentarlo.", 400);
      }
      return errorResponse("No se pudo guardar. Comprueba la conexión y vuelve a intentarlo.", 503);
    }
    return Response.json({ saved: true }, { headers: privateHeaders });
  } catch (error) {
    const missingFunction = error instanceof Error && /update_catalog_product|function.*not found|schema cache/i.test(error.message);
    if (missingFunction) return errorResponse("La edición del catálogo aún no está disponible en este entorno.", 503);
    return errorResponse("No se pudo guardar. Comprueba la conexión y vuelve a intentarlo.", 503);
  }
}
