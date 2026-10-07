import "server-only";

import { getServerAuthState, getStaffRoleGrants, type ServerAuthState, type SupabaseServerClient } from "@/lib/supabase/auth";

export type CatalogAdminAccess =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "ready"; supabase: SupabaseServerClient; userId: string };

export async function getCatalogAdminAccess(authState?: ServerAuthState): Promise<CatalogAdminAccess> {
  const auth = authState ?? await getServerAuthState();
  if (auth.kind === "demo") return { status: "not_configured" };
  if (auth.kind === "signed-out") return { status: "unauthenticated" };

  const grants = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (grants.error) return { status: "error" };
  if (!grants.roles.some((role) => role === "catalog_manager" || role === "super_admin")) {
    return { status: "forbidden" };
  }
  return { status: "ready", supabase: auth.supabase, userId: auth.user.id };
}

