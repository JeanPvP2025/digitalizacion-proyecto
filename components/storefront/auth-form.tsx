"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";
import { BrandMark } from "@/components/storefront/brand-mark";
import styles from "./auth-form.module.css";

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
    <main className={styles.page}>
      <div className={styles.frame}>
        <aside className={styles.story} aria-label="Tu espacio NODRIA">
          <div className={styles.storyTop}>
            <BrandMark />
            <span className={styles.storyIndex}>CUENTA PERSONAL <b>·</b> 01</span>
          </div>
          <div className={styles.storyCopy}>
            <p className={styles.kicker}><i /> TECNOLOGÍA, A TU MANERA</p>
            <h2>Todo lo tuyo.<br /><em>En su sitio.</em></h2>
            <p className={styles.storyDescription}>Pedidos, equipos guardados y soporte, reunidos en un espacio pensado para seguirte el ritmo.</p>
          </div>
          <div className={styles.visual} aria-hidden="true">
            <div className={styles.visualGrid} />
            <div className={styles.visualOrbit} />
            <div className={styles.visualHalo} />
            <div className={styles.deviceFrame}>
              <div className={styles.deviceScreen}>
                <span className={styles.deviceLine} />
                <span className={styles.deviceLineShort} />
                <span className={styles.devicePulse} />
              </div>
              <span className={styles.deviceBase} />
            </div>
            <div className={styles.visualTag}><span>ESPACIO NODRIA</span><b>01 / 03</b></div>
          </div>
          <div className={styles.storyFoot}>
            <span><Check size={14} /> Seguimiento de pedidos</span>
            <span><Check size={14} /> Configuraciones guardadas</span>
          </div>
        </aside>

        <section className={styles.formPanel} aria-labelledby="auth-title">
          <div className={styles.formTopline}>
            <span><ShieldCheck size={15} /> ACCESO A TU CUENTA</span>
            <Link href="/">Volver a la tienda <ArrowRight size={13} /></Link>
          </div>
          <div className={styles.formHeading}>
            <p className={styles.mobileKicker}>NODRIA · TU ESPACIO</p>
            <h1 id="auth-title">{title}</h1>
            <p>{mode === "signin"
              ? "Continúa donde lo dejaste."
              : mode === "signup"
                ? "Crea tu cuenta y reúne aquí tus pedidos y equipos."
                : mode === "update"
                  ? "Elige una contraseña nueva para tu cuenta."
                  : "Te enviaremos instrucciones al correo asociado a tu cuenta."}</p>
          </div>

          {demoMode ? (
            <div className={styles.demoNotice} role="status">
              <div className={styles.demoIcon}><LockKeyhole size={19} /></div>
              <strong>El acceso no está conectado en esta demo</strong>
              <p>Esta instancia no tiene un proyecto Supabase configurado. No introduzcas contraseñas; puedes explorar el catálogo y los flujos ficticios.</p>
              <Link className={`button button--dark ${styles.submit}`} href="/catalogo">Explorar catálogo <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <>
              {(mode === "signin" || mode === "signup") && (
                <div className={styles.switcher} role="group" aria-label="Elige cómo acceder">
                  <button aria-pressed={mode === "signin"} className={mode === "signin" ? styles.selected : ""} onClick={() => { setMode("signin"); setError(""); setMessage(""); }} type="button">Iniciar sesión</button>
                  <button aria-pressed={mode === "signup"} className={mode === "signup" ? styles.selected : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }} type="button">Crear cuenta</button>
                </div>
              )}
              <form className={styles.form} onSubmit={submit}>
                {mode === "signup" && <div className={styles.field}><label htmlFor="auth-name">Nombre completo</label><div className={styles.inputWrap}><UserRound aria-hidden="true" size={17} /><input id="auth-name" name="fullName" autoComplete="name" maxLength={120} minLength={2} placeholder="Cómo te llamas" required /></div></div>}
                {mode !== "update" && <div className={styles.field}><label htmlFor="auth-email">Correo electrónico</label><div className={styles.inputWrap}><Mail aria-hidden="true" size={17} /><input id="auth-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="nombre@correo.com" required /></div></div>}
                {mode !== "reset" && <div className={styles.field}><label htmlFor="auth-password">{mode === "update" ? "Nueva contraseña" : "Contraseña"}</label><div className={styles.inputWrap}><KeyRound aria-hidden="true" size={17} /><input id="auth-password" name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} maxLength={72} placeholder="Mínimo 8 caracteres" required /></div>{mode !== "signin" && <small>Usa al menos 8 caracteres.</small>}</div>}
                {error && <p className={styles.messageError} role="alert">{error}</p>}
                {message && <p className={styles.messageSuccess} role="status">{message}</p>}
                <button className={`button button--dark ${styles.submit}`} disabled={busy} type="submit">
                  {busy ? <LoaderCircle size={16} className={styles.spinner} /> : <LockKeyhole size={16} />}
                  {busy ? "Un momento…" : mode === "signin" ? "Iniciar sesión" : mode === "signup" ? "Crear mi cuenta" : mode === "update" ? "Guardar contraseña" : "Enviar instrucciones"}
                  <ArrowRight size={15} />
                </button>
              </form>
              <div className={styles.formLinks}>
                {mode === "signin" && <button type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>¿Has olvidado tu contraseña?</button>}
                {(mode === "reset" || mode === "update") && <button type="button" onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Volver a iniciar sesión</button>}
                <span>{mode === "signup" ? "¿Ya tienes una cuenta?" : mode === "signin" ? "¿Primera vez aquí?" : ""} {(mode === "signin" || mode === "signup") && <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{mode === "signin" ? "Crea tu cuenta" : "Inicia sesión"}</button>}</span>
              </div>
              <p className={styles.privacy}><LockKeyhole size={13} /> Tu cuenta y tus pedidos están protegidos por tu sesión y los permisos de acceso.</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
