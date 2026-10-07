import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseCredentials } from "@/lib/supabase/config";
import type { CheckoutRequest } from "@/lib/commerce/contracts";

/**
 * `resolve_demo_payment` is deliberately executable only by service_role.
 * Prefer Supabase's server secret key; retain the legacy service-role variable
 * for existing deployments. This module is server-only and never reads a
 * NEXT_PUBLIC_* secret.
 */
export function createSupabasePaymentAdminClient() {
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

export function getDemoPaymentEventId(
  userId: string,
  idempotencyKey: string,
  method: NonNullable<CheckoutRequest["paymentMethod"]>,
) {
  return createHash("sha256")
    .update(`${userId}:${idempotencyKey}:${method}`)
    .digest("hex");
}

export function toDatabaseDemoPaymentOutcome(method: NonNullable<CheckoutRequest["paymentMethod"]>) {
  return method === "declined" || method === "insufficient_funds" ? "failed" : method;
}
