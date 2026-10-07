"use client";

import { useEffect, useState } from "react";
import { RefreshCw, LoaderCircle, PackageCheck } from "lucide-react";
import type { ReturnCase } from "@/lib/support/workflow";
import styles from "./workflow.module.css";

const statusLabels: Record<string, string> = {
  requested: "Pendiente de revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  received: "Recibida",
  refunded: "Reembolsada",
  closed: "Cerrada",
};

export function ReturnHistory({ connected, authenticated, reloadKey }: { connected: boolean; authenticated: boolean; reloadKey: number }) {
  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/support/returns/history", { cache: "no-store" });
      const body = await response.json() as { returns?: ReturnCase[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
      setReturns(body.returns ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function refreshHistory() {
      try {
        const response = await fetch("/api/support/returns/history", { cache: "no-store" });
        const body = await response.json() as { returns?: ReturnCase[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
        if (active) setReturns(body.returns ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refreshHistory();
    return () => { active = false; };
  }, [reloadKey]);

  if (!connected) return <div className="support-empty-state"><p>El seguimiento de devoluciones necesita pedidos conectados a una cuenta.</p></div>;
  if (!authenticated) return <div className="support-empty-state"><p>Inicia sesión para ver el estado de tus devoluciones.</p></div>;

  return (
    <section className={styles.returnHistory} aria-labelledby="return-history-title">
      <div className={styles.sectionHeading}>
        <div><p className="eyebrow">SEGUIMIENTO</p><h3 id="return-history-title">Tus devoluciones</h3></div>
        <button className="text-button" type="button" onClick={() => void loadHistory()} disabled={loading}>
          {loading ? <LoaderCircle className="spin-icon" size={14} /> : <RefreshCw size={14} />} Actualizar
        </button>
      </div>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      {!loading && returns.length === 0 && !error && <p className="support-empty-state">Aún no hay solicitudes de devolución asociadas a tu cuenta.</p>}
      <div className={styles.returnList}>
        {returns.map((request) => <article className={styles.returnCard} key={request.id}>
          <div className={styles.returnCardHeader}>
            <div><code>{request.returnNumber}</code><p>Pedido {request.orderNumber}</p></div>
            <span className={styles.status} data-status={request.status}>{statusLabels[request.status] ?? request.status}</span>
          </div>
          <p className={styles.returnReason}>{request.reason}</p>
          {request.refundAmount !== null && request.refundCurrency && <p className={styles.decisionReason}><PackageCheck size={14} /> Reembolso demo registrado: {formatMoney(request.refundAmount, request.refundCurrency)}.</p>}
          {request.pendingInspectionQuantity > 0 && <p className={styles.decisionReason}><PackageCheck size={14} /> {request.pendingInspectionQuantity} unidades esperan inspección; aún no se han reincorporado al stock disponible.</p>}
          <ul className={styles.returnLines}>{request.items.map((item) => <li key={item.orderItemId}>{item.name} · {item.variant}: <strong>{item.requestedQuantity} de {item.purchasedQuantity} compradas</strong>{item.inventoryDisposition === "pending_inspection" && <small> · {item.inspectionQuantity} pendientes de inspección</small>}{item.inventoryDisposition === "restocked" && <small> · Apta y repuesta en almacén</small>}{item.inventoryDisposition === "disposed" && <small> · No apta para reventa; desechada</small>}</li>)}</ul>
          {request.decisionReason && <p className={styles.decisionReason}><PackageCheck size={14} /> Decisión del equipo: {request.decisionReason}</p>}
          <ol className={styles.returnTimeline}>{request.timeline.map((event) => <li key={event.id}>
            <span>{event.type === "requested" ? "Solicitud recibida" : event.type === "business_effects_recorded" ? "Efectos de la aprobación registrados" : event.type === "inspection_completed" ? "Inspección de almacén completada" : `Estado: ${statusLabels[event.fromStatus ?? ""] ?? event.fromStatus ?? "—"} → ${statusLabels[event.toStatus] ?? event.toStatus}`}</span>
            <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
            {event.reason && <p>{event.reason}</p>}
            {event.type === "business_effects_recorded" && <p>Reembolso demo {formatMoney(Number(event.details.refund_amount), String(event.details.refund_currency))}; {Number(event.details.returned_quantity)} unidades pendientes de inspección.</p>}
            {event.type === "inspection_completed" && <p>{Number(event.details.quantity)} unidades: {event.details.disposition === "restocked" ? "inspeccionadas y repuestas en inventario." : "inspeccionadas y retiradas del inventario disponible."}</p>}
          </li>)}</ol>
        </article>)}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount);
}
