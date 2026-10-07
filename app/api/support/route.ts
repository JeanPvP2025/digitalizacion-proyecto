import { NextResponse } from "next/server";
import { getServerDataMode } from "@/lib/server/data-mode";
import { saveDemoSupportTicket } from "@/lib/server/demo-inbox";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { persistAuthenticatedSupportTicket, supportEmailSchema, supportSubmissionSchema } from "@/lib/support/intake";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const mode = getServerDataMode();
  if (mode === "unavailable") return NextResponse.json({ error: "El soporte no está disponible en este entorno: configura Supabase o activa la demo local en desarrollo." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const result = supportSubmissionSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Revisa los campos obligatorios y vuelve a intentarlo." }, { status: 400 });

  if (mode === "local-demo") {
    const email = supportEmailSchema.safeParse(result.data.email);
    if (!email.success) return NextResponse.json({ error: "Indica un correo válido para la solicitud de demostración." }, { status: 400 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!consumeRateLimit(`support:demo:${ip}`, 5, 60_000)) return NextResponse.json({ error: "Espera un minuto antes de abrir otro ticket." }, { status: 429 });

    const ticketId = `TCK-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      await saveDemoSupportTicket({
        id: ticketId,
        createdAt: new Date().toISOString(),
        status: "open",
        subject: result.data.subject,
        message: result.data.message,
        email: email.data,
        orderNumber: result.data.orderNumber,
      });
      return NextResponse.json({ persisted: true, mode: "demo", ticketId }, { status: 201 });
    } catch (error) {
      console.error("NODRIA demo support persistence failed", error);
      return NextResponse.json({ error: "No se ha podido guardar el ticket demo. Inténtalo más tarde." }, { status: 500 });
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La conexión de soporte no está disponible." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión en tu cuenta para abrir un ticket de soporte." }, { status: 401 });
  }

  if (!consumeRateLimit(`support:user:${authData.user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Espera un minuto antes de abrir otro ticket." }, { status: 429 });
  }

  try {
    const persisted = await persistAuthenticatedSupportTicket(supabase, authData.user.id, result.data);
    if (!persisted.ok) {
      if (persisted.reason === "order_not_owned") {
        return NextResponse.json({ error: "No encontramos ese pedido en tu cuenta. Comprueba la referencia o deja el campo vacío." }, { status: 400 });
      }
      if (persisted.reason === "organization_not_owned") {
        return NextResponse.json({ error: "No encontramos esa organización entre tus cuentas empresariales." }, { status: 400 });
      }
      if (persisted.reason === "idempotency_conflict") {
        return NextResponse.json({ error: "La clave de reintento ya se utilizó con otros datos. Actualiza el formulario antes de volver a enviarlo." }, { status: 409 });
      }
      return NextResponse.json({ error: "No se pudo confirmar el guardado del ticket en Supabase. Inténtalo más tarde." }, { status: 500 });
    }

    return NextResponse.json({ persisted: true, mode: "supabase", ticketId: persisted.ticketId, ticketNumber: persisted.ticketNumber }, { status: 201 });
  } catch (error) {
    console.error("NODRIA support database operation failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "No se pudo confirmar el guardado del ticket en Supabase. Inténtalo más tarde." }, { status: 500 });
  }
}
