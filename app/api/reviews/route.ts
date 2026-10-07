import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getServerAuthState } from "@/lib/supabase/auth";
import { createProductReview } from "@/lib/reviews/data";
import { reviewSubmissionSchema } from "@/lib/reviews/contracts";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (getServerDataMode() !== "supabase") {
    return NextResponse.json(
      { error: "Las opiniones requieren una cuenta conectada y una compra guardada en Supabase." },
      { status: 503, headers: privateHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400, headers: privateHeaders });
  }

  const submission = reviewSubmissionSchema.safeParse(body);
  if (!submission.success) {
    return NextResponse.json(
      { error: "Revisa el pedido, la valoración, el título y el texto de la opinión." },
      { status: 400, headers: privateHeaders },
    );
  }

  const auth = await getServerAuthState();
  if (auth.kind !== "signed-in") {
    return NextResponse.json(
      { code: "AUTH_REQUIRED", error: "Inicia sesión con la cuenta que realizó la compra." },
      { status: 401, headers: privateHeaders },
    );
  }

  if (!consumeRateLimit("reviews:" + auth.user.id, 5, 60_000)) {
    return NextResponse.json(
      { error: "Espera un minuto antes de enviar otra opinión." },
      { status: 429, headers: privateHeaders },
    );
  }

  try {
    const result = await createProductReview(auth.supabase, submission.data);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        return NextResponse.json({ error: "Ya has enviado una opinión para este producto." }, { status: 409, headers: privateHeaders });
      }
      if (result.reason === "not_eligible") {
        return NextResponse.json(
          { error: "Solo puedes opinar sobre un producto de un pedido entregado en tu cuenta." },
          { status: 409, headers: privateHeaders },
        );
      }
      return NextResponse.json(
        { error: "No se pudo guardar la opinión. Inténtalo de nuevo más tarde." },
        { status: 500, headers: privateHeaders },
      );
    }

    return NextResponse.json(
      { persisted: true, status: "pending", reviewId: result.reviewId },
      { status: 201, headers: privateHeaders },
    );
  } catch (error) {
    console.error("NODRIA product review submission failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "No se pudo confirmar el guardado de la opinión. Inténtalo de nuevo más tarde." },
      { status: 500, headers: privateHeaders },
    );
  }
}
