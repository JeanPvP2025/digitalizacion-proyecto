import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";
import { getCallbackReason } from "./feedback";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const destination = getSafeRedirectPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  let reason = getCallbackReason({ code: url.searchParams.get("error_code") });

  // An explicit provider failure wins over a code; do not exchange an ambiguous link.
  if (code && !url.searchParams.has("error") && !url.searchParams.has("error_code")) {
    try {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        reason = "service";
      } else {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          return NextResponse.redirect(new URL(destination, url.origin), { headers });
        }
        reason = getCallbackReason(error);
      }
    } catch {
      reason = "service";
    }
  }

  const failure = new URL("/acceso", url.origin);
  failure.searchParams.set("error", "callback");
  failure.searchParams.set("motivo", reason);
  // Preserve only the validated destination. Recovery failures never offer password update without a session.
  if (destination === "/acceso?modo=actualizar") failure.searchParams.set("modo", "recuperar");
  else failure.searchParams.set("next", destination);
  failure.hash = "#"; // Prevent a provider error/token fragment from being inherited by the redirect.
  return NextResponse.redirect(failure, { headers });
}
