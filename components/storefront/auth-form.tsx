"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";
import { getAuthFeedback, getCallbackFeedback } from "@/app/auth/callback/feedback";
import { BrandMark } from "@/components/storefront/brand-mark";
import styles from "./auth-form.module.css";

type Mode = "signin" | "signup" | "reset" | "update" | "confirm";

type AuthFormProps = {
  demoMode: boolean;
  redirectTo: string;
  initialMode: Mode;
  initialError?: string;
  initialMessage?: string;
};

function getCallbackUrl(destination: string) {
  // Auth links must return to the host where the user started the flow.
  // A build-time NEXT_PUBLIC_SITE_URL can be stale or point at localhost,
  // especially across Vercel production and preview deployments.
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", getSafeRedirectPath(destination));
  return callbackUrl.toString();
}

export function AuthForm({ demoMode, redirectTo, initialMode, initialError, initialMessage }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [error, setError] = useState(() => searchParams.get("error") === "callback"
    ? getCallbackFeedback(searchParams.get("motivo")) : initialError ?? "");
  const [email, setEmail] = useState("");
  const [pause, setPause] = useState<"email" | "all" | null>(null);
  const pending = useRef(false);
  const emailAction = mode === "signup" || mode === "reset" || mode === "confirm";
  const paused = pause === "all" || (pause === "email" && emailAction);

  useEffect(() => {
    if (!pause) return;
    // A UI pause limits repeated clicks; it does not predict the provider's quota reset.
    const timer = window.setTimeout(() => setPause(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [pause]);

  function changeMode(next: Mode) {
    if (pending.current) return;
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || paused || demoMode) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Auth unavailable");

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
        else {
          setPause("email");
          setMode("confirm");
          setMessage("Si el registro necesita confirmación, recibirás un correo. Revisa tu bandeja de entrada y spam y abre el enlace en este mismo navegador y dispositivo. Si ya tienes cuenta, prueba a iniciar sesión. Espera a recibir el correo antes de pedir otro.");
        }
        return;
      }

      if (mode === "confirm") {
        const { error: authError } = await supabase.auth.resend({
          type: "signup", email, options: { emailRedirectTo: getCallbackUrl(redirectTo) },
        });
        if (authError) throw authError;
        setPause("email");
        setMessage("Si hay una cuenta pendiente de confirmación para ese correo, recibirás un enlace. Revisa también spam y ábrelo en este mismo navegador y dispositivo. Usa el más reciente y espera a recibirlo antes de solicitar otro.");
        return;
      }

      if (mode === "reset") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getCallbackUrl("/acceso?modo=actualizar"),
        });
        if (authError) throw authError;
        setPause("email");
        setMessage("Si existe una cuenta para ese correo, recibirás instrucciones para recuperar el acceso. Revisa también spam y abre el enlace más reciente en este mismo navegador y dispositivo. Espera a recibirlo antes de solicitar otro.");
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      router.replace("/mi-cuenta");
    } catch (cause) {
      const feedback = getAuthFeedback(cause);
      setError(feedback.message);
      if (feedback.pause) setPause(feedback.pause);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const title = mode === "signin"
    ? "Qué bueno verte."
    : mode === "signup"
      ? "Empieza con buen pie."
      : mode === "update"
        ? "Elige una contraseña nueva."
        : mode === "confirm" ? "Confirma tu correo." : "Recupera el acceso.";

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
                  : mode === "confirm"
                    ? "Revisa primero tu bandeja de entrada y spam. Si ya confirmaste tu cuenta, inicia sesión."
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
                  <button disabled={busy} aria-pressed={mode === "signin"} className={mode === "signin" ? styles.selected : ""} onClick={() => changeMode("signin")} type="button">Iniciar sesión</button>
                  <button disabled={busy} aria-pressed={mode === "signup"} className={mode === "signup" ? styles.selected : ""} onClick={() => changeMode("signup")} type="button">Crear cuenta</button>
                </div>
              )}
              <form className={styles.form} onSubmit={submit} aria-busy={busy}>
                {mode === "signup" && <div className={styles.field}><label htmlFor="auth-name">Nombre completo</label><div className={styles.inputWrap}><UserRound aria-hidden="true" size={17} /><input id="auth-name" name="fullName" autoComplete="name" maxLength={120} minLength={2} placeholder="Cómo te llamas" required /></div></div>}
                {mode !== "update" && <div className={styles.field}><label htmlFor="auth-email">Correo electrónico</label><div className={styles.inputWrap}><Mail aria-hidden="true" size={17} /><input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="nombre@correo.com" required /></div></div>}
                {mode !== "reset" && mode !== "confirm" && <div className={styles.field}><label htmlFor="auth-password">{mode === "update" ? "Nueva contraseña" : "Contraseña"}</label><div className={styles.inputWrap}><KeyRound aria-hidden="true" size={17} /><input id="auth-password" name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signin" ? undefined : 8} maxLength={mode === "signin" ? undefined : 72} placeholder={mode === "signin" ? "Tu contraseña" : "Mínimo 8 caracteres"} required /></div>{mode !== "signin" && <small>Usa al menos 8 caracteres.</small>}</div>}
                {error && <p className={styles.messageError} role="alert">{error}</p>}
                {message && <p className={styles.messageSuccess} role="status">{message}</p>}
                {paused && <p id="auth-pause" className={styles.privacy} role="status">Espera antes de volver a {emailAction ? "solicitar un correo" : "intentarlo"}. Esta pausa dura al menos un minuto; el límite del servicio puede durar más. No se enviará nada automáticamente.</p>}
                <button className={`button button--dark ${styles.submit}`} disabled={busy || paused} aria-describedby={paused ? "auth-pause" : undefined} type="submit">
                  {busy ? <LoaderCircle size={16} className={styles.spinner} /> : <LockKeyhole size={16} />}
                  {busy ? "Un momento…" : mode === "signin" ? "Iniciar sesión" : mode === "signup" ? "Crear mi cuenta" : mode === "update" ? "Guardar contraseña" : mode === "confirm" ? "Solicitar enlace de confirmación" : "Enviar instrucciones"}
                  <ArrowRight size={15} />
                </button>
              </form>
              <div className={styles.formLinks}>
                {mode === "signin" && <button disabled={busy} type="button" onClick={() => changeMode("reset")}>¿Has olvidado tu contraseña?</button>}
                {(mode === "signin" || mode === "signup") && <button disabled={busy} type="button" onClick={() => changeMode("confirm")}>Confirmar mi correo</button>}
                {(mode === "reset" || mode === "update" || mode === "confirm") && <button disabled={busy} type="button" onClick={() => changeMode("signin")}>Volver a iniciar sesión</button>}
                {mode === "update" && <button disabled={busy} type="button" onClick={() => changeMode("reset")}>Solicitar un nuevo enlace de recuperación</button>}
                <span>{mode === "signup" ? "¿Ya tienes una cuenta?" : mode === "signin" ? "¿Primera vez aquí?" : ""} {(mode === "signin" || mode === "signup") && <button disabled={busy} type="button" onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Crea tu cuenta" : "Inicia sesión"}</button>}</span>
              </div>
              <p className={styles.privacy}><LockKeyhole size={13} /> Tu cuenta y tus pedidos están protegidos por tu sesión y los permisos de acceso.</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
