import "server-only";

import { getServerDataMode } from "@/lib/server/data-mode";
import { getServerAuthState, getStaffRoleGrants, type SupabaseServerClient } from "@/lib/supabase/auth";

export async function getConnectedSupportSession() {
  if (getServerDataMode() !== "supabase") return { kind: "unavailable" as const };
  const auth = await getServerAuthState();
  if (auth.kind !== "signed-in") return { kind: "unauthenticated" as const };
  return { kind: "authenticated" as const, supabase: auth.supabase, user: auth.user };
}

export async function checkSupportAgentRole(supabase: SupabaseServerClient, userId: string) {
  const result = await getStaffRoleGrants(supabase, userId);
  if (result.error) return { allowed: false, error: result.error };
  return {
    allowed: result.roles.includes("support_agent") || result.roles.includes("super_admin"),
    error: null,
  };
}
