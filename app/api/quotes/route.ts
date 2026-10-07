import { saveDemoQuoteInquiry } from "@/lib/server/demo-inbox";
import { getServerDataMode } from "@/lib/server/data-mode";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { persistSupabaseQuoteInquiry } from "@/lib/quotes/persistence";
import { createQuotePostHandler } from "@/lib/quotes/submit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return createQuotePostHandler({
    mode: getServerDataMode(),
    persistSupabase: persistSupabaseQuoteInquiry,
    persistDemo: saveDemoQuoteInquiry,
    consumeRateLimit,
  })(request);
}
