import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseCredentials } from "@/lib/supabase/config";

/** Returns null in the self-contained local demo configuration. */
export async function createSupabaseServerClient() {
  const credentials = getSupabaseCredentials();
  if (!credentials) return null;

  const cookieStore = await cookies();
  return createServerClient(credentials.url, credentials.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components may not write cookies. `proxy.ts` refreshes sessions on requests.
        }
      },
    },
  });
}
