import "server-only";

import { getServerAuthState, getStaffRoleGrants } from "@/lib/supabase/auth";
import { hasStaffSurfaceRole } from "@/lib/supabase/policies";

export async function getOperationsAccess() {
  const auth = await getServerAuthState();
  if (auth.kind === "demo") return { state: "unconfigured" } as const;
  if (auth.kind === "signed-out") return { state: "unauthenticated" } as const;

  const { roles, error } = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (error) return { state: "error" } as const;
  if (!hasStaffSurfaceRole(roles, "operations")) return { state: "forbidden" } as const;

  return { state: "ready", supabase: auth.supabase, user: auth.user } as const;
}
