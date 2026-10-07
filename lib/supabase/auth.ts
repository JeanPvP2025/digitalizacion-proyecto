import "server-only";

import type { User } from "@supabase/supabase-js";
import { getServerDataMode } from "@/lib/server/data-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const APP_ROLES = [
  "catalog_manager",
  "fulfillment_manager",
  "support_agent",
  "sales_manager",
  "super_admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type OrganizationRole = "owner" | "admin" | "buyer" | "viewer";
export type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type ServerAuthState =
  | { kind: "demo" }
  | { kind: "signed-out" }
  | { kind: "signed-in"; supabase: SupabaseServerClient; user: User };

/**
 * Resolve identity from a verified JWT and then confirm the current Auth user.
 * Never use user metadata or unverified session data to authorize a request.
 */
export async function getServerAuthState(): Promise<ServerAuthState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return getServerDataMode() === "local-demo" ? { kind: "demo" } : { kind: "signed-out" };

  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const subject = claimsData?.claims?.sub;
    if (claimsError || typeof subject !== "string") return { kind: "signed-out" };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== subject) return { kind: "signed-out" };

    return { kind: "signed-in", supabase, user: userData.user };
  } catch {
    return { kind: "signed-out" };
  }
}

export async function getProfileForUser(supabase: SupabaseServerClient, userId: string) {
  return supabase
    .from("profiles")
    .select("id, email, display_name, phone, locale")
    .eq("id", userId)
    .maybeSingle();
}

export async function getOrganizationMembershipsForUser(supabase: SupabaseServerClient, userId: string) {
  const membershipsResult = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (membershipsResult.error) {
    return { data: null, error: membershipsResult.error };
  }

  const memberships = membershipsResult.data ?? [];
  if (memberships.length === 0) return { data: [], error: null };

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const organizationsResult = await supabase
    .from("organizations")
    .select("id, display_name")
    .in("id", organizationIds);

  if (organizationsResult.error) {
    return { data: null, error: organizationsResult.error };
  }

  const organizationsById = new Map(
    (organizationsResult.data ?? []).map((organization) => [organization.id, organization.display_name]),
  );

  return {
    data: memberships.map((membership) => ({
      organizationId: membership.organization_id,
      organizationName: organizationsById.get(membership.organization_id) ?? "Organización",
      role: membership.role as OrganizationRole,
    })),
    error: null,
  };
}

export async function getStaffRoleGrants(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("user_role_grants")
    .select("role")
    .eq("user_id", userId);

  if (error) return { roles: [] as AppRole[], error };

  const roles = (data ?? [])
    .map((grant) => grant.role)
    .filter((role): role is AppRole => APP_ROLES.includes(role as AppRole));

  return { roles, error: null };
}
