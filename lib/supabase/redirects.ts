/** Accept only same-origin, path-relative destinations for Auth redirects. */
export function getSafeRedirectPath(value: string | null | undefined, fallback = "/mi-cuenta") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  try {
    const destination = new URL(value, "https://nodria.invalid");
    if (destination.origin !== "https://nodria.invalid") return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

/** Choose a useful landing page from persisted staff roles after a default sign-in. */
export function getRoleLandingPath(roles: readonly string[]) {
  if (roles.includes("super_admin") || roles.includes("fulfillment_manager")) return "/backoffice";
  if (roles.includes("sales_manager")) return "/backoffice/crm";
  if (roles.includes("catalog_manager")) return "/backoffice/catalog";
  if (roles.includes("support_agent")) return "/soporte/agente";
  return "/mi-cuenta";
}
