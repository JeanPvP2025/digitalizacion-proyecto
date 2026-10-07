import { NextResponse } from "next/server";
import { checkSupportAgentRole, getConnectedSupportSession } from "@/lib/support/auth";
import { returnReviewSchema, reviewReturn, supportTicketIdSchema } from "@/lib/support/workflow";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };
type RouteContext = { params: Promise<{ returnId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { returnId } = await params;
  if (!supportTicketIdSchema.safeParse(returnId).success) {
    return NextResponse.json({ error: "La solicitud de devolución no existe." }, { status: 404, headers: privateHeaders });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400, headers: privateHeaders });
  }
  const submission = returnReviewSchema.safeParse(body);
  if (!submission.success) {
    return NextResponse.json({ error: "Elige una decisión e indica un motivo válido si rechazas la devolución." }, { status: 400, headers: privateHeaders });
  }

  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return NextResponse.json({ error: "La revisión requiere una cuenta conectada." }, { status: 503, headers: privateHeaders });
  }
  if (session.kind === "unauthenticated") {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión para revisar la devolución." }, { status: 401, headers: privateHeaders });
  }
  const role = await checkSupportAgentRole(session.supabase, session.user.id);
  if (role.error) return NextResponse.json({ error: "No se pudo comprobar el permiso de soporte." }, { status: 500, headers: privateHeaders });
  if (!role.allowed) return NextResponse.json({ error: "Solo el equipo de soporte puede resolver devoluciones." }, { status: 403, headers: privateHeaders });

  const result = await reviewReturn(session.supabase, returnId, submission.data);
  if (result.error) {
    if (result.error.code === "P0002") return NextResponse.json({ error: "La solicitud de devolución no existe." }, { status: 404, headers: privateHeaders });
    if (result.error.code === "42501") return NextResponse.json({ error: "No tienes permiso para resolver esta devolución." }, { status: 403, headers: privateHeaders });
    if (result.error.code === "23514") return NextResponse.json({ error: "La solicitud ya se resolvió o no cumple las condiciones de entrega, pago confirmado y cantidades reembolsables." }, { status: 409, headers: privateHeaders });
    if (result.error.code === "22023") return NextResponse.json({ error: "La clave de reintento ya se usó con otros datos o la decisión no es válida." }, { status: 409, headers: privateHeaders });
    return NextResponse.json({ error: "No se pudo confirmar la decisión. Puedes reintentar la misma solicitud." }, { status: 500, headers: privateHeaders });
  }
  return NextResponse.json({ persisted: true, ...result.data }, { headers: privateHeaders });
}
