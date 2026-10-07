import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseCredentials } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const credentials = getSupabaseCredentials();
  if (!credentials) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(credentials.url, credentials.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  try {
    // Best-effort refresh only. Server data access performs full auth and role checks.
    await supabase.auth.getClaims();
  } catch {
    // A transient Auth outage must not replace route-level authorization.
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
