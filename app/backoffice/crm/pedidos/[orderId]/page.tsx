import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, PackageCheck, PackageOpen, ReceiptText } from "lucide-react";
import { getCrmOrderDetail } from "@/lib/crm/orders";
import { CrmOrderStatus, crmDate, crmMoney } from "../../crm-order-status";
import { CrmRouteState } from "../../crm-route-state";
import { CrmSectionNav } from "../../crm-section-nav";
import styles from "../../crm-workspace.module.css";

type Params = Promise<{ orderId: string }>;

const eventLabels: Record<string, string> = {
  order_created: "Pedido creado",
  business_order_created: "Pedido empresarial emitido",
  payment_paid: "Pago aprobado",
  payment_failed: "Pago rechazado",
  payment_processing: "Pago en proceso",
  payment_temporary_error: "Error temporal de pago",
  order_picking_started: "Preparación iniciada",
  order_packed: "Pedido empaquetado",
  order_shipped: "Pedido expedido",
  order_delivered: "Pedido entregado",
  business_advance_paid: "Anticipo empresarial aprobado",
  business_advance_declined: "Anticipo empresarial rechazado",
};

function eventLabel(key: string) {
  return eventLabels[key] ?? key.replaceAll("_", " ").replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("es-ES"));
}

export default async function CrmOrderDetailPage({ params }: { params: Params }) {
  const { orderId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) notFound();

  const result = await getCrmOrderDetail(orderId);
  if (result.state === "not-found") notFound();
  if (result.state !== "ready") return <CrmRouteState state={result.state} title="Detalle del pedido" />;

  const { order } = result;
  const totals = [
    { label: "Subtotal", amount: order.subtotal },
    { label: "Impuestos", amount: order.tax_total },
    { label: "Envío", amount: order.shipping_total },
    { label: "Descuento", amount: -order.discount_total },
  ];

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/backoffice/crm/pedidos"><ArrowLeft size={13} /> Todos los pedidos</Link>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>NODRIA · CRM · PEDIDO</p><h1>{order.order_number}</h1><p>Pedido del <Link href={`/backoffice/crm/clientes/${order.customer_id}`}>{order.customer_name}</Link> · {order.customer_email} · {crmDate(order.placed_at)}</p></div>
        <Link className={styles.headingAction} href="/backoffice"><PackageCheck size={14} /> Operaciones de pedido</Link>
      </div>
      <CrmSectionNav active="orders" />

      <section className={styles.facts} aria-label="Estados del pedido">
        <article className={styles.fact}><span>ESTADO DEL PEDIDO</span><strong><CrmOrderStatus kind="order" value={order.order_status} /></strong></article>
        <article className={styles.fact}><span>ESTADO DEL PAGO</span><strong><CrmOrderStatus kind="payment" value={order.payment_status} /></strong></article>
        <article className={styles.fact}><span>PREPARACIÓN</span><strong><CrmOrderStatus kind="fulfillment" value={order.fulfillment_status} /></strong></article>
        <article className={styles.fact}><span>DEVOLUCIÓN</span><strong><CrmOrderStatus kind="return" value={order.return_status} /></strong></article>
      </section>

      <div className={styles.detailGrid}>
        <div>
          <section className={styles.panel} aria-labelledby="order-lines-title">
            <div className={styles.panelHeading}><div><p>SNAPSHOT HISTÓRICO</p><h2 id="order-lines-title">Artículos ({order.items.length})</h2></div><PackageOpen size={17} /></div>
            {order.items.length ? <ul className={styles.itemList}>{order.items.map((item, index) => <li key={`${item.sku}-${index}`}><span className={styles.itemName}><strong>{item.productName}</strong><small>{item.sku} · {item.variantTitle} · Cantidad {item.quantity} · {crmMoney(item.unitPrice, item.currency)} / unidad</small></span><span className={styles.itemPrice}>{crmMoney(item.lineTotal, item.currency)}</span></li>)}</ul> : <div className={styles.empty}><PackageOpen size={20} /><div><strong>Sin líneas de pedido</strong><p>La orden no tiene artículos disponibles en su snapshot.</p></div></div>}
          </section>

          <section className={styles.panel} aria-labelledby="order-timeline-title" style={{ marginTop: 14 }}>
            <div className={styles.panelHeading}><div><p>TRAZABILIDAD</p><h2 id="order-timeline-title">Cronología del pedido</h2></div><Clock3 size={17} /></div>
            {order.timeline.length ? <ol className={styles.timeline}>{order.timeline.map((event, index) => <li key={`${event.eventKey}-${event.occurredAt}-${index}`}><span className={styles.timelineDot}><span className="sr-only">Evento</span>·</span><span className={styles.timelineCopy}><strong>{eventLabel(event.eventKey)}</strong>{event.note && <p>{event.note}</p>}<time dateTime={event.occurredAt}>{crmDate(event.occurredAt)}</time></span></li>)}</ol> : <div className={styles.empty}><Clock3 size={20} /><div><strong>Sin eventos registrados</strong><p>La cronología aparecerá al procesarse el pedido.</p></div></div>}
          </section>
        </div>

        <aside>
          <section className={styles.panel} aria-labelledby="order-customer-title">
            <div className={styles.panelHeading}><div><p>CUENTA</p><h2 id="order-customer-title">Cliente</h2></div><ReceiptText size={17} /></div>
            <div style={{ padding: "15px 17px" }}><p className={styles.summaryLine}><strong>{order.customer_name}</strong></p><p className={styles.summaryLine}>{order.customer_email}</p>{order.organization_name && <p className={styles.summaryLine}><strong>Empresa</strong> {order.organization_name}</p>}<Link className={styles.backLink} href={`/backoffice/crm/clientes/${order.customer_id}`} style={{ marginTop: 14, marginBottom: 0 }}>Abrir ficha del cliente <ArrowRight size={13} /></Link></div>
          </section>
          <section className={styles.panel} aria-labelledby="order-total-title" style={{ marginTop: 14 }}>
            <div className={styles.panelHeading}><div><p>RESUMEN ECONÓMICO</p><h2 id="order-total-title">Total del pedido</h2></div></div>
            <div style={{ padding: "8px 17px 15px" }}>{totals.map((item) => <p className={styles.summaryLine} key={item.label} style={{ justifyContent: "space-between", margin: "9px 0" }}><span>{item.label}</span><strong>{crmMoney(item.amount, order.currency)}</strong></p>)}<p className={styles.summaryLine} style={{ justifyContent: "space-between", margin: "13px 0 0", paddingTop: 12, borderTop: "1px solid #edf0eb" }}><strong>Total</strong><strong>{crmMoney(order.grand_total, order.currency)}</strong></p></div>
          </section>
          <p className={styles.notice}>La cronología y los importes son de consulta. Pago, preparación, cancelación y devoluciones se gestionan en las herramientas con permisos operativos.</p>
        </aside>
      </div>
    </main>
  );
}
