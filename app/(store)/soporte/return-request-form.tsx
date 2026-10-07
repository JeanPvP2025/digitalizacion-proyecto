"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, PackageCheck, RotateCcw } from "lucide-react";

type ReturnableItem = {
  id: string;
  name: string;
  sku: string;
  variant: string;
  orderedQuantity: number;
  availableQuantity: number;
};

type ReturnDraft = { orderNumber: string; reason: string; items: Array<{ orderItemId: string; quantity: number }> };

export function ReturnRequestForm({ connected, authenticated }: { connected: boolean; authenticated: boolean }) {
  const [orderNumber, setOrderNumber] = useState("");
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);

  async function loadOrder() {
    setLoadingOrder(true);
    setError("");
    setConfirmation("");
    setItems([]);
    setQuantities({});
    try {
      const response = await fetch(`/api/support/returns?orderNumber=${encodeURIComponent(orderNumber.trim())}`, { cache: "no-store" });
      const body = await response.json() as { items?: ReturnableItem[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo consultar el pedido.");
      setItems(body.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar el pedido.");
    } finally {
      setLoadingOrder(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const selectedItems = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    const draft: ReturnDraft = { orderNumber: orderNumber.trim(), reason: reason.trim(), items: selectedItems };
    const fingerprint = JSON.stringify(draft);
    if (!idempotency.current || idempotency.current.fingerprint !== fingerprint) {
      idempotency.current = { fingerprint, key: crypto.randomUUID() };
    }

    try {
      const response = await fetch("/api/support/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, idempotencyKey: idempotency.current.key }),
      });
      const body = await response.json() as { persisted?: boolean; returnNumber?: string; error?: string };
      if (!response.ok || !body.persisted || !body.returnNumber) throw new Error(body.error ?? "No se confirmó la devolución.");
      setConfirmation(body.returnNumber);
      idempotency.current = null;
      setItems([]);
      setQuantities({});
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la devolución.");
    } finally {
      setBusy(false);
    }
  }

  if (!connected) {
    return <div className="support-empty-state" style={{ marginTop: "1rem" }}><p>Las devoluciones necesitan pedidos conectados a una cuenta. La demo local no guarda pedidos reales ni procesa una devolución.</p></div>;
  }
  if (!authenticated) {
    return <div className="support-empty-state" style={{ marginTop: "1rem" }}><p>Inicia sesión con la cuenta que realizó la compra para consultar las unidades elegibles.</p><Link className="button button--dark" href="/acceso?next=%2Fsoporte">Iniciar sesión <ArrowRight size={14} /></Link></div>;
  }
  if (confirmation) {
    return <div className="support-success" role="status"><span className="confirmation-mark"><PackageCheck size={23} /></span><p className="eyebrow">DEVOLUCIÓN REGISTRADA</p><h3>Hemos recibido tu solicitud.</h3><p>Referencia: <code>{confirmation}</code></p><p>La solicitud se registró con el motivo y las unidades seleccionadas. El equipo revisará los siguientes pasos.</p><button className="text-button" type="button" onClick={() => setConfirmation("")}>Consultar otro pedido</button></div>;
  }

  return (
    <div className="support-form">
      <div className="field">
        <label htmlFor="return-order-number">Número de pedido</label>
        <div className="return-order-lookup" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}><input id="return-order-number" style={{ flex: "1 1 14rem" }} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} maxLength={40} placeholder="NDR-2026-000000" /><button className="button button--dark" type="button" onClick={loadOrder} disabled={loadingOrder || !orderNumber.trim()}>{loadingOrder ? <LoaderCircle className="spin-icon" size={15} /> : <PackageCheck size={15} />}{loadingOrder ? "Consultando…" : "Consultar pedido"}</button></div>
      </div>
      {items.length > 0 && <form className="return-request-fields" style={{ display: "grid", gap: "1rem", marginTop: "1.25rem" }} onSubmit={submit}>
        <div className="field field--wide"><span className="form-label">Unidades que quieres devolver</span><div className="return-item-list" style={{ display: "grid", gap: "0.75rem" }}>{items.map((item) => <label className="return-item" key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.75rem 0", borderBottom: "1px solid var(--line, #d7ddd6)" }}><span><strong>{item.name}</strong><small style={{ display: "block" }}>{item.sku} · {item.variant} · compradas: {item.orderedQuantity}, disponibles para devolución: {item.availableQuantity}</small></span><input style={{ width: "5rem" }} aria-label={`Unidades a devolver de ${item.name}`} type="number" min={0} max={item.availableQuantity} value={quantities[item.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.min(item.availableQuantity, Math.max(0, Number(event.target.value) || 0)) }))} /></label>)}</div></div>
        <div className="field field--wide"><label htmlFor="return-reason">Motivo de la devolución</label><textarea id="return-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={2000} rows={4} required placeholder="Describe el motivo de la solicitud…" /></div>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        <button className="button button--dark" type="submit" disabled={busy || reason.trim().length < 10 || !selectedQuantity(quantities)}>{busy ? <LoaderCircle className="spin-icon" size={15} /> : <RotateCcw size={15} />}{busy ? "Registrando solicitud…" : "Solicitar devolución"}<ArrowRight size={14} /></button>
        <p className="form-demo-note">Puedes solicitar la devolución hasta 30 días después de la entrega. El servidor vuelve a comprobar el plazo y las unidades antes de registrar.</p>
      </form>}
      {!items.length && !error && <p className="support-empty-state" style={{ marginTop: "1rem" }}>Indica un número de pedido para consultar su elegibilidad y las unidades disponibles.</p>}
      {!items.length && error && <p className="checkout-error" role="alert">{error}</p>}
    </div>
  );
}

function selectedQuantity(quantities: Record<string, number>) {
  return Object.values(quantities).some((quantity) => quantity > 0);
}
