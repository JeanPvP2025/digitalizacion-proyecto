import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    try {
      // A stale/expired access token must not block this local-session operation.
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Always return to the same-origin access page if Auth is temporarily unavailable.
    }
  }

  return NextResponse.redirect(new URL("/acceso?salida=1", request.nextUrl.origin), {
    status: 303,
    headers: { "Cache-Control": "private, no-store" },
  });
}
