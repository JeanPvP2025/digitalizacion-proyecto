import { z } from "zod";

export const quoteInquirySchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  phone: z.string().trim().max(30).optional().default(""),
  volume: z.enum([
    "1–5 equipos",
    "6–25 equipos",
    "26–100 equipos",
    "Más de 100 equipos",
    "Proyecto de infraestructura",
    "Por definir",
  ]),
  message: z.string().trim().min(20).max(1500),
  privacyAccepted: z.literal(true),
  website: z.string().trim().max(200).optional(),
}).strict();

export type QuoteInquirySubmission = z.infer<typeof quoteInquirySchema>;

/** Exactly the columns allowed by the anonymous INSERT grant in the migration. */
export type QuoteInquiryInsert = {
  contact_name: string;
  email: string;
  phone: string | null;
  company: string;
  message: string;
  consent_to_contact: true;
};

export type DemoQuoteInquiry = {
  id: string;
  createdAt: string;
  status: "new";
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  volume: string;
  message: string;
};

export type QuotePersistenceMode = "supabase" | "local-demo" | "unavailable";

export function toQuoteInquiryInsert(input: QuoteInquirySubmission): QuoteInquiryInsert {
  return {
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone || null,
    company: input.companyName,
    message: `Volumen aproximado: ${input.volume}\n\n${input.message}`,
    consent_to_contact: input.privacyAccepted,
  };
}

export function toDemoQuoteInquiry(input: QuoteInquirySubmission, id: string, createdAt: string): DemoQuoteInquiry {
  return {
    id,
    createdAt,
    status: "new",
    companyName: input.companyName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    volume: input.volume,
    message: input.message,
  };
}

type QuotePostHandlerDependencies = {
  mode: QuotePersistenceMode;
  persistSupabase: (inquiry: QuoteInquiryInsert) => Promise<void>;
  persistDemo: (inquiry: DemoQuoteInquiry) => Promise<void>;
  consumeRateLimit: (key: string, limit: number, windowMs: number, now?: number) => boolean;
  now?: () => Date;
  randomUUID?: () => string;
};

const MAX_REQUEST_BODY_BYTES = 16 * 1024;

async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) return { ok: false, status: 413 };

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

function persistenceErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  if (error instanceof Error) return error.name;
  return "unknown";
}

export function createQuotePostHandler(dependencies: QuotePostHandlerDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());

  return async function POST(request: Request): Promise<Response> {
    if (dependencies.mode === "unavailable") {
      return json({ error: "La persistencia de solicitudes no está configurada para este entorno." }, 503);
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!dependencies.consumeRateLimit(`quote:${ip}`, 4, 60_000, now().getTime())) {
      return json({ error: "Espera un minuto antes de enviar otra solicitud." }, 429);
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      const error = body.status === 413 ? "La solicitud supera el tamaño permitido." : "Solicitud no válida.";
      return json({ error }, body.status);
    }

    const result = quoteInquirySchema.safeParse(body.value);
    if (!result.success) {
      return json({ error: "Revisa los campos obligatorios y vuelve a intentarlo." }, 400);
    }

    // Keep the existing honeypot contract: a filled website field never reaches either store.
    if (result.data.website) return json({ error: "Solicitud no válida." }, 400);

    try {
      if (dependencies.mode === "supabase") {
        await dependencies.persistSupabase(toQuoteInquiryInsert(result.data));
        // No row is selected: anon has INSERT-only column grants and must not gain SELECT access.
        return json({ persisted: true, persistence: "supabase" }, 201);
      }

      const date = now();
      const quoteId = `DEMO-QIN-${date.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      await dependencies.persistDemo(toDemoQuoteInquiry(result.data, quoteId, date.toISOString()));
      return json({ persisted: true, persistence: "local-demo", quoteId }, 201);
    } catch (error) {
      // Avoid logging the raw PostgREST error object, whose details may contain PII.
      console.error("NODRIA quote persistence failed", persistenceErrorCode(error));
      return json({ error: "No se ha podido guardar la solicitud. Inténtalo más tarde." }, 500);
    }
  };
}
