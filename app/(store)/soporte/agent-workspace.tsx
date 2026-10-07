"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { ReturnCase } from "@/lib/support/workflow";
import { TicketHistory } from "./ticket-history";
import styles from "./workflow.module.css";

const statusLabels: Record<string, string> = {
  requested: "Pendiente de revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  received: "Recibida",
  refunded: "Reembolsada",
  closed: "Cerrada",
};

export function SupportAgentWorkspace() {
  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestKeys = useRef(new Map<string, { fingerprint: string; key: string }>());

  async function loadQueue() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/support/returns/queue", { cache: "no-store" });
      const body = await response.json() as { returns?: ReturnCase[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la bandeja RMA.");
      setReturns(body.returns ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la bandeja RMA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialQueue() {
      try {
        const response = await fetch("/api/support/returns/queue", { cache: "no-store" });
        const body = await response.json() as { returns?: ReturnCase[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la bandeja RMA.");
        if (active) setReturns(body.returns ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar la bandeja RMA.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialQueue();
    return () => { active = false; };
  }, []);

  async function decide(request: ReturnCase, decision: "approved" | "rejected") {
    const reason = (notes[request.id] ?? "").trim();
    if (decision === "rejected" && reason.length < 10) {
      setError("Añade al menos 10 caracteres para explicar el rechazo.");
      return;
    }
    setBusyId(request.id);
    setError("");
    setNotice("");
    const fingerprint = JSON.stringify({ decision, reason });
    const existingKey = requestKeys.current.get(request.id);
    const key = existingKey?.fingerprint === fingerprint ? existingKey.key : crypto.randomUUID();
    requestKeys.current.set(request.id, { fingerprint, key });
    try {
      const response = await fetch(`/api/support/returns/${encodeURIComponent(request.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason, idempotencyKey: key }),
      });
      const body = await response.json() as {
        error?: string;
        refundAmount?: number | null;
        refundCurrency?: string | null;
        pendingInspectionQuantity?: number;
      };
      if (!response.ok) throw new Error(body.error ?? "No se pudo registrar la decisión.");
      requestKeys.current.delete(request.id);
      setNotes((current) => ({ ...current, [request.id]: "" }));
      setNotice(decision === "approved"
        ? `${request.returnNumber}: aprobada; reembolso demo ${formatMoney(body.refundAmount ?? 0, body.refundCurrency ?? "EUR")} y ${body.pendingInspectionQuantity ?? 0} unidades pendientes de inspección.`
        : `${request.returnNumber}: devolución rechazada; no se ha generado reembolso ni movimiento de stock.`);
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la decisión.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className={styles.agentWorkspace}>
      <TicketHistory connected authenticated agentMode />
      <section className={styles.history} aria-labelledby="return-review-title" aria-busy={loading}>
        <div className={styles.sectionHeading}>
          <div><p className="eyebrow">DEVOLUCIONES</p><h2 id="return-review-title">Solicitudes por revisar</h2></div>
          <button className="text-button" type="button" onClick={() => void loadQueue()} disabled={loading}>
            {loading ? <LoaderCircle className="spin-icon" size={14} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />} Actualizar
          </button>
        </div>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        {notice && <p className="support-success" role="status">{notice}</p>}
        {!loading && returns.length === 0 && !error && <p className="support-empty-state">No hay devoluciones pendientes de revisión.</p>}
        <div className={styles.returnList}>
          {returns.map((request) => <article className={styles.reviewCard} key={request.id}>
            <div className={styles.returnCardHeader}>
              <div><code>{request.returnNumber}</code><p>Pedido {request.orderNumber} · Cuenta {request.customerId.slice(0, 8)}</p></div>
              <span className={styles.status} data-status={request.status}>{statusLabels[request.status] ?? request.status}</span>
            </div>
            <p className={styles.returnReason}>{request.reason}</p>
            <ul className={styles.returnLines}>{request.items.map((item) => <li key={item.orderItemId}>{item.name} · {item.sku} · {item.variant}: <strong>{item.requestedQuantity} de {item.purchasedQuantity} compradas</strong></li>)}</ul>
            <ol className={styles.returnTimeline}>{request.timeline.map((event) => <li key={event.id}>
              <span>{event.type === "requested" ? "Solicitud recibida" : event.type === "business_effects_recorded" ? "Efectos de la aprobación registrados" : `Estado: ${statusLabels[event.fromStatus ?? ""] ?? event.fromStatus ?? "—"} → ${statusLabels[event.toStatus] ?? event.toStatus}`}</span>
              <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
              {event.reason && <p>{event.reason}</p>}
              {event.type === "business_effects_recorded" && <p>Reembolso demo {formatMoney(Number(event.details.refund_amount), String(event.details.refund_currency))}; {Number(event.details.returned_quantity)} unidades pendientes de inspección.</p>}
            </li>)}</ol>
            <div className="field">
              <label htmlFor={`return-decision-${request.id}`}>Motivo o nota de la decisión</label>
              <textarea id={`return-decision-${request.id}`} rows={3} maxLength={1000} value={notes[request.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Explica la decisión para dejar constancia en el historial…" />
            </div>
            <div className={styles.reviewActions}>
              <button className="button button--dark" type="button" onClick={() => void decide(request, "approved")} disabled={busyId === request.id}>
                {busyId === request.id ? <LoaderCircle className="spin-icon" size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Aprobar
              </button>
              <button className="button button--outline" type="button" onClick={() => void decide(request, "rejected")} disabled={busyId === request.id || (notes[request.id] ?? "").trim().length < 10}>
                {busyId === request.id ? <LoaderCircle className="spin-icon" size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />} Rechazar
              </button>
            </div>
          </article>)}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount);
}
