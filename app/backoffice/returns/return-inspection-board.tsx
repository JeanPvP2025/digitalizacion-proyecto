"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, PackageCheck, RefreshCw, Trash2 } from "lucide-react";
import type { ReturnInspectionWorkspace } from "@/lib/inventory/returns";
import styles from "./returns.module.css";

type Props = Extract<ReturnInspectionWorkspace, { status: "ready" }>;
type Draft = { warehouseId: string; disposition: "restocked" | "disposed"; reason: string };
type KeyDraft = { fingerprint: string; key: string };

export function ReturnInspectionBoard({ cases, warehouses }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const keys = useRef(new Map<string, KeyDraft>());
  const pending = cases.flatMap((request) => request.items.map((item) => ({ request, item })))
    .filter(({ item }) => !completed.includes(item.id));

  function draftFor(itemId: string, variantId: string | null): Draft {
    return drafts[itemId] ?? {
      warehouseId: warehouses[0]?.id ?? "",
      disposition: variantId ? "restocked" : "disposed",
      reason: "",
    };
  }

  async function inspect(returnRequestId: string, itemId: string, quantity: number, variantId: string | null) {
    const draft = draftFor(itemId, variantId);
    if (!draft.warehouseId) { setError("Selecciona el almacén donde recibiste la devolución."); return; }
    if (draft.disposition === "restocked" && !variantId) { setError("Esta línea histórica no tiene una variante vendible para reponer."); return; }
    if (draft.reason.trim().length < 10) { setError("Explica la inspección con al menos 10 caracteres."); return; }

    const payload = {
      returnRequestId,
      returnItemId: itemId,
      warehouseId: draft.warehouseId,
      disposition: draft.disposition,
      quantity,
      reason: draft.reason.trim(),
    };
    const fingerprint = JSON.stringify(payload);
    const oldKey = keys.current.get(itemId);
    const idempotencyKey = oldKey?.fingerprint === fingerprint ? oldKey.key : crypto.randomUUID();
    keys.current.set(itemId, { fingerprint, key: idempotencyKey });

    setBusyId(itemId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/backoffice/returns/inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey }),
      });
      const body = await response.json() as { error?: string; inspection?: { replayed: boolean } };
      if (!response.ok || !body.inspection) throw new Error(body.error ?? "No se pudo registrar la inspección.");
      keys.current.delete(itemId);
      setCompleted((current) => [...current, itemId]);
      setNotice(body.inspection.replayed
        ? "La inspección ya estaba registrada; no se duplicó ningún movimiento."
        : draft.disposition === "restocked"
          ? `${quantity} unidades repuestas en el inventario del almacén seleccionado.`
          : `${quantity} unidades registradas como no aptas para reventa; no se añadió stock.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la inspección.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className={styles.queue} aria-labelledby="inspection-queue-title">
      <div className={styles.queueHeading}>
        <div><p className={styles.eyebrow}>PENDIENTES DE ALMACÉN</p><h2 id="inspection-queue-title">Devoluciones recibidas</h2></div>
        <button className={styles.refresh} type="button" onClick={() => router.refresh()} disabled={busyId !== ""}>
          <RefreshCw size={14} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {warehouses.length === 0 && <p className={styles.error} role="alert">No hay almacenes activos para registrar la inspección.</p>}
      {pending.length === 0 ? <p className={styles.empty}>No hay unidades pendientes de inspección.</p> : (
        <div className={styles.list}>
          {pending.map(({ request, item }) => {
            const draft = draftFor(item.id, item.variantId);
            return (
              <article className={styles.card} key={item.id}>
                <div className={styles.cardTop}>
                  <div><code>{request.returnNumber}</code><p>Pedido {request.orderNumber} · {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(request.requestedAt))}</p></div>
                  <span>{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}</span>
                </div>
                <h3>{item.productName}</h3>
                <p className={styles.productMeta}>{item.sku} · {item.variantTitle}</p>
                <p className={styles.rule}>La cantidad no se puede ampliar ni reducir: coincide con las unidades aprobadas y aún pendientes. La acción registra una sola disposición.</p>
                <div className={styles.fields}>
                  <label>Almacén de recepción
                    <select value={draft.warehouseId} disabled={!warehouses.length || busyId === item.id} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, warehouseId: event.target.value } }))}>
                      {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code} · {warehouse.city}</option>)}
                    </select>
                  </label>
                  <label>Resultado de inspección
                    <select value={draft.disposition} disabled={busyId === item.id} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, disposition: event.target.value as Draft["disposition"] } }))}>
                      {item.variantId && <option value="restocked">Apta: reponer stock</option>}
                      <option value="disposed">No apta: desechar sin reponer</option>
                    </select>
                  </label>
                  <label className={styles.reason}>Hallazgo de inspección
                    <textarea value={draft.reason} minLength={10} maxLength={500} rows={3} required disabled={busyId === item.id} placeholder="Describe el estado físico comprobado…" onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, reason: event.target.value } }))} />
                  </label>
                </div>
                <button className={styles.submit} type="button" disabled={busyId === item.id || !warehouses.length || draft.reason.trim().length < 10} onClick={() => void inspect(request.id, item.id, item.quantity, item.variantId)}>
                  {busyId === item.id ? <LoaderCircle className="spin-icon" size={15} aria-hidden="true" /> : draft.disposition === "restocked" ? <PackageCheck size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                  {busyId === item.id ? "Guardando inspección…" : draft.disposition === "restocked" ? "Registrar inspección y reponer" : "Registrar inspección y desechar"}
                  {busyId !== item.id && <Check size={14} aria-hidden="true" />}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
