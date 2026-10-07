import { NextResponse } from "next/server";
import { getServerDataMode } from "@/lib/server/data-mode";
import { canModerateReviews } from "@/lib/reviews/authorization";
import { moderateProductReview } from "@/lib/reviews/data";
import { reviewIdSchema, reviewModerationSchema } from "@/lib/reviews/contracts";
import { getStaffRoleGrants, getServerAuthState } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function PATCH(
  request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  if (getServerDataMode() !== "supabase") {
    return NextResponse.json({ error: "La moderación requiere conexión con Supabase." }, { status: 503, headers: privateHeaders });
  }

  const { reviewId } = await context.params;
  if (!reviewIdSchema.safeParse(reviewId).success) {
    return NextResponse.json({ error: "Opinión no válida." }, { status: 400, headers: privateHeaders });
  }

  const auth = await getServerAuthState();
  if (auth.kind !== "signed-in") {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión para moderar opiniones." }, { status: 401, headers: privateHeaders });
  }

  const roleGrants = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (roleGrants.error) {
    return NextResponse.json({ error: "No se pudo comprobar el permiso de moderación." }, { status: 500, headers: privateHeaders });
  }
  if (!canModerateReviews(roleGrants.roles)) {
    return NextResponse.json({ error: "No tienes permiso para moderar opiniones." }, { status: 403, headers: privateHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400, headers: privateHeaders });
  }
  const decision = reviewModerationSchema.safeParse(body);
  if (!decision.success) {
    return NextResponse.json({ error: "Selecciona publicar o rechazar y revisa la nota." }, { status: 400, headers: privateHeaders });
  }

  const result = await moderateProductReview(auth.supabase, reviewId, decision.data);
  if (!result.ok) {
    if (result.reason === "not_pending") {
      return NextResponse.json({ error: "La opinión ya no está pendiente de moderación." }, { status: 409, headers: privateHeaders });
    }
    return NextResponse.json({ error: "No se pudo guardar la decisión de moderación." }, { status: 500, headers: privateHeaders });
  }

  return NextResponse.json({ persisted: true, status: decision.data.status }, { headers: privateHeaders });
}
