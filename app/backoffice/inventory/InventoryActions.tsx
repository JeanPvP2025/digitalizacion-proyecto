"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, RefreshCw } from "lucide-react";
import type { InventoryRow } from "@/lib/inventory";
import styles from "./inventory.module.css";

type StockOption = Pick<InventoryRow,
  "warehouseId" | "warehouseCode" | "warehouseName" | "variantId" | "sku" | "variantTitle" | "productName" | "onHand" | "reserved"
>;

type MutationResult = { movement: { on_hand: number; reserved: number; replayed: boolean } };

function stockOptionLabel(row: StockOption) {
  const product = row.productName ?? row.sku ?? `Referencia ${row.variantId.slice(0, 8)}`;
  return `${product}${row.variantTitle ? ` · ${row.variantTitle}` : ""} · ${row.warehouseCode} (${row.warehouseName})`;
}

export function InventoryActions({ rows }: { rows: StockOption[] }) {
  const router = useRouter();
  const keys = useRef({ receipt: crypto.randomUUID(), adjustment: crypto.randomUUID() });
  const [pending, setPending] = useState<"receipt" | "adjustment" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(type: "receipt" | "adjustment", form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (pending) return;
    const htmlForm = form.currentTarget;
    const values = new FormData(htmlForm);
    const common = {
      type,
      warehouseId: String(values.get("stock") ?? "").split(":")[0],
      variantId: String(values.get("stock") ?? "").split(":")[1],
      idempotencyKey: keys.current[type],
    };
    const payload = type === "receipt"
      ? { ...common, quantity: Number(values.get("quantity")), supplierName: values.get("supplierName"), supplierReference: values.get("supplierReference") }
      : { ...common, delta: Number(values.get("delta")), reason: values.get("reason") };

    setPending(type);
    setFeedback(null);
    try {
      const response = await fetch("/api/backoffice/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as MutationResult | { error?: string };
      if (!response.ok || !("movement" in result)) {
        setFeedback({ kind: "error", text: "error" in result && result.error ? result.error : "No se ha podido guardar el movimiento. Puedes reintentar sin cambiar los datos." });
        return;
      }

      const movement = result.movement;
      const available = movement.on_hand - movement.reserved;
      setFeedback({
        kind: "success",
        text: `${movement.replayed ? "Movimiento ya registrado." : "Movimiento registrado."} Físico ${movement.on_hand}, reservado ${movement.reserved}, disponible ${available}.`,
      });
      keys.current[type] = crypto.randomUUID();
      htmlForm.reset();
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "No se pudo conectar. Reintenta con los mismos datos; se conservará la clave idempotente." });
    } finally {
      setPending(null);
    }
  }

  const options = rows.map((row) => <option key={`${row.warehouseId}:${row.variantId}`} value={`${row.warehouseId}:${row.variantId}`}>{stockOptionLabel(row)}</option>);

  return (
    <section className={styles.actionsPanel} aria-labelledby="inventory-actions-title">
      <div className={styles.panelHeading}>
        <div><p className={styles.panelEyebrow}>ACCIONES AUTORIZADAS</p><h2 id="inventory-actions-title">Recibir y ajustar stock</h2></div>
        <span className={styles.sourceBadge}>RPC · LEDGER IDEMPOTENTE</span>
      </div>
      <p className={styles.actionIntro}>Cada operación actualiza el físico y el ledger en una transacción. Las reservas activas se conservan; un ajuste negativo no puede consumirlas.</p>
      {feedback && <p className={feedback.kind === "success" ? styles.actionSuccess : styles.actionError} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</p>}
      {rows.length === 0 ? <p className={styles.actionEmpty}>No hay referencias de stock para recibir o ajustar.</p> : (
        <div className={styles.actionForms}>
          <form className={styles.actionForm} onSubmit={(event) => void submit("receipt", event)}>
            <h3><ArrowDownToLine size={16} aria-hidden="true" /> Recepción de proveedor</h3>
            <label>Referencia de stock<select name="stock" required defaultValue="">{<option value="" disabled>Elige variante y almacén</option>}{options}</select></label>
            <div className={styles.formPair}>
              <label>Unidades<input name="quantity" type="number" min="1" max="100000" required /></label>
              <label>Proveedor<input name="supplierName" minLength={2} maxLength={120} required /></label>
            </div>
            <label>Albarán / referencia<input name="supplierReference" minLength={1} maxLength={80} required /></label>
            <button type="submit" disabled={pending !== null}>{pending === "receipt" ? "Guardando recepción…" : "Registrar recepción"}</button>
          </form>
          <form className={styles.actionForm} onSubmit={(event) => void submit("adjustment", event)}>
            <h3><RefreshCw size={16} aria-hidden="true" /> Ajuste autorizado</h3>
            <label>Referencia de stock<select name="stock" required defaultValue="">{<option value="" disabled>Elige variante y almacén</option>}{options}</select></label>
            <label>Variación de unidades<input name="delta" type="number" min="-100000" max="100000" required /></label>
            <label>Motivo del ajuste<input name="reason" minLength={3} maxLength={500} required /></label>
            <button type="submit" disabled={pending !== null}>{pending === "adjustment" ? "Guardando ajuste…" : "Registrar ajuste"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
