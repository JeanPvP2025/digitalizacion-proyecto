import "server-only";

import { getServerDataMode } from "@/lib/server/data-mode";

export type CheckoutMode = "demo" | "supabase" | "unavailable";

export function getCheckoutMode(): CheckoutMode {
  const mode = getServerDataMode();
  return mode === "local-demo" ? "demo" : mode;
}
