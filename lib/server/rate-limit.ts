import "server-only";

const buckets = new Map<string, number[]>();

/** Process-local throttle for local demo intake endpoints; use an edge/shared limiter in production. */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) { buckets.set(key, recent); return false; }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}
