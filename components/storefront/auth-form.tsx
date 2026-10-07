"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";

type Mode = "signin" | "signup" | "reset" | "update";

type AuthFormProps = {
  demoMode: boolean;
  redirectTo: string;
  initialMode: Mode;
  initialError?: string;
  initialMessage?: string;
};

function getCallbackUrl(destination: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("next", getSafeRedirectPath(destination));
  return callbackUrl.toString();
}

export function AuthForm({ demoMode, redirectTo, initialMode, initialError, initialMessage }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState(initialError ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("No se pudo conectar con Supabase. No se ha iniciado ninguna sesión.");

      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(getSafeRedirectPath(redirectTo));
        return;
      }

      if (mode === "signup") {
        const name = String(data.get("fullName") ?? "").trim();
        const { data: result, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: getCallbackUrl(redirectTo),
          },
        });
        if (authError) throw authError;

        if (result.session) router.replace(getSafeRedirectPath(redirectTo));
        else setMessage("Te hemos enviado un correo para confirmar tu cuenta. Después podrás iniciar sesión.");
        return;
      }

      if (mode === "reset") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getCallbackUrl("/acceso?modo=actualizar"),
        });
        if (authError) throw authError;
        setMessage("Si existe una cuenta para ese correo, recibirás instrucciones para recuperar el acceso.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      router.replace("/mi-cuenta");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin"
    ? "Qué bueno verte."
    : mode === "signup"
      ? "Empieza con buen pie."
      : mode === "update"
        ? "Elige una contraseña nueva."
        : "Recupera el acceso.";

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">NODRIA · TU ESPACIO</p>
        <h1>{title}</h1>
        <p className="auth-description">
          {mode === "signin"
            ? "Tus pedidos, tus configuraciones, tu tecnología."
            : mode === "signup"
              ? "Crea tu cuenta y guarda tus configuraciones y pedidos en un solo lugar."
              : mode === "update"
                ? "La nueva contraseña se guardará en tu cuenta de Supabase."
                : "Te enviaremos instrucciones al correo asociado a tu cuenta."}
        </p>

        {demoMode ? (
          <div className="auth-demo-notice" role="status">
            <strong>Autenticación desactivada en esta demo.</strong>
            <p>Esta instancia no tiene un proyecto Supabase configurado. No introduzcas contraseñas aquí; puedes seguir explorando el catálogo y los flujos ficticios.</p>
            <Link className="button button--dark" href="/catalogo">Explorar catálogo <ArrowRight size={14} /></Link>
          </div>
        ) : (
          <>
            {(mode === "signin" || mode === "signup") && (
              <div className="auth-tabs" role="tablist" aria-label="Acceso">
                <button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); setMessage(""); }} type="button">Iniciar sesión</button>
                <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }} type="button">Crear cuenta</button>
              </div>
            )}
            <form className="auth-form" onSubmit={submit}>
              {mode === "signup" && <div className="field"><label htmlFor="auth-name">Nombre completo</label><div className="auth-input-wrap"><UserRound size={15} /><input id="auth-name" name="fullName" autoComplete="name" maxLength={120} minLength={2} required /></div></div>}
              {mode !== "update" && <div className="field"><label htmlFor="auth-email">Correo electrónico</label><div className="auth-input-wrap"><Mail size={15} /><input id="auth-email" name="email" type="email" autoComplete="email" maxLength={254} required /></div></div>}
              {mode !== "reset" && <div className="field"><label htmlFor="auth-password">{mode === "update" ? "Nueva contraseña" : "Contraseña"}</label><div className="auth-input-wrap"><KeyRound size={15} /><input id="auth-password" name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} maxLength={72} required /></div><small>Mínimo 8 caracteres.</small></div>}
              {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
              {message && <p className="auth-message" role="status">{message}</p>}
              <button className="button button--dark auth-submit" disabled={busy} type="submit">
                {busy ? <LoaderCircle size={15} className="spin-icon" /> : <LockKeyhole size={15} />}
                {busy ? "Un momento…" : mode === "signin" ? "Entrar en mi espacio" : mode === "signup" ? "Crear mi cuenta" : mode === "update" ? "Guardar contraseña" : "Enviar instrucciones"}
                <ArrowRight size={14} />
              </button>
            </form>
            <div className="auth-links">
              {mode === "signin" && <button type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>¿Has olvidado tu contraseña?</button>}
              {(mode === "reset" || mode === "update") && <button type="button" onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Volver a iniciar sesión</button>}
              <Link href="/">Seguir explorando sin cuenta</Link>
            </div>
            <p className="auth-privacy">Tu cuenta y tus pedidos se consultan con tu sesión autenticada y las políticas de acceso de Supabase.</p>
          </>
        )}
      </section>
    </main>
  );
}
