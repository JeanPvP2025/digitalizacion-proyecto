import Link from "next/link";
import { ArrowLeft, ArrowRight, PackageSearch, Search } from "lucide-react";
import { redirect } from "next/navigation";
import {
  getCrmOrders,
  type CrmFulfillmentStatus,
  type CrmOrderStatus,
  type CrmPaymentStatus,
  type CrmReturnStatus,
} from "@/lib/crm/orders";
import { CrmOrderStatus as StatusBadge, crmDate, crmMoney } from "../crm-order-status";
import { CrmRouteState } from "../crm-route-state";
import { CrmSectionNav } from "../crm-section-nav";
import styles from "../crm-workspace.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 50;

const orderStatuses: Array<{ value: CrmOrderStatus; label: string }> = [
  { value: "pending_payment", label: "Pendiente de pago" },
  { value: "paid", label: "Pagado" },
  { value: "processing", label: "En preparación" },
  { value: "shipped", label: "En tránsito" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refunded", label: "Reembolsado" },
];
const paymentStatuses: Array<{ value: CrmPaymentStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "authorized", label: "Autorizado" },
  { value: "paid", label: "Pagado" },
  { value: "failed", label: "Fallido" },
  { value: "partially_refunded", label: "Reembolso parcial" },
  { value: "refunded", label: "Reembolsado" },
];
const fulfillmentStatuses: Array<{ value: CrmFulfillmentStatus; label: string }> = [
  { value: "not_started", label: "Sin preparar" },
  { value: "pending", label: "Pendiente" },
  { value: "picking", label: "En picking" },
  { value: "packed", label: "Empaquetado" },
  { value: "shipped", label: "En tránsito" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "not_required", label: "No requerido" },
];
const returnStatuses: Array<{ value: CrmReturnStatus; label: string }> = [
  { value: "requested", label: "Solicitada" },
  { value: "approved", label: "Aprobada" },
  { value: "rejected", label: "Rechazada" },
  { value: "received", label: "Recibida" },
  { value: "refunded", label: "Reembolsada" },
  { value: "closed", label: "Cerrada" },
];

function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function validChoice<T extends string>(value: string, choices: Array<{ value: T }>): T | undefined {
  return choices.some((choice) => choice.value === value) ? value as T : undefined;
}
function pageHref(filters: Record<string, string>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set("page", String(page));
  return `/backoffice/crm/pedidos?${params.toString()}`;
}

export default async function CrmOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 100);
  const orderStatus = validChoice(first(params.order), orderStatuses);
  const paymentStatus = validChoice(first(params.payment), paymentStatuses);
  const fulfillmentStatus = validChoice(first(params.fulfillment), fulfillmentStatuses);
  const returnStatus = validChoice(first(params.return), returnStatuses);
  const parsedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 2000) : 1;
  const filters = {
    q: query,
    order: orderStatus ?? "",
    payment: paymentStatus ?? "",
    fulfillment: fulfillmentStatus ?? "",
    return: returnStatus ?? "",
  };
  const result = await getCrmOrders({
    query,
    orderStatus,
    paymentStatus,
    fulfillmentStatus,
    returnStatus,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  if (result.state !== "ready") return <CrmRouteState state={result.state} title="Pedidos" />;

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
  if (page > totalPages) redirect(pageHref(filters, totalPages));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>NODRIA · CRM · PEDIDOS</p><h1>Pedidos y su recorrido.</h1><p>Consulta de ventas con estado del pedido, pago, preparación y devolución por separado. Los cambios operativos se realizan en el área autorizada.</p></div>
        <Link className={styles.headingAction} href="/backoffice"><ArrowLeft size={14} /> Centro de operaciones</Link>
      </div>
      <CrmSectionNav active="orders" />

      <section className={styles.panel} aria-labelledby="crm-orders-title">
        <div className={styles.panelHeading}><div><p>VENTAS · HISTORIAL COMPLETO</p><h2 id="crm-orders-title">Pedidos</h2></div><span className={styles.count}>{result.totalCount.toLocaleString("es-ES")} resultados</span></div>
        <form action="/backoffice/crm/pedidos" className={styles.filters} role="search">
          <label className={styles.eyebrow} htmlFor="order-search" style={{ margin: 0 }}>Buscar pedidos</label>
          <input id="order-search" name="q" type="search" maxLength={100} placeholder="N.º, cliente, email, empresa, producto o SKU" defaultValue={query} />
          <label className="sr-only" htmlFor="order-status">Estado del pedido</label>
          <select id="order-status" name="order" defaultValue={orderStatus ?? ""}><option value="">Todos los pedidos</option>{orderStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
          <label className="sr-only" htmlFor="payment-status">Estado del pago</label>
          <select id="payment-status" name="payment" defaultValue={paymentStatus ?? ""}><option value="">Todos los pagos</option>{paymentStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
          <label className="sr-only" htmlFor="fulfillment-status">Estado de preparación</label>
          <select id="fulfillment-status" name="fulfillment" defaultValue={fulfillmentStatus ?? ""}><option value="">Toda preparación</option>{fulfillmentStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
          <label className="sr-only" htmlFor="return-status">Estado de devolución</label>
          <select id="return-status" name="return" defaultValue={returnStatus ?? ""}><option value="">Todas las devoluciones</option>{returnStatuses.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
          <button type="submit"><Search size={13} /> Filtrar</button>
          {hasFilters && <Link href="/backoffice/crm/pedidos">Limpiar filtros</Link>}
        </form>

        {result.rows.length ? <div className={styles.tableWrap}><table className={styles.table}>
          <caption className="sr-only">Pedidos, clientes, pago, preparación y devoluciones</caption>
          <thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>FECHA</th><th>PEDIDO / PAGO</th><th>PREPARACIÓN</th><th>DEVOLUCIÓN</th><th>TOTAL</th></tr></thead>
          <tbody>{result.rows.map((order) => <tr key={order.order_id}>
            <td><Link href={`/backoffice/crm/pedidos/${order.order_id}`}>{order.order_number} <ArrowRight size={12} /></Link>{order.organization_name && <small>{order.organization_name}</small>}</td>
            <td><Link href={`/backoffice/crm/clientes/${order.customer_id}`}>{order.customer_name}</Link><small>{order.customer_email}</small></td>
            <td>{crmDate(order.placed_at)}</td>
            <td><div className={styles.statusStack}><StatusBadge kind="order" value={order.order_status} /><StatusBadge kind="payment" value={order.payment_status} /></div></td>
            <td><StatusBadge kind="fulfillment" value={order.fulfillment_status} /></td>
            <td><StatusBadge kind="return" value={order.return_status} /></td>
            <td><strong>{crmMoney(order.grand_total, order.currency)}</strong></td>
          </tr>)}</tbody>
        </table></div> : <div className={styles.empty}><PackageSearch size={22} /><div><strong>{hasFilters ? "No hay pedidos que coincidan" : "Aún no hay pedidos"}</strong><p>{hasFilters ? "Prueba a cambiar los filtros o buscar por otro dato." : "Los pedidos confirmados aparecerán aquí con el estado de pago, preparación y devolución."}</p></div>{hasFilters && <Link href="/backoffice/crm/pedidos">Ver todos los pedidos</Link>}</div>}

        {result.totalCount > PAGE_SIZE && <nav className={styles.pager} aria-label="Paginación de pedidos"><span>Página {page} de {totalPages} · {result.totalCount.toLocaleString("es-ES")} pedidos</span><span className={styles.pagerLinks}>{page > 1 ? <Link href={pageHref(filters, page - 1)}><ArrowLeft size={13} /> Anterior</Link> : <span aria-disabled="true"><ArrowLeft size={13} /> Anterior</span>}{page < totalPages ? <Link href={pageHref(filters, page + 1)}>Siguiente <ArrowRight size={13} /></Link> : <span aria-disabled="true">Siguiente <ArrowRight size={13} /></span>}</span></nav>}
      </section>
    </main>
  );
}
