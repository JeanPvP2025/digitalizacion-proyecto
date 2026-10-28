import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { assertLocalDemoMode } from "@/lib/server/data-mode";

export const DEMO_SESSION_COOKIE = "nodria_demo_session";

export type DemoSessionPayload = {
  orderIds: string[];
  customerName?: string;
  createdAt: number;
};

function getSigningSecret(): string {
  return (
    process.env.DEMO_SESSION_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "nodria-academic-demo-session-secret-salt-2026"
  );
}

function computeSignature(payloadString: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadString).digest("hex");
}

/**
 * Creates an HMAC-signed token encapsulating the authorized demo order IDs
 * placed within a client session.
 */
export function signDemoSession(payload: DemoSessionPayload): string {
  assertLocalDemoMode();
  const secret = getSigningSecret();
  const payloadJson = JSON.stringify(payload);
  const signature = computeSignature(payloadJson, secret);
  const encodedPayload = Buffer.from(payloadJson, "utf8").toString("base64url");
  return `${signature}.${encodedPayload}`;
}

/**
 * Verifies the HMAC signature and decodes the authorized demo session payload.
 * Returns null if the signature is invalid, forged, or malformed.
 */
export function verifyDemoSession(token: string | undefined | null): DemoSessionPayload | null {
  assertLocalDemoMode();
  if (!token || typeof token !== "string") return null;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const providedSignature = token.slice(0, dotIndex);
  const encodedPayload = token.slice(dotIndex + 1);
  if (!providedSignature || !encodedPayload) return null;

  try {
    const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const secret = getSigningSecret();
    const expectedSignature = computeSignature(payloadJson, secret);

    const providedBuf = Buffer.from(providedSignature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    const parsed: unknown = JSON.parse(payloadJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "orderIds" in parsed &&
      Array.isArray((parsed as DemoSessionPayload).orderIds) &&
      (parsed as DemoSessionPayload).orderIds.every((id) => typeof id === "string")
    ) {
      return parsed as DemoSessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Helper to extract authorized order IDs from a raw cookie header value.
 */
export function extractAuthorizedOrderIds(cookieHeader: string | undefined | null): string[] {
  if (!cookieHeader) return [];
  const session = verifyDemoSession(cookieHeader);
  return session?.orderIds ?? [];
}
