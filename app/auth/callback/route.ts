import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const destination = getSafeRedirectPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(destination, url.origin), { headers: { "Cache-Control": "private, no-store" } });
      }
    } catch {
      // Keep callback failures on the same-origin sign-in route.
    }
  }

  return NextResponse.redirect(new URL("/acceso?error=callback", url.origin), { headers: { "Cache-Control": "private, no-store" } });
}
