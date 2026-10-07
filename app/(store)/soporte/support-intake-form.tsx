"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, MessageCircleMore, ShieldCheck } from "lucide-react";

type OrganizationOption = { slug: string; displayName: string };
type TicketConfirmation = { mode: "demo" | "supabase"; ticketId: string; ticketNumber?: string };

export function SupportIntakeForm({
  demoMode,
  requiresAuth,
  unavailable,
  organizations,
}: {
  demoMode: boolean;
  requiresAuth: boolean;
  unavailable: boolean;
  organizations: OrganizationOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(requiresAuth);
  const [confirmation, setConfirmation] = useState<TicketConfirmation | null>(null);
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    const data = new FormData(form);
    const draft = {
      subject: String(data.get("subject") ?? ""),
      message: String(data.get("message") ?? ""),
      email: String(data.get("email") ?? ""),
      orderNumber: String(data.get("orderNumber") ?? ""),
      organizationSlug: String(data.get("organizationSlug") ?? ""),
      privacyAccepted: data.get("privacyAccepted") === "on",
    };
    const fingerprint = JSON.stringify(draft);
    if (!requestKey.current || requestKey.current.fingerprint !== fingerprint) {
      requestKey.current = { fingerprint, key: crypto.randomUUID() };
    }

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, idempotencyKey: requestKey.current.key }),
      });
      const body = await response.json() as {
        persisted?: boolean;
        mode?: "demo" | "supabase";
        ticketId?: string;
        ticketNumber?: string;
        code?: string;
        error?: string;
      };
      if (body.code === "AUTH_REQUIRED") setAuthRequired(true);
      if (!response.ok || !body.persisted || !body.ticketId || !body.mode) {
        throw new Error(body.error ?? "No se ha confirmado el guardado del ticket.");
      }
      requestKey.current = null;
      setConfirmation({ mode: body.mode, ticketId: body.ticketId, ticketNumber: body.ticketNumber });
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el ticket.");
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return <div className="support-success" role="status">
      <span className="confirmation-mark"><MessageCircleMore size={23} /></span>
      <p className="eyebrow">SOLICITUD REGISTRADA</p>
      <h2>Ya lo estamos mirando.</h2>
      <p>{confirmation.mode === "demo" ? "La solicitud ficticia se guardó en el archivo local de demostración." : "El ticket y su primer mensaje se guardaron juntos en tu cuenta."}</p>
      <code>{confirmation.ticketNumber ?? confirmation.ticketId}</code>
      <button className="text-button" type="button" onClick={() => setConfirmation(null)}>Abrir otra solicitud</button>
    </div>;
  }
  if (unavailable) return <p className="checkout-error" role="status">El soporte no está configurado en este entorno. No se ha guardado ninguna solicitud.</p>;
  if (authRequired) return <div className="support-success">
    <p className="eyebrow">ACCESO A TU CUENTA</p>
    <h3>Inicia sesión para abrir un ticket.</h3>
    <p>En el entorno conectado, el soporte queda asociado a una cuenta verificada. Las solicitudes públicas solo se guardan en el modo de demostración local.</p>
    <Link className="button button--dark" href="/acceso?next=%2Fsoporte">Iniciar sesión <ArrowRight size={14} /></Link>
  </div>;

  return <form className="support-form" onSubmit={submit}>
    <div className="form-grid">
      {demoMode && <div className="field"><label htmlFor="support-email">Correo de contacto ficticio</label><input id="support-email" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue="alex.garcia@demo.nodria.test" /></div>}
      <div className="field"><label htmlFor="support-order">Número de pedido <span>(opcional)</span></label><input id="support-order" name="orderNumber" maxLength={40} placeholder="NDR-2026-000000" /></div>
      {organizations.length > 0 && <div className="field"><label htmlFor="support-organization">Cuenta empresarial <span>(opcional)</span></label><select id="support-organization" name="organizationSlug" defaultValue=""><option value="">Consulta personal</option>{organizations.map((organization) => <option key={organization.slug} value={organization.slug}>{organization.displayName}</option>)}</select></div>}
      <div className="field field--wide"><label htmlFor="support-subject">¿En qué podemos ayudarte?</label><select id="support-subject" name="subject" required defaultValue=""><option value="" disabled>Selecciona un tema</option><option>Consulta sobre un producto</option><option>Pedido o envío</option><option>Devolución o garantía</option><option>Configuración o compatibilidad</option><option>Otro asunto</option></select></div>
      <div className="field field--wide"><label htmlFor="support-message">Cuéntanos un poco más</label><textarea id="support-message" name="message" minLength={20} maxLength={2400} rows={5} required placeholder="Indica qué ocurre y qué esperabas que sucediera…" /></div>
    </div>
    <label className="consent-check"><input name="privacyAccepted" type="checkbox" required /><span>He leído la <Link href="/legal/privacidad">información de privacidad</Link>. {demoMode ? "En esta demo, usa únicamente datos ficticios." : "Usaremos los datos de tu cuenta para responder."}</span></label>
    {error && <p className="checkout-error" role="alert">{error}{authRequired && <> <Link href="/acceso?next=%2Fsoporte">Inicia sesión para continuar.</Link></>}</p>}
    <button className="button button--dark" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin-icon" size={15} /> : <MessageCircleMore size={15} />}{busy ? "Guardando solicitud…" : "Abrir ticket de soporte"}<ArrowRight size={14} /></button>
    <p className="form-demo-note"><ShieldCheck size={13} />{demoMode ? "Solicitud pública de demostración; se guarda como un solo registro local." : "Ticket privado asociado a la cuenta y al pedido u organización que el servidor pueda verificar."}</p>
  </form>;
}
