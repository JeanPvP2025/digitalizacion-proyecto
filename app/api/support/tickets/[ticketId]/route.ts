import { NextResponse } from "next/server";
import { getConnectedSupportSession } from "@/lib/support/auth";
import { loadSupportTicket, supportTicketIdSchema } from "@/lib/support/workflow";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };
type RouteContext = { params: Promise<{ ticketId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { ticketId } = await params;
  const parsedId = supportTicketIdSchema.safeParse(ticketId);
  if (!parsedId.success) return NextResponse.json({ error: "El ticket solicitado no existe." }, { status: 404, headers: privateHeaders });

  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return NextResponse.json({ error: "El historial de soporte requiere una cuenta conectada." }, { status: 503, headers: privateHeaders });
  }
  if (session.kind === "unauthenticated") {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión para consultar este ticket." }, { status: 401, headers: privateHeaders });
  }

  const result = await loadSupportTicket(session.supabase, ticketId);
  if (result.error) return NextResponse.json({ error: "No se pudo cargar el ticket." }, { status: 500, headers: privateHeaders });
  if (!result.data) return NextResponse.json({ error: "El ticket solicitado no existe." }, { status: 404, headers: privateHeaders });
  return NextResponse.json(result.data, { headers: privateHeaders });
}
