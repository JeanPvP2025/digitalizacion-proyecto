import { describe, expect, it } from "vitest";
import { getAuthFeedback, getCallbackFeedback, getCallbackReason } from "@/app/auth/callback/feedback";

describe("public Auth feedback", () => {
  it("uses stable codes for email/request limits and accepts legacy errors", () => {
    expect(getAuthFeedback({ code: "over_email_send_rate_limit", message: "secret" })).toMatchObject({ pause: "email", message: expect.stringContaining("espera") });
    expect(getAuthFeedback(new Error("email rate limit exceeded"))).toEqual(getAuthFeedback({ code: "over_email_send_rate_limit" }));
    expect(getAuthFeedback({ code: "over_request_rate_limit" }).pause).toBe("all");
    expect(getAuthFeedback({ status: 429 }).pause).toBe("all");
  });

  it("offers sign-in/recovery without asserting account existence", () => {
    const message = getAuthFeedback({ code: "invalid_credentials", message: "secret" }).message;
    expect(message).toContain("Revisa ambos datos");
    expect(message).toContain("¿Has olvidado tu contraseña?");
    expect(message).toContain("correo de confirmación");
    expect(getAuthFeedback(new Error("Invalid login credentials")).message).toBe(message);
  });

  it.each(["otp_expired", "flow_state_expired", "flow_state_not_found"])("distinguishes expiry/reuse for %s", (code) => {
    expect(getCallbackReason({ code })).toBe("expired");
    expect(getAuthFeedback({ code }).message).toContain("caducado o ya se ha utilizado");
  });

  it("distinguishes the missing browser verifier and ignores arbitrary reasons", () => {
    expect(getCallbackReason({ code: "bad_code_verifier" })).toBe("browser");
    expect(getCallbackFeedback("browser")).toContain("mismo navegador y dispositivo");
    expect(getCallbackFeedback("<script>secret</script>")).toBe(getCallbackFeedback(null));
  });

  it("handles local SDK errors that have names instead of server codes", () => {
    expect(getAuthFeedback({ name: "AuthSessionMissingError", message: "private" }).message).toContain("sesión ha caducado");
    expect(getCallbackReason({ name: "AuthPKCEGrantCodeExchangeError" })).toBe("browser");
  });

  it.each(["session_expired", "session_not_found", "refresh_token_not_found"])("makes %s recoverable", (code) => {
    expect(getAuthFeedback({ code }).message).toContain("Inicia sesión de nuevo");
  });

  it.each(["email_address_not_authorized", "email_provider_disabled", "signup_disabled"])("avoids retry loops for %s", (code) => {
    expect(getAuthFeedback({ code }).message).toContain("repetir la solicitud no resolverá");
  });

  it.each([null, "secret", new Error("token=secret"), { code: "unknown", message: "private@example.invalid" }])("hides unknown provider details", (cause) => {
    const message = getAuthFeedback(cause).message;
    expect(message).toContain("Comprueba tu conexión");
    expect(message).not.toMatch(/secret|token=|private@/);
  });
});
