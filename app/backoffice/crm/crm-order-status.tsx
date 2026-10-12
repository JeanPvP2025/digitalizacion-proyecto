import type { CrmFulfillmentStatus, CrmOrderStatus, CrmPaymentStatus, CrmReturnStatus } from "@/lib/crm/orders";
import styles from "./crm-order-status.module.css";

type StatusKind = "order" | "payment" | "fulfillment" | "return";
type StatusValue = CrmOrderStatus | CrmPaymentStatus | CrmFulfillmentStatus | CrmReturnStatus;

const labels: Record<StatusKind, Record<string, string>> = {
  order: {
    pending_payment: "Pendiente de pago", paid: "Pagado", processing: "En preparación",
    shipped: "En tránsito", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado",
  },
  payment: {
    pending: "Pendiente", authorized: "Autorizado", paid: "Pagado", failed: "Fallido",
    partially_refunded: "Reembolso parcial", refunded: "Reembolsado",
  },
  fulfillment: {
    not_started: "Sin preparar", pending: "Pendiente de preparación", picking: "En picking",
    packed: "Empaquetado", shipped: "En tránsito", delivered: "Entregado",
    cancelled: "Cancelado", not_required: "No requerido",
  },
  return: { requested: "Solicitada", approved: "Aprobada", rejected: "Rechazada", received: "Recibida", refunded: "Reembolsada", closed: "Cerrada" },
};

export function CrmOrderStatus({ kind, value }: { kind: StatusKind; value: StatusValue | null }) {
  if (!value) return <span className={`${styles.badge} ${styles.muted}`}>—</span>;
  const label = labels[kind][value] ?? value;
  return <span className={`${styles.badge} ${styles[`kind_${kind}`]} ${styles[`value_${value}`] ?? ""}`}>{label}</span>;
}

export function crmDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(date);
}

export function crmMoney(value: number, currency: string): string {
  try { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value); }
  catch { return `${value.toLocaleString("es-ES")} ${currency}`; }
}
