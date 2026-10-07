import { NextResponse } from "next/server";
import { checkSupportAgentRole, getConnectedSupportSession } from "@/lib/support/auth";
import { loadReturnCases } from "@/lib/support/workflow";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return NextResponse.json({ error: "La bandeja de devoluciones requiere una cuenta conectada." }, { status: 503, headers: privateHeaders });
  }
  if (session.kind === "unauthenticated") {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión para abrir la bandeja de soporte." }, { status: 401, headers: privateHeaders });
  }
  const role = await checkSupportAgentRole(session.supabase, session.user.id);
  if (role.error) return NextResponse.json({ error: "No se pudo comprobar el permiso de soporte." }, { status: 500, headers: privateHeaders });
  if (!role.allowed) return NextResponse.json({ error: "Esta bandeja está reservada al equipo de soporte." }, { status: 403, headers: privateHeaders });

  const result = await loadReturnCases(session.supabase, true);
  if (result.error) return NextResponse.json({ error: "No se pudo cargar la bandeja de devoluciones." }, { status: 500, headers: privateHeaders });
  return NextResponse.json({ returns: result.data }, { headers: privateHeaders });
}
