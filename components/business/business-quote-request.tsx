"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { requestBusinessQuote } from "@/app/(store)/empresas/portal/actions";
import styles from "./business-quote-request.module.css";

export type BusinessProductOption = {
  id: string;
  productName: string;
  brand: string;
  sku: string;
  variantTitle: string;
  currentPrice: number;
  currency: string;
};

type QuoteLine = { id: number; variantId: string; quantity: number };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
}

export function BusinessQuoteRequest({
  organizationId,
  products,
}: {
  organizationId: string;
  products: BusinessProductOption[];
}) {
  const [lines, setLines] = useState<QuoteLine[]>(() => products[0] ? [{ id: 1, variantId: products[0].id, quantity: 1 }] : []);
  const [nextId, setNextId] = useState(2);
  const selectedProducts = lines.map((line) => products.find((product) => product.id === line.variantId)).filter(Boolean) as BusinessProductOption[];
  const currency = selectedProducts[0]?.currency ?? "EUR";
  const estimate = selectedProducts.reduce((total, product, index) => total + product.currentPrice * (lines[index]?.quantity ?? 0), 0);
  const allSameCurrency = selectedProducts.every((product) => product.currency === currency);

  function updateLine(id: number, patch: Partial<QuoteLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function addLine() {
    const available = products.find((product) => !lines.some((line) => line.variantId === product.id));
    if (!available) return;
    setLines((current) => [...current, { id: nextId, variantId: available.id, quantity: 1 }]);
    setNextId((current) => current + 1);
  }

  if (!products.length) {
    return (
      <p className={styles.empty}>
        El catálogo conectado no ofrece productos disponibles para cotizar ahora. Puedes enviar una consulta de proyecto desde <Link href="/empresas#solicitar">el formulario de contacto</Link>.
      </p>
    );
  }

  return (
    <form action={requestBusinessQuote} className={styles.form}>
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="lines" type="hidden" value={JSON.stringify(lines.map(({ variantId, quantity }) => ({ variantId, quantity })))} />
      <div className={styles.lines}>
        {lines.map((line, index) => {
          const selected = products.find((product) => product.id === line.variantId) ?? products[0];
          return (
            <div className={styles.line} key={line.id}>
              <div className={styles.lineTop}>
                <span className={styles.lineNumber}>{String(index + 1).padStart(2, "0")}</span>
                <label className={styles.productField}>
                  <span>Producto / variante</span>
                  <select value={line.variantId} onChange={(event) => updateLine(line.id, { variantId: event.target.value })}>
                    {products.map((product) => (
                      <option disabled={product.id !== line.variantId && lines.some((other) => other.id !== line.id && other.variantId === product.id)} key={product.id} value={product.id}>
                        {product.brand} · {product.productName} · {product.variantTitle} ({product.sku})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.quantityField}>
                  <span>Unidades</span>
                  <input max={10000} min={1} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} type="number" value={line.quantity} />
                </label>
                <button aria-label={`Quitar línea ${index + 1}`} className={styles.removeLine} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} type="button">
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </div>
              <div className={styles.lineFoot}>
                <span>{selected.sku} · precio de catálogo de referencia</span>
                <strong>{money(selected.currentPrice, selected.currency)}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <button className={styles.addLine} disabled={lines.length >= 30 || lines.length >= products.length} onClick={addLine} type="button">
        <Plus aria-hidden="true" size={15} /> Añadir producto
      </button>

      <label className={styles.noteField}>
        <span>Contexto del proyecto <small>(opcional)</small></span>
        <textarea maxLength={2000} name="requestNote" placeholder="Calendario, uso previsto o requisitos que ayuden a preparar la propuesta." rows={3} />
      </label>

      <div className={styles.submitRow}>
        <div className={styles.estimate}>
          <span>Referencia de catálogo · IVA incluido</span>
          <strong>{allSameCurrency ? money(estimate, currency) : "Monedas mixtas"}</strong>
        </div>
        <button className={styles.submitButton} disabled={!lines.length || !allSameCurrency || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1)} type="submit">
          Enviar a ventas <ArrowRight aria-hidden="true" size={15} />
        </button>
      </div>
      <p className={styles.helper}>La referencia usa precios actuales del catálogo. El equipo comercial revisará la disponibilidad y guardará una oferta con precios propios antes de enviarla.</p>
    </form>
  );
}
