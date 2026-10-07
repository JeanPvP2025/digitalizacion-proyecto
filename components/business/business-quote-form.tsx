"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, RotateCcw } from "lucide-react";
import styles from "./business-quote-form.module.css";

type QuoteSuccess = { quoteId?: string };
type QuoteField = "companyName" | "contactName" | "email" | "volume" | "message" | "privacyAccepted";
type QuoteFieldErrors = Partial<Record<QuoteField, string>>;

type QuoteResponse = {
  persisted?: unknown;
  quoteId?: unknown;
  error?: unknown;
  message?: unknown;
};

function isRecord(value: unknown): value is QuoteResponse {
  return typeof value === "object" && value !== null;
}

function responseMessage(body: unknown) {
  if (!isRecord(body)) return null;
  const message = typeof body.error === "string" ? body.error : body.message;
  return typeof message === "string" && message.trim() ? message.trim().slice(0, 240) : null;
}

export function BusinessQuoteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<QuoteFieldErrors>({});
  const [success, setSuccess] = useState<QuoteSuccess | null>(null);

  function clearFieldError(field: QuoteField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const companyName = String(values.get("companyName") ?? "").trim();
    const contactName = String(values.get("contactName") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();
    const volume = String(values.get("volume") ?? "").trim();
    const message = String(values.get("message") ?? "").trim();
    const privacyAccepted = values.get("privacyAccepted") === "true";

    const nextFieldErrors: QuoteFieldErrors = {};
    if (!companyName) nextFieldErrors.companyName = "Escribe el nombre de la empresa sin dejarlo en blanco.";
    if (!contactName) nextFieldErrors.contactName = "Escribe el nombre de la persona de contacto.";
    if (!email) nextFieldErrors.email = "Escribe un correo profesional.";
    if (!volume) nextFieldErrors.volume = "Selecciona un volumen aproximado.";
    if (message.length < 20) nextFieldErrors.message = "Describe el proyecto con al menos 20 caracteres, sin contar los espacios iniciales o finales.";
    if (!privacyAccepted) nextFieldErrors.privacyAccepted = "Acepta la política de privacidad para enviar la solicitud.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Corrige los campos indicados antes de enviar la solicitud.");
      const firstInvalidField = Object.keys(nextFieldErrors)[0] as QuoteField;
      const control = form.elements.namedItem(firstInvalidField) as HTMLElement | null;
      requestAnimationFrame(() => control?.focus());
      return;
    }

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          contactName,
          email,
          ...(phone ? { phone } : {}),
          volume,
          message,
          privacyAccepted,
        }),
      });

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // A non-JSON response is still an API failure; it cannot confirm persistence.
      }

      if (!response.ok || !isRecord(body) || body.persisted !== true) {
        const serverMessage = responseMessage(body);
        throw new Error(serverMessage ?? `No se pudo guardar la solicitud (respuesta ${response.status}). Inténtalo de nuevo.`);
      }

      setSuccess({ quoteId: typeof body.quoteId === "string" ? body.quoteId : undefined });
      form.reset();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  function startAnotherRequest() {
    setSuccess(null);
    setError(null);
    formRef.current?.reset();
    requestAnimationFrame(() => companyInputRef.current?.focus());
  }

  if (success) {
    return (
      <section aria-atomic="true" aria-labelledby="quote-success-title" aria-live="polite" className={`${styles.formCard} ${styles.successCard}`} role="status" tabIndex={-1}>
        <span className={styles.successMark}><Check aria-hidden="true" size={20} strokeWidth={2} /></span>
        <p className={styles.formEyebrow}>SOLICITUD REGISTRADA</p>
        <h3 id="quote-success-title">Ya tenemos el contexto.</h3>
        <p className={styles.successCopy}>
          Tu solicitud se ha guardado correctamente. El equipo comercial podrá revisarla y continuar el contacto con la información que has compartido.
        </p>
        {success.quoteId && <p className={styles.reference}>REFERENCIA <strong>{success.quoteId}</strong></p>}
        <button className={styles.secondaryButton} onClick={startAnotherRequest} type="button">
          <RotateCcw aria-hidden="true" size={14} /> Enviar otra solicitud
        </button>
      </section>
    );
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div>
          <p className={styles.formEyebrow}>SOLICITUD DE PROPUESTA</p>
          <h3>Hablemos de lo que necesitas.</h3>
        </div>
        <span className={styles.formNumber}>01—03</span>
      </div>
      <p className={styles.formIntro}>Rellena este formulario. Los campos con <span aria-hidden="true">*</span> son obligatorios.</p>

      <form onSubmit={handleSubmit} ref={formRef}>
        <fieldset className={styles.fields} disabled={pending}>
          <legend className="sr-only">Datos de empresa y proyecto</legend>
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="quote-company">Empresa <span aria-hidden="true">*</span></label>
              <input aria-describedby={fieldErrors.companyName ? "quote-company-error" : undefined} aria-invalid={fieldErrors.companyName ? true : undefined} autoComplete="organization" id="quote-company" maxLength={120} minLength={2} name="companyName" onChange={() => clearFieldError("companyName")} ref={companyInputRef} required />
              {fieldErrors.companyName && <span className={styles.fieldError} id="quote-company-error">{fieldErrors.companyName}</span>}
            </div>
            <div className={styles.field}>
              <label htmlFor="quote-contact">Persona de contacto <span aria-hidden="true">*</span></label>
              <input aria-describedby={fieldErrors.contactName ? "quote-contact-error" : undefined} aria-invalid={fieldErrors.contactName ? true : undefined} autoComplete="name" id="quote-contact" maxLength={120} minLength={2} name="contactName" onChange={() => clearFieldError("contactName")} required />
              {fieldErrors.contactName && <span className={styles.fieldError} id="quote-contact-error">{fieldErrors.contactName}</span>}
            </div>
            <div className={styles.field}>
              <label htmlFor="quote-email">Correo profesional <span aria-hidden="true">*</span></label>
              <input aria-describedby={fieldErrors.email ? "quote-email-error" : undefined} aria-invalid={fieldErrors.email ? true : undefined} autoComplete="email" id="quote-email" maxLength={254} name="email" onChange={() => clearFieldError("email")} required type="email" />
              {fieldErrors.email && <span className={styles.fieldError} id="quote-email-error">{fieldErrors.email}</span>}
            </div>
            <div className={styles.field}>
              <label htmlFor="quote-phone">Teléfono <span className={styles.optional}>(opcional)</span></label>
              <input autoComplete="tel" id="quote-phone" maxLength={30} name="phone" type="tel" />
            </div>
            <div className={styles.field}>
              <label htmlFor="quote-volume">Volumen aproximado <span aria-hidden="true">*</span></label>
              <select aria-describedby={fieldErrors.volume ? "quote-volume-error" : undefined} aria-invalid={fieldErrors.volume ? true : undefined} defaultValue="" id="quote-volume" name="volume" onChange={() => clearFieldError("volume")} required>
                <option disabled value="">Selecciona una opción</option>
                <option value="1–5 equipos">1–5 equipos</option>
                <option value="6–25 equipos">6–25 equipos</option>
                <option value="26–100 equipos">26–100 equipos</option>
                <option value="Más de 100 equipos">Más de 100 equipos</option>
                <option value="Proyecto de infraestructura">Proyecto de infraestructura</option>
                <option value="Por definir">Todavía por definir</option>
              </select>
              {fieldErrors.volume && <span className={styles.fieldError} id="quote-volume-error">{fieldErrors.volume}</span>}
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label htmlFor="quote-message">¿Qué necesita tu empresa? <span aria-hidden="true">*</span></label>
              <textarea aria-describedby={`quote-message-help${fieldErrors.message ? " quote-message-error" : ""}`} aria-invalid={fieldErrors.message ? true : undefined} id="quote-message" maxLength={1500} minLength={20} name="message" onChange={() => clearFieldError("message")} placeholder="Por ejemplo: renovar 18 puestos de trabajo y revisar la conectividad de dos oficinas…" required rows={4} />
              {fieldErrors.message && <span className={styles.fieldError} id="quote-message-error">{fieldErrors.message}</span>}
              <span className={styles.helper} id="quote-message-help">Incluye el uso, el calendario o cualquier requisito que debamos conocer. Mínimo 20 caracteres.</span>
            </div>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <label className={styles.privacyLabel} htmlFor="quote-privacy">
                <input aria-describedby={fieldErrors.privacyAccepted ? "quote-privacy-error" : undefined} aria-invalid={fieldErrors.privacyAccepted ? true : undefined} id="quote-privacy" name="privacyAccepted" onChange={() => clearFieldError("privacyAccepted")} required type="checkbox" value="true" />
                <span>He leído la <Link href="/legal/privacidad" target="_blank" rel="noreferrer">política de privacidad</Link> y acepto que NODRIA trate estos datos para responder a mi solicitud. <span aria-hidden="true">*</span></span>
              </label>
              {fieldErrors.privacyAccepted && <span className={styles.fieldError} id="quote-privacy-error">{fieldErrors.privacyAccepted}</span>}
            </div>
          </div>
        </fieldset>

        {error && <p className={styles.formError} id="quote-error" ref={errorRef} role="alert" tabIndex={-1}>{error}</p>}

        <div className={styles.submitRow}>
          <button className="button button--dark" disabled={pending} type="submit">
            {pending ? <><LoaderCircle aria-hidden="true" className={styles.spinner} size={15} /> Enviando solicitud…</> : <>Enviar solicitud <ArrowRight aria-hidden="true" size={15} /></>}
          </button>
          <span>Respuesta a través del correo indicado</span>
        </div>
        <p className={styles.formFootnote}>NODRIA es un proyecto académico ficticio. La solicitud se utiliza para mostrar el flujo de presupuestos empresariales de la demo.</p>
      </form>
    </div>
  );
}
