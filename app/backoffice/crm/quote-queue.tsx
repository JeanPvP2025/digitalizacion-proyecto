"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock3, PackageCheck } from "lucide-react";
import { claimBusinessQuote, sendBusinessQuote } from "@/app/backoffice/crm/actions";
import styles from "./quote-queue.module.css";

export type SalesQuoteLine = {
  id: string;
  productName: string;
  sku: string;
  variantTitle: string;
  quantity: number;
  requestedUnitPrice: number;
  offeredUnitPrice: number | null;
  currency: string;
};

export type SalesQuote = {
  id: string;
  number: string;
  status: "requested" | "in_review";
  organizationName: string;
  requesterName: string;
  requesterEmail: string;
  requestNote: string;
  createdAt: string;
  salesOwnerId: string | null;
  lines: SalesQuoteLine[];
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value));
}

function OfferForm({ quote }: { quote: SalesQuote }) {
  const [prices, setPrices] = useState(() => quote.lines.map((line) => line.offeredUnitPrice ?? line.requestedUnitPrice));
  const total = quote.lines.reduce((sum, line, index) => sum + line.quantity * (prices[index] || 0), 0);
  const currency = quote.lines[0]?.currency ?? "EUR";
  const valid = prices.length > 0 && prices.every((price) => Number.isFinite(price) && price >= 0 && price <= 100000000);

  return (
    <form action={sendBusinessQuote} className={styles.offerForm}>
      <input name="quoteId" type="hidden" value={quote.id} />
      <input name="offer" type="hidden" value={JSON.stringify(quote.lines.map((line, index) => ({ quote_item_id: line.id, unit_price: prices[index] })))} />
      <div className={styles.offerHeading}><span>PRECIO UNITARIO · IVA INCLUIDO</span><label>Validez <select defaultValue="14" name="validityDays"><option value="7">7 días</option><option value="14">14 días</option><option value="30">30 días</option><option value="60">60 días</option><option value="90">90 días</option></select></label></div>
      <div className={styles.offerLines}>{quote.lines.map((line, index) => <label className={styles.offerLine} key={line.id}>
        <span><strong>{line.quantity} × {line.productName}</strong><small>{line.variantTitle} · {line.sku} · catálogo {money(line.requestedUnitPrice, line.currency)}</small></span>
        <span className={styles.priceField}><input aria-label={`Oferta por unidad para ${line.productName}`} inputMode="decimal" max="100000000" min="0" onChange={(event) => setPrices((current) => current.map((value, position) => position === index ? Number(event.target.value) : value))} required step="0.01" type="number" value={prices[index]} /><small>{line.currency} / unidad</small></span>
      </label>)}</div>
      <div className={styles.offerSubmit}><span>Total con IVA<strong>{money(total, currency)}</strong></span><button disabled={!valid} type="submit">Publicar en el portal <ArrowRight size={14} /></button></div>
    </form>
  );
}

export function QuoteQueue({ quotes, currentUserId }: { quotes: SalesQuote[]; currentUserId: string }) {
  if (!quotes.length) return <div className={styles.empty}><PackageCheck size={18} /><strong>La cola está al día</strong><span>Las solicitudes nuevas de organizaciones aparecerán aquí.</span></div>;

  return <div className={styles.queue}>{quotes.map((quote) => {
    const claimedByMe = quote.salesOwnerId === currentUserId;
    const assignedElsewhere = quote.salesOwnerId !== null && !claimedByMe;
    return <article className={styles.card} key={quote.id}>
      <div className={styles.cardTop}><div><span className={styles.number}>{quote.number}</span><h3>{quote.organizationName}</h3></div><span className={claimedByMe ? styles.owned : styles.unassigned}><i />{claimedByMe ? "Asignada a ti" : assignedElsewhere ? "Asignada a otro agente" : "Sin asignar"}</span></div>
      <div className={styles.contact}><strong>{quote.requesterName}</strong><a href={`mailto:${quote.requesterEmail}`}>{quote.requesterEmail}</a><span><Clock3 size={12} />{timestamp(quote.createdAt)}</span></div>
      {quote.requestNote && <p className={styles.note}>{quote.requestNote}</p>}
      <ul className={styles.requestLines}>{quote.lines.map((line) => <li key={line.id}><span>{line.quantity} × {line.productName}<small>{line.variantTitle} · {line.sku}</small></span><strong>{money(line.requestedUnitPrice, line.currency)}</strong></li>)}</ul>
      {claimedByMe ? <OfferForm quote={quote} /> : assignedElsewhere ? <p className={styles.assignedNote}>Esta solicitud pertenece a otra persona del equipo comercial.</p> : <form action={claimBusinessQuote} className={styles.claimForm}><input name="quoteId" type="hidden" value={quote.id} /><span>Asume la solicitud para preparar una oferta trazable.</span><button type="submit"><Check size={14} /> Asignarme</button></form>}
    </article>;
  })}</div>;
}
