import type { AppRole } from "@/lib/supabase/auth";

export const STAFF_SURFACE_ROLES = {
  backoffice: ["fulfillment_manager", "sales_manager", "super_admin"],
  operations: ["fulfillment_manager", "super_admin"],
  inventory: ["fulfillment_manager", "super_admin"],
  crm: ["sales_manager", "super_admin"],
} as const satisfies Record<string, readonly AppRole[]>;

export type StaffSurface = keyof typeof STAFF_SURFACE_ROLES;

export function hasStaffSurfaceRole(roles: readonly string[], surface: StaffSurface): boolean {
  const allowedRoles: readonly string[] = STAFF_SURFACE_ROLES[surface];
  return roles.some((role) => allowedRoles.includes(role));
}
