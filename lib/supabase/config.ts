export type ServerDataMode = "local-demo" | "supabase" | "unavailable";

export type ServerDataModeEnvironment = {
  nodeEnv?: string;
  demoMode?: string;
  supabaseUrl?: string;
  publishableKey?: string;
};

/** Select one persistence source. Partial credentials never enable a demo fallback. */
export function resolveServerDataMode(environment: ServerDataModeEnvironment): ServerDataMode {
  const hasUrl = Boolean(environment.supabaseUrl?.trim());
  const hasKey = Boolean(environment.publishableKey?.trim());

  if (hasUrl !== hasKey) return "unavailable";
  if (hasUrl && hasKey) return "supabase";
  if (environment.nodeEnv === "development" && environment.demoMode === "true") return "local-demo";
  return "unavailable";
}

export function hasSupabaseCredentials(): boolean {
  return getSupabaseCredentials() !== null;
}

export function getSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}
