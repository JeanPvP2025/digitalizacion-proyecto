"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, MessageCircle, RefreshCw } from "lucide-react";
import styles from "./workflow.module.css";

type TicketSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type TicketDetails = {
  ticket: TicketSummary;
  messages: Array<{ id: string; authorType: string; body: string; internal: boolean; createdAt: string }>;
  events: Array<{ id: string; type: string; fromStatus: string | null; toStatus: string; occurredAt: string }>;
};

const statusLabels: Record<string, string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting_customer: "Esperando tu respuesta",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export function TicketHistory({
  connected,
  authenticated,
  agentMode = false,
}: {
  connected: boolean;
  authenticated: boolean;
  agentMode?: boolean;
}) {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<TicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/support/tickets", { cache: "no-store" });
      const body = await response.json() as { tickets?: TicketSummary[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
      const rows = body.tickets ?? [];
      const nextSelectedId = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id ?? "";
      setTickets(rows);
      setSelectedId(nextSelectedId);
      if (nextSelectedId !== selectedId) setLoadingDetails(Boolean(nextSelectedId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialTickets() {
      try {
        const response = await fetch("/api/support/tickets", { cache: "no-store" });
        const body = await response.json() as { tickets?: TicketSummary[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
        if (!active) return;
        const rows = body.tickets ?? [];
        setTickets(rows);
        setSelectedId(rows[0]?.id ?? "");
        setLoadingDetails(Boolean(rows[0]));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialTickets();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    fetch(`/api/support/tickets/${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as TicketDetails & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo abrir la conversación.");
        if (active) setDetails(body);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo abrir la conversación.");
      })
      .finally(() => { if (active) setLoadingDetails(false); });
    return () => { active = false; };
  }, [selectedId]);

  const visibleDetails = details?.ticket.id === selectedId ? details : null;

  async function loadDetails(ticketId: string) {
    const response = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
    const body = await response.json() as TicketDetails & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "No se pudo actualizar la conversación.");
    setDetails(body);
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visibleDetails) return;
    setBusy(true);
    setError("");
    const cleanMessage = message.trim();
    const statusValue = agentMode ? (nextStatus || (visibleDetails.ticket.status === "resolved" ? "closed" : "")) : "";
    const fingerprint = JSON.stringify({ message: cleanMessage, status: statusValue });
    if (!requestKey.current || requestKey.current.fingerprint !== fingerprint) {
      requestKey.current = { fingerprint, key: crypto.randomUUID() };
    }
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(visibleDetails.ticket.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: cleanMessage,
          idempotencyKey: requestKey.current.key,
          ...(statusValue ? { status: statusValue } : {}),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el mensaje.");
      requestKey.current = null;
      setMessage("");
      setNextStatus("");
      await loadDetails(visibleDetails.ticket.id);
      await loadTickets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  if (!connected) {
    return <section className="support-empty-state"><h2>Historial de soporte</h2><p>El historial necesita tickets guardados en una cuenta conectada. La demo local no conserva conversaciones de pedido.</p></section>;
  }
  if (!authenticated) {
    return <section className="support-empty-state"><h2>Historial de soporte</h2><p>Inicia sesión para consultar y responder a tus tickets.</p><a className="button button--dark" href="/acceso?next=%2Fsoporte">Iniciar sesión <ArrowRight size={14} /></a></section>;
  }

  return (
    <section className={styles.history} aria-labelledby={agentMode ? "support-inbox-title" : "support-history-title"}>
      <div className={styles.sectionHeading}>
        <div>
          <p className="eyebrow">{agentMode ? "BANDEJA DE AGENTES" : "TUS CONVERSACIONES"}</p>
          <h2 id={agentMode ? "support-inbox-title" : "support-history-title"}>{agentMode ? "Tickets de soporte" : "Historial de soporte"}</h2>
        </div>
        <button className="text-button" type="button" onClick={() => void loadTickets()} disabled={loading}>
          {loading ? <LoaderCircle className="spin-icon" size={15} /> : <RefreshCw size={14} />} Actualizar
        </button>
      </div>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      <div className={styles.historyLayout}>
        <div className={styles.ticketList} aria-label={agentMode ? "Cola de tickets" : "Tus tickets"}>
          {loading && tickets.length === 0 && <p className="support-empty-state">Cargando tickets…</p>}
          {!loading && tickets.length === 0 && <p className="support-empty-state">{agentMode ? "No hay tickets en la bandeja." : "Todavía no has abierto ningún ticket conectado."}</p>}
          {tickets.map((ticket) => (
            <button
              className={`${styles.ticketCard}${selectedId === ticket.id ? ` ${styles.ticketCardSelected}` : ""}`}
              key={ticket.id}
              type="button"
              onClick={() => { if (selectedId !== ticket.id) { setError(""); setLoadingDetails(true); setSelectedId(ticket.id); } }}
              aria-pressed={selectedId === ticket.id}
            >
              <span className={styles.ticketCardTop}><code>{ticket.ticketNumber}</code><span className={styles.status} data-status={ticket.status}>{statusLabels[ticket.status] ?? ticket.status}</span></span>
              <strong>{ticket.subject}</strong>
              <small>{formatDate(ticket.updatedAt)}</small>
            </button>
          ))}
        </div>
        <div className={styles.conversation} aria-live="polite">
          {loadingDetails && <p className="support-empty-state">Cargando conversación…</p>}
          {!loadingDetails && !visibleDetails && tickets.length > 0 && <p className="support-empty-state">Elige un ticket para ver la conversación y su historial.</p>}
          {!loadingDetails && visibleDetails && <>
            <div className={styles.conversationHeading}>
              <div><code>{visibleDetails.ticket.ticketNumber}</code><h3>{visibleDetails.ticket.subject}</h3></div>
              <span className={styles.status} data-status={visibleDetails.ticket.status}>{statusLabels[visibleDetails.ticket.status] ?? visibleDetails.ticket.status}</span>
            </div>
            <ol className={styles.timeline}>
              {buildTimeline(visibleDetails, agentMode).map((entry) => (
                <li className={entry.kind === "message" ? `${styles.timelineMessage}${entry.agent ? ` ${styles.isAgent}` : ""}` : styles.timelineEvent} key={entry.id}>
                  {entry.kind === "message" ? <>
                    <span className={styles.timelineMeta}>{entry.agent ? "Equipo NODRIA" : agentMode ? "Cliente" : "Tu cuenta"} · {formatDate(entry.at)}{entry.internal ? " · Nota interna" : ""}</span>
                    <p>{entry.body}</p>
                  </> : <span>{entry.label} · {formatDate(entry.at)}</span>}
                </li>
              ))}
            </ol>
            {visibleDetails.ticket.status !== "closed" && (agentMode || !["resolved", "closed"].includes(visibleDetails.ticket.status)) && (
              <form className={styles.replyForm} onSubmit={submitMessage}>
                {agentMode && <div className="field">
                  <label htmlFor="support-next-status">Estado después de responder</label>
                  <select id="support-next-status" value={nextStatus || (visibleDetails.ticket.status === "resolved" ? "closed" : "")} onChange={(event) => setNextStatus(event.target.value)}>
                    <option value="">Sin cambio de estado</option>
                    {statusChoices(visibleDetails.ticket.status).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                </div>}
                <div className="field">
                  <label htmlFor="support-reply">{agentMode ? "Respuesta para el cliente" : "Tu respuesta"}</label>
                  <textarea id="support-reply" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={10000} required placeholder={agentMode ? "Escribe una respuesta clara para el cliente…" : "Añade información para el equipo de soporte…"} />
                </div>
                <button className="button button--dark" type="submit" disabled={busy || !message.trim()}>
                  {busy ? <LoaderCircle className="spin-icon" size={15} /> : <MessageCircle size={15} />}
                  {busy ? "Guardando…" : "Enviar respuesta"}<ArrowRight size={14} />
                </button>
                <p className="form-demo-note">{agentMode ? "La respuesta y el cambio de estado se guardan juntos. Puedes reintentar el mismo envío sin duplicarlo." : "Tu respuesta se añade al historial del ticket. El servidor confirma que tienes acceso antes de guardarla."}</p>
              </form>
            )}
            {visibleDetails.ticket.status === "closed" && <p className="support-empty-state">Este ticket está cerrado y ya no admite nuevas respuestas.</p>}
          </>}
        </div>
      </div>
    </section>
  );
}

function statusChoices(status: string) {
  if (status === "resolved") return ["closed"];
  if (status === "open") return ["in_progress", "waiting_customer", "resolved", "closed"];
  if (status === "in_progress" || status === "waiting_customer") return ["in_progress", "waiting_customer", "resolved", "closed"];
  return [];
}

function buildTimeline(details: TicketDetails, agentMode: boolean) {
  const entries: Array<{ id: string; kind: "message" | "event"; at: string; body?: string; agent?: boolean; internal?: boolean; label?: string }> = [
    ...details.events.map((event) => ({
      id: `event-${event.id}`,
      kind: "event" as const,
      at: event.occurredAt,
      label: event.type === "created"
        ? `Ticket abierto · ${statusLabels[event.toStatus] ?? event.toStatus}`
        : `Estado: ${statusLabels[event.fromStatus ?? ""] ?? event.fromStatus ?? "—"} → ${statusLabels[event.toStatus] ?? event.toStatus}`,
    })),
    ...details.messages.filter((entry) => agentMode || !entry.internal).map((entry) => ({
      id: `message-${entry.id}`,
      kind: "message" as const,
      at: entry.createdAt,
      body: entry.body,
      agent: entry.authorType === "agent",
      internal: entry.internal,
    })),
  ];
  return entries.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
