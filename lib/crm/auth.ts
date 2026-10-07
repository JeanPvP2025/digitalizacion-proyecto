import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasStaffSurfaceRole } from "@/lib/supabase/policies";

export async function getCrmAccess() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { state: "unconfigured" } as const;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { state: "unauthenticated" } as const;

  const { data: grants, error: grantsError } = await supabase
    .from("user_role_grants")
    .select("role")
    .eq("user_id", authData.user.id);

  if (grantsError) return { state: "error" } as const;
  if (!hasStaffSurfaceRole((grants ?? []).map((grant) => grant.role), "crm")) {
    return { state: "forbidden" } as const;
  }

  return { state: "ready", supabase, user: authData.user } as const;
}
