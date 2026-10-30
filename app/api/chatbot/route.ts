import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { getCatalogData } from "@/lib/catalog-repository";
import { demoProducts } from "@/lib/catalog";
import { processChatbotMessage } from "@/lib/chatbot";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().max(500, "El mensaje no puede superar 500 caracteres.").default(""),
  context: z
    .object({
      activeTopic: z.string().optional(),
      activeFamily: z.string().optional(),
      budgetEur: z.number().optional(),
      portCount: z.number().optional(),
      poeRequired: z.boolean().optional(),
      preferredBrand: z.string().optional(),
      flow: z
        .object({
          type: z.enum([
            "recommend_network",
            "recommend_wifi",
            "recommend_switch",
            "recommend_domotica",
            "recommend_telephony",
            "recommend_industrial",
            "compare_products",
            "pc_builder_help",
          ]),
          step: z.number(),
          slots: z.record(z.string(), z.unknown()),
        })
        .optional(),
      recentProductSlugs: z.array(z.string()).optional(),
      unrecognizedCount: z.number().optional(),
      currentPath: z.string().optional(),
    })
    .optional(),
  currentPath: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  // Rate limiting per client IP (30 queries per minute)
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous-chatbot-client";
  const rateLimitKey = `chatbot:${clientIp}`;
  const isAllowed = consumeRateLimit(rateLimitKey, 30, 60_000);

  if (!isAllowed) {
    return NextResponse.json(
      {
        error: "Has superado el límite de consultas al asistente. Por favor, espera un minuto antes de continuar.",
      },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    const parseResult = requestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Datos de consulta no válidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { message, context, currentPath } = parseResult.data;

    // Retrieve active catalog (Supabase connected or demo fallback)
    let catalogProducts = demoProducts;
    try {
      const catalog = await getCatalogData();
      if (catalog && catalog.source !== "error" && catalog.products.length > 0) {
        catalogProducts = catalog.products;
      }
    } catch {
      // In case of database read issues, gracefully fallback to local verified catalog
      catalogProducts = demoProducts;
    }

    const response = processChatbotMessage({
      message,
      context,
      currentPath,
      catalogProducts,
    });

    return NextResponse.json(
      {
        success: true,
        ...response,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[NODRIA Chatbot API Error]:", error);
    return NextResponse.json(
      {
        error: "Se produjo un error al procesar tu consulta con el asistente virtual.",
      },
      { status: 500 }
    );
  }
}
