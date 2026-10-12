import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, PackageSearch } from "lucide-react";
import { getCrmCustomerProfile, getCrmOrders, type CrmOrderStatus } from "@/lib/crm/orders";
import { CrmOrderStatus as StatusBadge, crmDate, crmMoney } from "../../crm-order-status";
import { CrmRouteState } from "../../crm-route-state";
import { CrmSectionNav } from "../../crm-section-nav";
import styles from "../../crm-workspace.module.css";

type Params = Promise<{ customerId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 25;
const statuses: CrmOrderStatus[] = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

function pageHref(customerId: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("page", String(page));
  return `/backoffice/crm/clientes/${customerId}?${params.toString()}`;
}

export default async function CrmCustomerDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId)) notFound();

  const rawStatus = first(query.status);
  const orderStatus = statuses.includes(rawStatus as CrmOrderStatus) ? rawStatus as CrmOrderStatus : undefined;
  const requestedPage = Number.parseInt(first(query.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 4001) : 1;
  const [profileResult, ordersResult] = await Promise.all([
    getCrmCustomerProfile(customerId),
    getCrmOrders({ customerId, query: "", orderStatus, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  ]);

  if (profileResult.state === "not-found") notFound();
  if (profileResult.state !== "ready") return <CrmRouteState state={profileResult.state} title="Ficha de cliente" />;
  if (ordersResult.state !== "ready") return <CrmRouteState state={ordersResult.state} title="Pedidos del cliente" />;

  const profile = profileResult.profile;
  const totalPages = Math.max(1, Math.ceil(ordersResult.totalCount / PAGE_SIZE));
  if (page > totalPages) redirect(pageHref(customerId, rawStatus, totalPages));

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/backoffice/crm/clientes"><ArrowLeft size={13} /> Todos los clientes</Link>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>NODRIA · CRM · FICHA DE CLIENTE</p><h1>{profile.display_name || "Cliente"}</h1><p>{profile.email}{profile.phone ? ` · ${profile.phone}` : ""}</p></div>
        <Link className={styles.headingAction} href="/backoffice/crm/pedidos"><PackageSearch size={14} /> Ver todos los pedidos</Link>
      </div>
      <CrmSectionNav active="customers" />

      <section className={styles.facts} aria-label="Resumen del cliente">
        <article className={styles.fact}><span>EMAIL DE LA CUENTA</span><strong>{profile.email}</strong></article>
        <article className={styles.fact}><span>TELÉFONO</span><strong>{profile.phone || "No indicado"}</strong></article>
        <article className={styles.fact}><span>PEDIDOS</span><strong>{profile.order_count.toLocaleString("es-ES")}</strong></article>
        <article className={styles.fact}><span>CLIENTE DESDE</span><strong>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(profile.created_at))}</strong></article>
      </section>

      <section className={styles.panel} aria-labelledby="customer-orders-title">
        <div className={styles.panelHeading}><div><p>HISTORIAL COMERCIAL</p><h2 id="customer-orders-title">Pedidos del cliente</h2></div><span className={styles.count}>{ordersResult.totalCount.toLocaleString("es-ES")} pedidos</span></div>
        <form action={`/backoffice/crm/clientes/${customerId}`} className={styles.filters}>
          <label className={styles.eyebrow} htmlFor="customer-order-status" style={{ margin: 0 }}>Estado del pedido</label>
          <select id="customer-order-status" name="status" defaultValue={orderStatus ?? "all"}><option value="all">Todos</option>{statuses.map((value) => <option key={value} value={value}>{value === "pending_payment" ? "Pendiente de pago" : value === "processing" ? "En preparación" : value === "shipped" ? "En tránsito" : value === "delivered" ? "Entregado" : value === "cancelled" ? "Cancelado" : value === "refunded" ? "Reembolsado" : "Pagado"}</option>)}</select>
          <button type="submit">Filtrar</button>
          {orderStatus && <Link href={`/backoffice/crm/clientes/${customerId}`}>Quitar filtro</Link>}
        </form>

        {ordersResult.rows.length ? <div className={styles.tableWrap}><table className={styles.table}>
          <caption className="sr-only">Pedidos de {profile.display_name || profile.email}</caption>
          <thead><tr><th>PEDIDO</th><th>FECHA</th><th>PEDIDO / PAGO</th><th>PREPARACIÓN</th><th>DEVOLUCIÓN</th><th>TOTAL</th></tr></thead>
          <tbody>{ordersResult.rows.map((order) => <tr key={order.order_id}>
            <td><Link href={`/backoffice/crm/pedidos/${order.order_id}`}>{order.order_number}</Link></td>
            <td>{crmDate(order.placed_at)}</td>
            <td><div className={styles.statusStack}><StatusBadge kind="order" value={order.order_status} /><StatusBadge kind="payment" value={order.payment_status} /></div></td>
            <td><StatusBadge kind="fulfillment" value={order.fulfillment_status} /></td>
            <td>{order.return_status ? <StatusBadge kind="return" value={order.return_status} /> : <span>—</span>}</td>
            <td><strong>{crmMoney(order.grand_total, order.currency)}</strong></td>
          </tr>)}</tbody>
        </table></div> : <div className={styles.empty}><PackageSearch size={21} /><div><strong>{orderStatus ? "No hay pedidos en ese estado" : "Este cliente aún no tiene pedidos"}</strong><p>{orderStatus ? "Quita el filtro para ver el historial completo." : "Cuando se complete una compra, aparecerá aquí con sus estados y trazabilidad."}</p></div>{orderStatus && <Link href={`/backoffice/crm/clientes/${customerId}`}>Ver todos</Link>}</div>}

        {ordersResult.totalCount > PAGE_SIZE && <nav className={styles.pager} aria-label="Paginación de pedidos del cliente"><span>Página {page} de {totalPages}</span><span className={styles.pagerLinks}>{page > 1 ? <Link href={pageHref(customerId, rawStatus, page - 1)}><ArrowLeft size={13} /> Anterior</Link> : <span aria-disabled="true"><ArrowLeft size={13} /> Anterior</span>}{page < totalPages ? <Link href={pageHref(customerId, rawStatus, page + 1)}>Siguiente <ArrowRight size={13} /></Link> : <span aria-disabled="true">Siguiente <ArrowRight size={13} /></span>}</span></nav>}
      </section>
    </main>
  );
}
