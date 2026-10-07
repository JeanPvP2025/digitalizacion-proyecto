"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseCredentials } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  const credentials = getSupabaseCredentials();
  if (!credentials) return null;
  browserClient ??= createBrowserClient(credentials.url, credentials.key);
  return browserClient;
}
