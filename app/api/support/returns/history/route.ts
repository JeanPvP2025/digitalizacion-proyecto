import { NextResponse } from "next/server";
import { getConnectedSupportSession } from "@/lib/support/auth";
import { loadReturnCases } from "@/lib/support/workflow";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return NextResponse.json({ error: "El historial de devoluciones requiere una cuenta conectada." }, { status: 503, headers: privateHeaders });
  }
  if (session.kind === "unauthenticated") {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión para consultar tus devoluciones." }, { status: 401, headers: privateHeaders });
  }

  const result = await loadReturnCases(session.supabase);
  if (result.error) return NextResponse.json({ error: "No se pudo cargar el historial de devoluciones." }, { status: 500, headers: privateHeaders });
  return NextResponse.json({ returns: result.data }, { headers: privateHeaders });
}
