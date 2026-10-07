import "server-only";

import { getServerAuthState, getStaffRoleGrants, type SupabaseServerClient, type ServerAuthState } from "@/lib/supabase/auth";
import { hasStaffSurfaceRole } from "@/lib/supabase/policies";

export type ProcurementAccess =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "ready"; supabase: SupabaseServerClient; userId: string };

export async function getProcurementAccess(authState?: ServerAuthState): Promise<ProcurementAccess> {
  const auth = authState ?? await getServerAuthState();
  if (auth.kind === "demo") return { status: "not_configured" };
  if (auth.kind === "signed-out") return { status: "unauthenticated" };

  const { roles, error } = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (error) return { status: "error" };
  if (!hasStaffSurfaceRole(roles, "inventory")) return { status: "forbidden" };
  return { status: "ready", supabase: auth.supabase, userId: auth.user.id };
}
