import { NextResponse } from "next/server";
import { checkSupportAgentRole, getConnectedSupportSession } from "@/lib/support/auth";
import { sendSupportMessage, supportMessageSchema, supportTicketIdSchema } from "@/lib/support/workflow";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };
type RouteContext = { params: Promise<{ ticketId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { ticketId } = await params;
  if (!supportTicketIdSchema.safeParse(ticketId).success) {
    return NextResponse.json({ error: "El ticket solicitado no existe." }, { status: 404, headers: privateHeaders });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400, headers: privateHeaders });
  }
  const submission = supportMessageSchema.safeParse(body);
  if (!submission.success) {
    return NextResponse.json({ error: "Revisa el mensaje, su estado y la clave de reintento." }, { status: 400, headers: privateHeaders });
  }

  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return NextResponse.json({ error: "La conversación de soporte requiere una cuenta conectada." }, { status: 503, headers: privateHeaders });
  }
  if (session.kind === "unauthenticated") {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión para responder a este ticket." }, { status: 401, headers: privateHeaders });
  }
  if (submission.data.status) {
    const role = await checkSupportAgentRole(session.supabase, session.user.id);
    if (role.error) return NextResponse.json({ error: "No se pudo comprobar el permiso de soporte." }, { status: 500, headers: privateHeaders });
    if (!role.allowed) return NextResponse.json({ error: "Solo el equipo de soporte puede cambiar el estado del ticket." }, { status: 403, headers: privateHeaders });
  }

  const result = await sendSupportMessage(session.supabase, ticketId, submission.data);
  if (result.error) {
    if (result.error.code === "P0002") return NextResponse.json({ error: "El ticket solicitado no existe." }, { status: 404, headers: privateHeaders });
    if (result.error.code === "42501") return NextResponse.json({ error: "No tienes permiso para realizar esta acción." }, { status: 403, headers: privateHeaders });
    if (result.error.code === "23514" || result.error.code === "22023") return NextResponse.json({ error: "El estado cambió o la clave de reintento se usó con otros datos. Actualiza el ticket." }, { status: 409, headers: privateHeaders });
    return NextResponse.json({ error: "No se pudo guardar el mensaje. Puedes reintentar la misma solicitud." }, { status: 500, headers: privateHeaders });
  }
  return NextResponse.json({ persisted: true, ...result.data }, { headers: privateHeaders });
}
