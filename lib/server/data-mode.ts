import "server-only";

import { resolveServerDataMode, type ServerDataMode } from "@/lib/supabase/config";

export function getServerDataMode(): ServerDataMode {
  return resolveServerDataMode({
    nodeEnv: process.env.NODE_ENV,
    demoMode: process.env.DEMO_MODE,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** Guard every local filesystem persistence entry point, even when called directly. */
export function assertLocalDemoMode(): void {
  if (getServerDataMode() !== "local-demo") {
    throw new Error("Local demo files are available only in explicit local development mode.");
  }
}
