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
