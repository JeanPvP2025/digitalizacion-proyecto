"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine, Ban, Building2, ChevronRight, ClipboardList, FilePlus2,
  History, PackageCheck, Pencil, Plus, Send,
} from "lucide-react";
import type {
  ProcurementEvent, ProcurementOrder, ProcurementReceipt, ProcurementStockOption,
  ProcurementSupplier, ProcurementWarehouse,
} from "@/lib/inventory/procurement/data";
import styles from "./procurement.module.css";

type BoardProps = {
  suppliers: ProcurementSupplier[];
  warehouses: ProcurementWarehouse[];
  stockOptions: ProcurementStockOption[];
  orders: ProcurementOrder[];
  isOrdersLimited: boolean;
  isInventoryLimited: boolean;
};
type Composer = "order" | "supplier" | null;
type OrderLineDraft = { variantId: string; quantity: string; unitCost: string };
type Feedback = { kind: "success" | "error"; text: string };

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador", ordered: "Enviado", partially_received: "Parcial",
  received: "Recibido", cancelled: "Cancelado",
};
const EVENT_LABELS: Record<string, string> = {
  created: "Pedido creado", draft_updated: "Borrador actualizado", placed: "Pedido enviado",
  cancelled: "Pedido cancelado", transition_rejected: "Transición rechazada",
  receipt_completed: "Recepción confirmada", receipt_rejected: "Recepción rechazada",
  receipt_failed: "Fallo de recepción", receipt_replay_rejected: "Reintento con otros datos",
};
const RECEIPT_ERRORS: Record<string, string> = {
  purchase_order_not_receivable: "El pedido no admitía recepciones en ese estado.",
  purchase_order_line_not_found: "La línea ya no pertenece al pedido.",
  quantity_exceeds_pending: "La cantidad superaba lo pendiente.",
  inventory_write_failed: "Falló la escritura atómica del ledger de inventario.",
};

function formatNumber(value: number): string {
  return value.toLocaleString("es-ES");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Madrid" }).format(date);
}

function orderValue(order: ProcurementOrder): number {
  return order.lines.reduce((total, line) => total + line.orderedQuantity * line.unitCost, 0);
}

function pendingUnits(order: ProcurementOrder): number {
  return order.lines.reduce((total, line) => total + line.orderedQuantity - line.receivedQuantity, 0);
}

function OrderStatus({ status }: { status: string }) {
  const className = status === "received" ? styles.statusReceived
    : status === "partially_received" ? styles.statusPartial
      : status === "cancelled" ? styles.statusCancelled
        : status === "ordered" ? styles.statusOrdered : styles.statusDraft;
  return <span className={`${styles.status} ${className}`}><i aria-hidden="true" />{STATUS_LABELS[status] ?? status}</span>;
}

function EventTitle({ event }: { event: ProcurementEvent }) {
  return <>{EVENT_LABELS[event.eventType] ?? "Actualización"}</>;
}

export function ProcurementBoard(props: BoardProps) {
  const router = useRouter();
  const [requestedOrderId, setSelectedOrderId] = useState(props.orders[0]?.id ?? "");
  const [composer, setComposer] = useState<Composer>(null);
  const [editingOrderId, setEditingOrderId] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedOrderId = props.orders.some((order) => order.id === requestedOrderId)
    ? requestedOrderId : props.orders[0]?.id ?? "";
  const selectedOrder = props.orders.find((order) => order.id === selectedOrderId) ?? null;
  const activeOrders = props.orders.filter((order) => ["ordered", "partially_received"].includes(order.status));
  const pendingCount = activeOrders.length;
  const remaining = activeOrders.reduce((total, order) => total + pendingUnits(order), 0);
  const committedValue = activeOrders.reduce((total, order) => total + order.lines.reduce(
    (subtotal, line) => subtotal + (line.orderedQuantity - line.receivedQuantity) * line.unitCost, 0,
  ), 0);

  async function perform(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
    const response = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, data };
  }

  function showComposer(kind: Composer) {
    setFeedback(null);
    setComposer(kind);
    if (kind !== "order") setEditingOrderId("");
    if (kind !== "supplier") setEditingSupplierId("");
  }

  async function transition(order: ProcurementOrder, action: "place" | "cancel") {
    if (pending) return;
    setPending(true);
    setFeedback(null);
    try {
      const result = await perform(`/api/backoffice/procurement/purchase-orders/${order.id}/actions`, "POST", { action });
      if (!result.ok) {
        setFeedback({ kind: "error", text: String(result.data.error ?? "No se pudo cambiar el estado del pedido.") });
      } else {
        setFeedback({ kind: "success", text: action === "place" ? `${order.orderNumber} enviado al proveedor.` : `${order.orderNumber} cancelado.` });
        router.refresh();
      }
    } catch {
      setFeedback({ kind: "error", text: "No se pudo conectar. Vuelve a cargar antes de repetir la transición." });
    } finally { setPending(false); }
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Resumen de compras pendientes">
        <article className={styles.metric}>
          <span>ÓRDENES ABIERTAS</span><strong>{formatNumber(pendingCount)}</strong>
          <small>Enviadas o con recepción parcial</small>
        </article>
        <article className={styles.metric}>
          <span>UNIDADES PENDIENTES</span><strong>{formatNumber(remaining)}</strong>
          <small>Saldo de cantidades por recibir</small>
        </article>
        <article className={`${styles.metric} ${styles.metricValue}`}>
          <span>VALOR PENDIENTE</span><strong>{formatMoney(committedValue)}</strong>
          <small>Coste registrado en las líneas abiertas</small>
        </article>
      </section>

      {feedback && <p className={`${styles.feedback} ${feedback.kind === "error" ? styles.feedbackError : styles.feedbackSuccess}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</p>}
      {props.isInventoryLimited && <p className={styles.limitNote}>Las opciones de compra están limitadas a las 500 referencias de inventario más recientes.</p>}

      <div className={styles.workspace}>
        <section className={styles.ordersPanel} aria-labelledby="orders-title">
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>ABASTECIMIENTO</p><h2 id="orders-title">Órdenes de compra <span>{formatNumber(props.orders.length)}</span></h2></div>
            <button className={styles.primaryButton} type="button" onClick={() => { setEditingOrderId(""); showComposer("order"); }}>
              <FilePlus2 size={15} aria-hidden="true" /> Nuevo pedido
            </button>
          </div>
          {props.isOrdersLimited && <p className={styles.limitNote}>Se muestran los 100 pedidos más recientes.</p>}
          {props.orders.length === 0 ? (
            <div className={styles.emptyState}><ClipboardList size={22} aria-hidden="true" /><strong>Aún no hay órdenes de compra</strong><p>Crea un borrador con proveedor, almacén y líneas de producto para iniciar el abastecimiento.</p></div>
          ) : (
            <div className={styles.orderList} role="list" aria-label="Órdenes de compra recientes">
              {props.orders.map((order) => (
                <button key={order.id} className={`${styles.orderRow} ${selectedOrderId === order.id ? styles.orderRowSelected : ""}`} type="button" role="listitem" onClick={() => { setSelectedOrderId(order.id); setComposer(null); setFeedback(null); }}>
                  <span className={styles.orderIdentity}><strong>{order.orderNumber}</strong><small>{order.supplierName}</small></span>
                  <span className={styles.orderMeta}><strong>{order.lines.length} {order.lines.length === 1 ? "línea" : "líneas"}</strong><small>{order.warehouseName} · {formatDate(order.expectedDelivery)}</small></span>
                  <span className={styles.orderTotals}><OrderStatus status={order.status} /><small>{pendingUnits(order) ? `${formatNumber(pendingUnits(order))} ud. pendientes` : formatMoney(orderValue(order))}</small></span>
                  <ChevronRight className={styles.orderChevron} size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className={styles.sideColumn}>
          {composer === "order" ? (
            <PurchaseOrderComposer
              order={props.orders.find((order) => order.id === editingOrderId) ?? null}
              suppliers={props.suppliers} warehouses={props.warehouses} stockOptions={props.stockOptions}
              pending={pending} onPending={setPending} onClose={() => { setComposer(null); setEditingOrderId(""); }}
              onFeedback={setFeedback} onSaved={(id, message) => { setSelectedOrderId(id); setComposer(null); setEditingOrderId(""); setFeedback({ kind: "success", text: message }); router.refresh(); }}
            />
          ) : composer === "supplier" ? (
            <SupplierComposer
              supplier={props.suppliers.find((supplier) => supplier.id === editingSupplierId) ?? null}
              pending={pending} onPending={setPending} onClose={() => { setComposer(null); setEditingSupplierId(""); }}
              onFeedback={setFeedback} onSaved={(message) => { setComposer(null); setEditingSupplierId(""); setFeedback({ kind: "success", text: message }); router.refresh(); }}
            />
          ) : (
            selectedOrder ? <OrderDetail
              order={selectedOrder} pending={pending} onTransition={transition}
              onEdit={() => { setEditingOrderId(selectedOrder.id); showComposer("order"); }}
              onFeedback={setFeedback} onPending={setPending} onReceiptSaved={(message) => { setFeedback({ kind: "success", text: message }); router.refresh(); }}
            /> : <ProcurementWelcome />
          )}

          <SupplierList
            suppliers={props.suppliers}
            onCreate={() => { setEditingSupplierId(""); showComposer("supplier"); }}
            onEdit={(supplierId) => { setEditingSupplierId(supplierId); showComposer("supplier"); }}
          />
        </aside>
      </div>
    </>
  );
}

function ProcurementWelcome() {
  return <div className={styles.detailPanel}><p className={styles.eyebrow}>PEDIDO SELECCIONADO</p><h2>Elige una orden</h2><p className={styles.muted}>El detalle mostrará cantidades pedidas y recibidas, recepciones, movimientos de inventario y errores guardados.</p></div>;
}

function PurchaseOrderComposer({
  order, suppliers, warehouses, stockOptions, pending, onPending, onClose, onFeedback, onSaved,
}: {
  order: ProcurementOrder | null; suppliers: ProcurementSupplier[]; warehouses: ProcurementWarehouse[];
  stockOptions: ProcurementStockOption[]; pending: boolean; onPending: (value: boolean) => void;
  onClose: () => void; onFeedback: (value: Feedback | null) => void; onSaved: (id: string, message: string) => void;
}) {
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? suppliers.find((row) => row.isActive)?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(order?.warehouseId ?? warehouses[0]?.id ?? "");
  const [expectedDelivery, setExpectedDelivery] = useState(order?.expectedDelivery ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [lines, setLines] = useState<OrderLineDraft[]>(order?.lines.map((line) => ({
    variantId: line.variantId, quantity: String(line.orderedQuantity), unitCost: line.unitCost.toFixed(2),
  })) ?? [{ variantId: "", quantity: "1", unitCost: "0.00" }]);
  const availableOptions = useMemo(() => stockOptions.filter((row) => row.warehouseId === warehouseId), [stockOptions, warehouseId]);
  const activeSuppliers = suppliers.filter((row) => row.isActive);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    onPending(true); onFeedback(null);
    const body = {
      supplierId, warehouseId, expectedDelivery, notes,
      lines: lines.map((line) => ({ variantId: line.variantId, quantity: Number(line.quantity), unitCost: line.unitCost })),
    };
    try {
      const response = await fetch(order
        ? `/api/backoffice/procurement/purchase-orders/${order.id}`
        : "/api/backoffice/procurement/purchase-orders", {
        method: order ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; purchaseOrder?: { purchaseOrderId?: string; orderNumber?: string } };
      if (!response.ok || !result.purchaseOrder?.purchaseOrderId) {
        onFeedback({ kind: "error", text: result.error ?? "No se ha podido guardar el pedido." });
        return;
      }
      onSaved(result.purchaseOrder.purchaseOrderId, `${result.purchaseOrder.orderNumber ?? "Pedido"} guardado como borrador.`);
    } catch {
      onFeedback({ kind: "error", text: "No se pudo conectar. Comprueba el pedido antes de volver a guardarlo." });
    } finally { onPending(false); }
  }

  return (
    <section className={styles.composer} aria-labelledby="po-composer-title">
      <div className={styles.composerHeading}><div><p className={styles.eyebrow}>{order ? "EDITAR BORRADOR" : "NUEVO ABASTECIMIENTO"}</p><h2 id="po-composer-title">{order ? `Editar ${order.orderNumber}` : "Preparar pedido"}</h2></div><button className={styles.quietButton} type="button" onClick={onClose}>Cerrar</button></div>
      <p className={styles.muted}>Los borradores se pueden editar. Al confirmarlos, sus líneas quedan bloqueadas para conservar el historial.</p>
      {activeSuppliers.length === 0 && <p className={styles.inlineNotice}>Crea primero un proveedor activo para preparar una orden.</p>}
      {!availableOptions.length && <p className={styles.inlineNotice}>El almacén seleccionado no tiene variantes activas con existencias registradas.</p>}
      <form onSubmit={(event) => void submit(event)} className={styles.form}>
        <label>Proveedor<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Selecciona proveedor</option>{activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.code}</option>)}</select></label>
        <label>Almacén<select required value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setLines([{ variantId: "", quantity: "1", unitCost: "0.00" }]); }}><option value="">Selecciona almacén</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}</select></label>
        <label>Entrega estimada<input type="date" value={expectedDelivery} onChange={(event) => setExpectedDelivery(event.target.value)} /></label>
        <label>Nota interna<textarea value={notes} maxLength={1000} rows={2} onChange={(event) => setNotes(event.target.value)} placeholder="Referencia interna, sin datos reales" /></label>
        <div className={styles.lineEditor}>
          <div className={styles.lineHeading}><strong>Líneas de compra</strong><button className={styles.iconButton} type="button" title="Máximo 100 líneas por pedido" disabled={lines.length >= 100} onClick={() => setLines((current) => [...current, { variantId: "", quantity: "1", unitCost: "0.00" }])}><Plus size={14} aria-hidden="true" /> Añadir línea</button></div>
          {lines.map((line, index) => (
            <div key={index} className={styles.lineRow}>
              <label className={styles.lineVariant}>Producto<select required value={line.variantId} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, variantId: event.target.value } : row))}><option value="">Elige una variante</option>{availableOptions.map((option) => <option key={option.variantId} value={option.variantId}>{stockOptionLabel(option)}</option>)}</select></label>
              <label>Unidades<input required type="number" min="1" max="100000" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></label>
              <label>Coste / ud. €<input required type="number" min="0" max="9999999999.99" step="0.01" value={line.unitCost} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row))} /></label>
              <button className={styles.removeLine} type="button" aria-label={`Eliminar línea ${index + 1}`} title="El pedido debe conservar al menos una línea" disabled={lines.length <= 1} onClick={() => setLines((current) => current.filter((_, rowIndex) => rowIndex !== index))}>×</button>
            </div>
          ))}
        </div>
        <div className={styles.formActions}><button className={styles.primaryButton} type="submit" disabled={pending || activeSuppliers.length === 0 || availableOptions.length === 0}>{pending ? "Guardando…" : order ? "Guardar borrador" : "Crear borrador"}</button><button className={styles.quietButton} type="button" onClick={onClose}>Cancelar</button></div>
      </form>
    </section>
  );
}

function stockOptionLabel(option: ProcurementStockOption) {
  return `${option.productName ?? option.sku ?? `Variante ${option.variantId.slice(0, 8)}`}${option.variantTitle ? ` · ${option.variantTitle}` : ""} · ${option.warehouseCode}`;
}

function SupplierComposer({ supplier, pending, onPending, onClose, onFeedback, onSaved }: {
  supplier: ProcurementSupplier | null; pending: boolean; onPending: (value: boolean) => void;
  onClose: () => void; onFeedback: (value: Feedback | null) => void; onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactEmail, setContactEmail] = useState(supplier?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(supplier?.contactPhone ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    onPending(true); onFeedback(null);
    try {
      const response = await fetch(supplier ? `/api/backoffice/procurement/suppliers/${supplier.id}` : "/api/backoffice/procurement/suppliers", {
        method: supplier ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactEmail, contactPhone, notes, isActive }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { onFeedback({ kind: "error", text: result.error ?? "No se ha podido guardar el proveedor." }); return; }
      onSaved(supplier ? "Proveedor actualizado." : "Proveedor creado.");
    } catch { onFeedback({ kind: "error", text: "No se pudo conectar. Revisa la conexión e inténtalo de nuevo." }); }
    finally { onPending(false); }
  }

  return (
    <section className={styles.composer} aria-labelledby="supplier-composer-title">
      <div className={styles.composerHeading}><div><p className={styles.eyebrow}>MAESTRO DE PROVEEDORES</p><h2 id="supplier-composer-title">{supplier ? "Editar proveedor" : "Añadir proveedor"}</h2></div><button className={styles.quietButton} type="button" onClick={onClose}>Cerrar</button></div>
      <p className={styles.muted}>Usa datos de proveedor ficticios para esta demo. El historial conserva el nombre que tenía al crear cada pedido.</p>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <label>Nombre comercial<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email de contacto<input type="email" maxLength={254} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
        <label>Teléfono<input type="tel" maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
        <label>Notas<textarea maxLength={500} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {supplier && <label className={styles.checkbox}><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Proveedor activo</label>}
        <div className={styles.formActions}><button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar proveedor"}</button><button className={styles.quietButton} type="button" onClick={onClose}>Cancelar</button></div>
      </form>
    </section>
  );
}

function SupplierList({ suppliers, onCreate, onEdit }: {
  suppliers: ProcurementSupplier[]; onCreate: () => void; onEdit: (id: string) => void;
}) {
  return (
    <section className={styles.supplierPanel} aria-labelledby="suppliers-title">
      <div className={styles.panelHeading}>
        <div><p className={styles.eyebrow}>MAESTRO</p><h2 id="suppliers-title"><Building2 size={17} aria-hidden="true" /> Proveedores <span>{formatNumber(suppliers.length)}</span></h2></div>
        <button className={styles.iconButton} type="button" onClick={onCreate}><Plus size={14} aria-hidden="true" /> Añadir</button>
      </div>
      {suppliers.length === 0 ? <p className={styles.supplierEmpty}>Crea un proveedor ficticio para preparar la primera orden.</p> : (
        <ul className={styles.supplierList}>
          {suppliers.map((supplier) => (
            <li key={supplier.id}>
              <div className={styles.supplierIdentity}><span className={`${styles.supplierMark} ${supplier.isActive ? "" : styles.supplierMarkInactive}`}><Building2 size={14} aria-hidden="true" /></span><span><strong>{supplier.name}</strong><small>{supplier.code} · {supplier.isActive ? "Activo" : "Archivado"}</small></span></div>
              <button className={styles.iconButton} type="button" aria-label={`Editar ${supplier.name}`} onClick={() => onEdit(supplier.id)}><Pencil size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OrderDetail({ order, pending, onTransition, onEdit, onFeedback, onPending, onReceiptSaved }: {
  order: ProcurementOrder; pending: boolean;
  onTransition: (order: ProcurementOrder, action: "place" | "cancel") => void;
  onEdit: () => void; onFeedback: (value: Feedback | null) => void;
  onPending: (value: boolean) => void; onReceiptSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const fallbackIdempotencyKey = useRef<string | null>(null);
  const storageKey = `nodria:procurement:receipt:${order.id}`;
  const canReceive = ["ordered", "partially_received"].includes(order.status);

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const receiptLines = order.lines.map((line) => ({ lineId: line.id, quantity: Number(quantities[line.id] ?? 0) }))
      .filter((line) => line.quantity > 0);
    if (!receiptLines.length) { onFeedback({ kind: "error", text: "Indica al menos una cantidad que haya llegado." }); return; }
    const idempotencyKey = ensureReceiptKey();
    onPending(true); onFeedback(null);
    try {
      const response = await fetch(`/api/backoffice/procurement/purchase-orders/${order.id}/receipts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierReference: reference, idempotencyKey, lines: receiptLines }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string; receipt?: { receiptId?: string; replayed?: boolean; errorCode?: string | null };
      };
      if (!response.ok || !result.receipt) {
        onFeedback({ kind: "error", text: result.error ?? "No se ha podido registrar la recepción." });
        if (result.receipt) rotateKey();
        return;
      }
      rotateKey();
      setReference(""); setQuantities({});
      onReceiptSaved(result.receipt.replayed ? `La recepción de ${order.orderNumber} ya estaba registrada.` : `Recepción guardada en ${order.orderNumber}; el stock y su ledger se actualizaron juntos.`);
      router.refresh();
    } catch {
      onFeedback({ kind: "error", text: "No se pudo confirmar la respuesta. Reintenta con los mismos datos para consultar el resultado sin duplicar unidades." });
    } finally { onPending(false); }
  }

  function rotateKey() {
    const nextKey = crypto.randomUUID();
    fallbackIdempotencyKey.current = nextKey;
    try { window.sessionStorage.setItem(storageKey, nextKey); } catch { /* Keep the key for this mounted order form. */ }
  }

  function ensureReceiptKey() {
    try {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) { fallbackIdempotencyKey.current = existing; return existing; }
    } catch { /* Storage can be disabled by browser policy. */ }
    const nextKey = fallbackIdempotencyKey.current ?? crypto.randomUUID();
    fallbackIdempotencyKey.current = nextKey;
    try { window.sessionStorage.setItem(storageKey, nextKey); } catch { /* The in-memory key still protects retries until navigation. */ }
    return nextKey;
  }

  return (
    <section className={styles.detailPanel} aria-labelledby="order-detail-title">
      <div className={styles.detailHeading}>
        <div><p className={styles.eyebrow}>PEDIDO SELECCIONADO</p><h2 id="order-detail-title">{order.orderNumber}</h2><p className={styles.muted}>{order.supplierName} · {order.warehouseName}</p></div>
        <OrderStatus status={order.status} />
      </div>
      <div className={styles.detailFacts}><span><small>Creado</small><strong>{formatDate(order.createdAt)}</strong></span><span><small>Entrega estimada</small><strong>{formatDate(order.expectedDelivery)}</strong></span><span><small>Coste pedido</small><strong>{formatMoney(orderValue(order))}</strong></span></div>
      {order.notes && <p className={styles.orderNotes}>{order.notes}</p>}
      <div className={styles.linesTableWrap}>
        <table className={styles.linesTable}><thead><tr><th>Variante</th><th>Pedido</th><th>Recibido</th><th>Pendiente</th><th>Coste</th></tr></thead><tbody>
          {order.lines.map((line) => <tr key={line.id}><td><strong>{line.productName}</strong><small>{line.sku} · {line.variantTitle}</small></td><td>{formatNumber(line.orderedQuantity)}</td><td>{formatNumber(line.receivedQuantity)}</td><td className={line.orderedQuantity > line.receivedQuantity ? styles.pendingValue : ""}>{formatNumber(line.orderedQuantity - line.receivedQuantity)}</td><td>{formatMoney(line.unitCost)}</td></tr>)}
        </tbody></table>
      </div>
      <div className={styles.orderActions}>
        {order.status === "draft" && <><button className={styles.secondaryButton} type="button" onClick={onEdit}><Pencil size={14} aria-hidden="true" /> Editar borrador</button><button className={styles.primaryButton} type="button" disabled={pending} onClick={() => onTransition(order, "place")}><Send size={14} aria-hidden="true" /> {pending ? "Guardando…" : "Confirmar pedido"}</button></>}
        {["ordered", "partially_received"].includes(order.status) && <button className={styles.cancelButton} type="button" disabled={pending} onClick={() => onTransition(order, "cancel")}><Ban size={14} aria-hidden="true" /> Cancelar pendiente</button>}
        {order.status === "cancelled" && <span className={styles.muted}>El pedido quedó cancelado; las unidades ya recibidas permanecen en stock.</span>}
      </div>

      {canReceive && (
        <div className={styles.receiptPanel}>
          <div className={styles.receiptHeading}><div><p className={styles.eyebrow}>MUELLE DE RECEPCIÓN</p><h3><ArrowDownToLine size={15} aria-hidden="true" /> Registrar llegada</h3></div><span className={styles.ledgerBadge}><PackageCheck size={13} aria-hidden="true" /> MOVIMIENTO IDEMPOTENTE</span></div>
          <p className={styles.muted}>Solo se suman unidades pendientes. El intento, el albarán y los movimientos quedan vinculados al pedido.</p>
          {order.lines.every((line) => line.orderedQuantity === line.receivedQuantity) ? <p className={styles.inlineNotice}>No quedan unidades pendientes de esta orden.</p> : (
            <form className={styles.receiptForm} onSubmit={(event) => void submitReceipt(event)}>
              <label>Albarán / referencia<input required minLength={1} maxLength={80} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="ALB-DEMO-001" /></label>
              <div className={styles.receiptLines}>
                {order.lines.filter((line) => line.orderedQuantity > line.receivedQuantity).map((line) => (
                  <label className={styles.receiptLine} key={line.id}><span><strong>{line.productName}</strong><small>{line.sku} · quedan {formatNumber(line.orderedQuantity - line.receivedQuantity)}</small></span><input type="number" min="0" max={line.orderedQuantity - line.receivedQuantity} step="1" value={quantities[line.id] ?? "0"} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} aria-label={`Unidades recibidas de ${line.sku}`} /></label>
                ))}
              </div>
              <button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? "Aplicando stock…" : "Confirmar recepción"}</button>
            </form>
          )}
        </div>
      )}

      <ProcurementHistory order={order} />
    </section>
  );
}

function ProcurementHistory({ order }: { order: ProcurementOrder }) {
  const lineById = new Map(order.lines.map((line) => [line.id, line]));
  const history = [
    ...order.events.map((event) => ({ kind: "event" as const, createdAt: event.createdAt, event })),
    ...order.receipts.map((receipt) => ({ kind: "receipt" as const, createdAt: receipt.createdAt, receipt })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className={styles.history} aria-labelledby="procurement-history-title">
      <div className={styles.historyHeading}><h3 id="procurement-history-title"><History size={15} aria-hidden="true" /> Historial persistido</h3><span>{formatNumber(order.receipts.length)} intentos</span></div>
      {history.length === 0 ? <p className={styles.historyEmpty}>El historial de estado y recepciones aparecerá aquí.</p> : (
        <ol className={styles.timeline}>
          {history.map((item) => item.kind === "event"
            ? <EventHistoryItem event={item.event} key={`event-${item.event.id}`} />
            : <ReceiptHistoryItem receipt={item.receipt} lineById={lineById} key={`receipt-${item.receipt.id}`} />)}
        </ol>
      )}
    </section>
  );
}

function EventHistoryItem({ event }: { event: ProcurementEvent }) {
  const isProblem = event.eventType.includes("rejected") || event.eventType.includes("failed");
  return (
    <li className={isProblem ? styles.timelineError : ""}>
      <span className={styles.timelineDot} aria-hidden="true" />
      <div><strong><EventTitle event={event} /></strong><small>{formatDateTime(event.createdAt)}{event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus ? ` · ${STATUS_LABELS[event.fromStatus] ?? event.fromStatus} → ${STATUS_LABELS[event.toStatus] ?? event.toStatus}` : ""}</small>
        {typeof event.details.errorCode === "string" && <p>{RECEIPT_ERRORS[event.details.errorCode] ?? "El estado no permitió completar la operación."}</p>}
      </div>
    </li>
  );
}

function ReceiptHistoryItem({ receipt, lineById }: { receipt: ProcurementReceipt; lineById: Map<string, ProcurementOrder["lines"][number]> }) {
  const requested = Array.isArray(receipt.requestedLines) ? receipt.requestedLines as Array<{ lineId?: string; quantity?: number }> : [];
  const isProblem = receipt.status === "failed" || receipt.status === "rejected";
  const summary = receipt.lines.length
    ? receipt.lines.map((line) => `${formatNumber(line.quantity)} × ${lineById.get(line.purchaseOrderLineId)?.sku ?? "variante"}`).join(" · ")
    : requested.map((line) => `${formatNumber(Number(line.quantity) || 0)} × ${lineById.get(String(line.lineId))?.sku ?? "línea"}`).join(" · ");
  return (
    <li className={isProblem ? styles.timelineError : ""}>
      <span className={styles.timelineDot} aria-hidden="true" />
      <div><strong>{isProblem ? "Recepción rechazada" : receipt.status === "received" ? "Recepción aplicada" : "Recepción en curso"}</strong><small>{formatDateTime(receipt.createdAt)} · Albarán {receipt.supplierReference}</small>
        {summary && <p>{summary}</p>}
        {receipt.errorCode && <p>{RECEIPT_ERRORS[receipt.errorCode] ?? "La operación no se completó; no se aplicaron unidades."}</p>}
        {receipt.lines.map((line) => <small className={styles.ledgerLine} key={line.id}>Movimiento #{line.inventoryMovementId} vinculado al ledger</small>)}
      </div>
    </li>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
  }).format(date);
}
