/** Public copy only. Never render provider messages, emails, tokens or codes. */
export type AuthFeedback = { message: string; pause?: "email" | "all" };

export function getAuthFeedback(cause: unknown): AuthFeedback {
  const error = cause && typeof cause === "object" ? cause as { code?: string; message?: string; status?: number; name?: string } : {};
  // Current Auth returns stable codes. The message fallback supports older responses only.
  const code = error.code ?? (error.name === "AuthSessionMissingError" ? "session_not_found"
    : error.name === "AuthPKCEGrantCodeExchangeError" ? "bad_code_verifier"
    : error.message === "email rate limit exceeded" ? "over_email_send_rate_limit"
    : error.message === "Invalid login credentials" ? "invalid_credentials" : undefined);
  switch (code) {
    case "over_email_send_rate_limit":
      return { message: "El servicio ha alcanzado el límite de envío de correos. Revisa tu bandeja de entrada y spam y espera antes de solicitar otro. El plazo depende del servicio; si persiste, contacta con soporte.", pause: "email" };
    case "over_request_rate_limit":
      return { message: "Hay demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.", pause: "all" };
    case "invalid_credentials":
      return { message: "No hemos podido iniciar sesión con ese correo y contraseña. Revisa ambos datos o usa «¿Has olvidado tu contraseña?». Si acabas de registrarte, revisa el correo de confirmación." };
    case "email_not_confirmed":
      return { message: "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada y spam; abre el enlace en este mismo navegador. Si no tienes un enlace válido, usa «Confirmar mi correo»." };
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return { message: getCallbackFeedback("expired") };
    case "bad_code_verifier":
      return { message: getCallbackFeedback("browser") };
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
      return { message: "Tu sesión ha caducado. Inicia sesión de nuevo o solicita instrucciones desde «¿Has olvidado tu contraseña?» para cambiarla." };
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
      return { message: "El registro o envío de correos no está disponible en este momento. Contacta con soporte; repetir la solicitud no resolverá la configuración del servicio." };
    case "user_already_exists":
    case "email_exists":
      return { message: "No se pudo completar el registro. Prueba a iniciar sesión o recuperar el acceso con ese correo." };
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
  if (reason === "expired") return "El enlace ha caducado o ya se ha utilizado. Si era de confirmación, prueba a iniciar sesión; si necesitas otro enlace, solicítalo una sola vez desde «Confirmar mi correo» o «¿Has olvidado tu contraseña?» y espera a recibirlo.";
  if (reason === "browser") return "No podemos validar el enlace en este navegador. Ábrelo en el mismo navegador y dispositivo donde lo solicitaste, usando el enlace más reciente. Si ya no lo tienes, inicia la confirmación o recuperación una sola vez desde aquí.";
  if (reason === "service") return "El servicio de acceso no está disponible. Inténtalo más tarde; si persiste, contacta con soporte.";
  return "No se pudo completar el enlace de acceso. Puede estar incompleto, caducado o abierto en otro navegador. Usa el enlace más reciente en el navegador donde lo solicitaste. Si era de confirmación, prueba a iniciar sesión antes de pedir otro.";
}
