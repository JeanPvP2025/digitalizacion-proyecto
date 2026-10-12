/** Public copy only. Never render provider messages, emails, tokens or codes. */
export type AuthFeedback = { message: string; pause?: "all" };

export function getAuthFeedback(cause: unknown): AuthFeedback {
  const error = cause && typeof cause === "object" ? cause as { code?: string; message?: string; status?: number; name?: string } : {};
  // Current Auth returns stable codes. The message fallback supports older responses only.
  const code = error.code ?? (error.name === "AuthSessionMissingError" ? "session_not_found"
    : error.name === "AuthPKCEGrantCodeExchangeError" ? "bad_code_verifier"
    : error.message === "email rate limit exceeded" ? "over_email_send_rate_limit"
    : error.message === "Invalid login credentials" ? "invalid_credentials" : undefined);
  switch (code) {
    case "over_email_send_rate_limit":
      return { message: "Supabase todavía intenta enviar correos. Comprueba que «Confirm Email» esté desactivado; esta web no ofrece confirmación ni recuperación por email." };
    case "over_request_rate_limit":
      return { message: "Hay demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.", pause: "all" };
    case "invalid_credentials":
      return { message: "No hemos podido iniciar sesión con ese correo y contraseña. Revisa ambos datos. Si acabas de crear la cuenta, contacta con la administración de la demo si sigue sin funcionar." };
    case "email_not_confirmed":
      return { message: "Esta cuenta sigue pendiente de confirmación, pero la web no envía correos. Contacta con la administración de la demo para habilitarla y comprobar la configuración de Supabase." };
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return { message: getCallbackFeedback("expired") };
    case "bad_code_verifier":
      return { message: getCallbackFeedback("browser") };
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
      return { message: "Tu sesión ha caducado. Inicia sesión de nuevo. Si no recuerdas la contraseña, contacta con la administración de la demo; no se envían correos de recuperación." };
    case "same_password":
      return { message: "Elige una contraseña diferente de la actual." };
    case "weak_password":
      return { message: "La contraseña no cumple los requisitos de seguridad. Usa al menos 8 caracteres y combina mayúsculas, minúsculas, números y símbolos." };
    case "email_address_invalid":
    case "validation_failed":
      return { message: "Revisa el formato del correo y los datos introducidos antes de continuar." };
    case "email_address_not_authorized":
    case "email_provider_disabled":
    case "signup_disabled":
      return { message: "El registro no está disponible en este momento. Contacta con la administración de la demo; repetir la solicitud no resolverá la configuración de Supabase." };
    case "user_already_exists":
    case "email_exists":
      return { message: "No se pudo completar el registro. Prueba a iniciar sesión con esa cuenta; si has olvidado la contraseña, contacta con la administración de la demo." };
  }
  if (error.status === 429) return { message: "El servicio ha limitado temporalmente las solicitudes. Espera antes de intentarlo de nuevo.", pause: "all" };
  return { message: "No se pudo completar la operación. Comprueba tu conexión y vuelve a intentarlo más tarde. Si persiste, contacta con soporte." };
}

export function getCallbackReason(cause: unknown): "expired" | "browser" | "service" | "callback" {
  if (cause && typeof cause === "object" && "name" in cause && cause.name === "AuthPKCEGrantCodeExchangeError") return "browser";
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
  if (code === "otp_expired" || code === "flow_state_expired" || code === "flow_state_not_found") return "expired";
  if (code === "bad_code_verifier") return "browser";
  return "callback";
}

export function getCallbackFeedback(reason: string | null): string {
  if (reason === "expired") return "El enlace ha caducado o ya se ha utilizado. Inicia sesión de nuevo; si no puedes acceder, contacta con la administración de la demo.";
  if (reason === "browser") return "No podemos validar el enlace en este navegador. Inicia sesión de nuevo en este dispositivo. Si el problema continúa, contacta con la administración de la demo.";
  if (reason === "service") return "El servicio de acceso no está disponible. Inténtalo más tarde; si persiste, contacta con soporte.";
  return "No se pudo completar el enlace de acceso. Inicia sesión de nuevo; si no puedes acceder, contacta con la administración de la demo.";
}
