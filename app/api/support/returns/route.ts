import { NextResponse } from "next/server";
import { getServerDataMode } from "@/lib/server/data-mode";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createReturnRequest,
  loadReturnableOrder,
  orderNumberSchema,
  returnRequestSchema,
} from "@/lib/support/returns";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "no-store" };

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, userId: null };
  return { supabase, userId: data.user.id };
}

export async function GET(request: Request) {
  const mode = getServerDataMode();
  if (mode !== "supabase") {
    return NextResponse.json({ error: "Las devoluciones requieren una cuenta conectada con pedidos guardados en Supabase." }, { status: 503, headers: privateHeaders });
  }

  const orderNumber = orderNumberSchema.safeParse(new URL(request.url).searchParams.get("orderNumber"));
  if (!orderNumber.success) {
    return NextResponse.json({ error: "Indica el número del pedido que quieres devolver." }, { status: 400, headers: privateHeaders });
  }

  const { supabase, userId } = await getAuthenticatedClient();
  if (!supabase) return NextResponse.json({ error: "La conexión de soporte no está disponible." }, { status: 503, headers: privateHeaders });
  if (!userId) return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión con la cuenta que realizó el pedido." }, { status: 401, headers: privateHeaders });

  const result = await loadReturnableOrder(supabase, userId, orderNumber.data);
  if (!result.ok) {
    if (result.reason === "order_not_owned") {
      return NextResponse.json({ error: "No encontramos ese pedido en tu cuenta." }, { status: 404, headers: privateHeaders });
    }
    if (result.reason === "not_eligible") {
      return NextResponse.json({ error: "Solo se aceptan devoluciones de pedidos entregados durante los 30 días posteriores a la entrega." }, { status: 409, headers: privateHeaders });
    }
    if (result.reason === "no_units_left") {
      return NextResponse.json({ error: "No quedan unidades disponibles para solicitar una devolución de este pedido." }, { status: 409, headers: privateHeaders });
    }
    return NextResponse.json({ error: "No se pudo comprobar la elegibilidad del pedido." }, { status: 500, headers: privateHeaders });
  }

  return NextResponse.json(result, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (getServerDataMode() !== "supabase") {
    return NextResponse.json({ error: "Las devoluciones requieren una cuenta conectada con pedidos guardados en Supabase." }, { status: 503, headers: privateHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400, headers: privateHeaders });
  }
  const submission = returnRequestSchema.safeParse(body);
  if (!submission.success) {
    return NextResponse.json({ error: "Revisa el pedido, el motivo y las unidades seleccionadas." }, { status: 400, headers: privateHeaders });
  }

  const { supabase, userId } = await getAuthenticatedClient();
  if (!supabase) return NextResponse.json({ error: "La conexión de soporte no está disponible." }, { status: 503, headers: privateHeaders });
  if (!userId) return NextResponse.json({ code: "AUTH_REQUIRED", error: "Inicia sesión con la cuenta que realizó el pedido." }, { status: 401, headers: privateHeaders });
  if (!consumeRateLimit(`support:return:${userId}`, 10, 60_000)) {
    return NextResponse.json({ error: "Espera un minuto antes de volver a solicitar una devolución." }, { status: 429, headers: privateHeaders });
  }

  const result = await createReturnRequest(supabase, userId, submission.data);
  if (!result.ok) {
    if (result.reason === "order_not_owned") {
      return NextResponse.json({ error: "No encontramos ese pedido en tu cuenta." }, { status: 404, headers: privateHeaders });
    }
    if (result.reason === "not_eligible") {
      return NextResponse.json({ error: "El plazo de devolución terminó: son 30 días desde la entrega del pedido." }, { status: 409, headers: privateHeaders });
    }
    if (result.reason === "quantity_conflict") {
      return NextResponse.json({ error: "La cantidad disponible cambió. Vuelve a consultar el pedido antes de enviar otra solicitud." }, { status: 409, headers: privateHeaders });
    }
    if (result.reason === "invalid_request") {
      return NextResponse.json({ error: "La solicitud ya se envió con otros datos o contiene una línea no válida. Actualiza el formulario e inténtalo de nuevo." }, { status: 409, headers: privateHeaders });
    }
    return NextResponse.json({ error: "No se pudo confirmar el registro de la devolución. Puedes reintentar la misma solicitud." }, { status: 500, headers: privateHeaders });
  }

  return NextResponse.json({ persisted: true, mode: "supabase", returnId: result.returnId, returnNumber: result.returnNumber }, { status: 201, headers: privateHeaders });
}
