"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, MessageCircleMore, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function SupportForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: data.get("subject"), message: data.get("message"), email: data.get("email"), orderNumber: data.get("orderNumber") || "", privacyAccepted: data.get("privacyAccepted") === "on" }) });
      const body = await response.json() as { persisted?: boolean; ticketId?: string; error?: string };
      if (!response.ok || !body.persisted || !body.ticketId) throw new Error(body.error ?? "No se ha confirmado el guardado del ticket.");
      setTicketId(body.ticketId);
      event.currentTarget.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir el ticket."); }
    finally { setBusy(false); }
  }

  if (ticketId) return <div className="support-success" role="status"><span className="confirmation-mark"><MessageCircleMore size={23} /></span><p className="eyebrow">SOLICITUD REGISTRADA</p><h2>Ya lo estamos mirando.</h2><p>Tu ticket se guardó en el entorno demo con referencia:</p><code>{ticketId}</code><p>Te responderíamos al correo indicado en un día laborable. Esta respuesta y el plazo son demostrativos.</p><button className="text-button" type="button" onClick={() => setTicketId("")}>Abrir otra solicitud</button></div>;
  return <form className="support-form" onSubmit={submit}>
    <div className="form-grid"><div className="field"><label htmlFor="support-email">Correo electrónico</label><input id="support-email" name="email" type="email" autoComplete="email" required maxLength={200} defaultValue="alex.garcia@demo.nodria.test" /></div><div className="field"><label htmlFor="support-order">Número de pedido <span>(opcional)</span></label><input id="support-order" name="orderNumber" maxLength={40} placeholder="NDR-2026-000000" /></div><div className="field field--wide"><label htmlFor="support-subject">¿En qué podemos ayudarte?</label><select id="support-subject" name="subject" required defaultValue=""><option value="" disabled>Selecciona un tema</option><option>Consulta sobre un producto</option><option>Pedido o envío</option><option>Devolución o garantía</option><option>Configuración o compatibilidad</option><option>Otro asunto</option></select></div><div className="field field--wide"><label htmlFor="support-message">Cuéntanos un poco más</label><textarea id="support-message" name="message" minLength={20} maxLength={2400} rows={5} required placeholder="Indica qué ocurre y qué esperabas que sucediera…" /></div></div>
    <label className="consent-check"><input name="privacyAccepted" type="checkbox" required /><span>He leído la <Link href="/legal/privacidad">información de privacidad</Link>. En este entorno, usa únicamente datos ficticios.</span></label>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    <button className="button button--dark" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin-icon" size={15} /> : <MessageCircleMore size={15} />}{busy ? "Guardando solicitud…" : "Abrir ticket de soporte"}<ArrowRight size={14} /></button>
    <p className="form-demo-note"><ShieldCheck size={13} /> El ticket solo se guarda en el archivo local de demostración. No incluyas datos personales reales.</p>
  </form>;
}
