import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseCredentials } from "@/lib/supabase/config";

/** Fulfillment RPCs are service-role only; call this after checking staff access. */
export function createOperationsServiceClient() {
  const credentials = getSupabaseCredentials();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!credentials || !secretKey) return null;

  return createClient(credentials.url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
