import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getCrmCustomers } from "@/lib/crm/orders";
import { CrmOrderStatus, crmDate } from "../crm-order-status";
import { CrmRouteState } from "../crm-route-state";
import { CrmSectionNav } from "../crm-section-nav";
import styles from "../crm-workspace.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 50;

function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

function pageHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `/backoffice/crm/clientes?${params.toString()}`;
}

export default async function CrmCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 100);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 2000) : 1;
  const result = await getCrmCustomers(query, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  if (result.state !== "ready") return <CrmRouteState state={result.state} title="Clientes" />;

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
  if (page > totalPages) redirect(pageHref(query, totalPages));

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>NODRIA · CRM · CLIENTES</p><h1>Personas, compras y relación.</h1><p>Perfiles de cuenta con pedidos asociados. La lista muestra datos mínimos y excluye cuentas del equipo interno.</p></div>
        <Link className={styles.headingAction} href="/backoffice/crm"><ArrowLeft size={14} /> Volver al resumen</Link>
      </div>
      <CrmSectionNav active="customers" />

      <section className={styles.panel} aria-labelledby="customers-title">
        <div className={styles.panelHeading}><div><p>DIRECTORIO DE CLIENTES</p><h2 id="customers-title">Cuentas y últimos pedidos</h2></div><span className={styles.count}>{result.totalCount.toLocaleString("es-ES")} clientes</span></div>
        <form action="/backoffice/crm/clientes" className={styles.filters} role="search">
          <label className={styles.eyebrow} htmlFor="customer-search" style={{ margin: 0 }}>Buscar cliente</label>
          <input id="customer-search" name="q" type="search" maxLength={100} placeholder="Nombre, email, teléfono o pedido" defaultValue={query} />
          <button type="submit"><Search size={13} /> Buscar</button>
        </form>

        {result.rows.length ? <div className={styles.tableWrap}><table className={styles.table}>
          <caption className="sr-only">Clientes y sus pedidos más recientes</caption>
          <thead><tr><th>CLIENTE</th><th>CONTACTO</th><th>PEDIDOS</th><th>ÚLTIMO PEDIDO</th><th>ESTADOS</th><th /></tr></thead>
          <tbody>{result.rows.map((customer) => <tr key={customer.customer_id}>
            <td className={styles.primaryCell}><strong>{customer.display_name || "Cliente"}</strong><small>Cuenta desde {crmDate(customer.created_at)}</small></td>
            <td><strong>{customer.email}</strong>{customer.phone && <small>{customer.phone}</small>}</td>
            <td><strong>{customer.order_count.toLocaleString("es-ES")}</strong></td>
            <td>{customer.latest_order_number ? <><strong>{customer.latest_order_number}</strong><small>{customer.latest_order_at ? crmDate(customer.latest_order_at) : "Fecha no disponible"}</small></> : <span>Sin pedidos</span>}</td>
            <td><div className={styles.statusStack}>{customer.latest_order_status && <CrmOrderStatus kind="order" value={customer.latest_order_status} />}{customer.latest_payment_status && <CrmOrderStatus kind="payment" value={customer.latest_payment_status} />}</div></td>
            <td><Link href={`/backoffice/crm/clientes/${customer.customer_id}`}>Abrir ficha <ArrowRight size={13} /></Link></td>
          </tr>)}</tbody>
        </table></div> : <div className={styles.empty}><UsersRound size={22} /><div><strong>{query ? "No hay clientes con esa búsqueda" : "Aún no hay cuentas de cliente"}</strong><p>{query ? "Prueba con otro nombre, correo, teléfono o número de pedido." : "Los perfiles aparecerán aquí cuando se registren nuevos clientes."}</p></div>{query && <Link href="/backoffice/crm/clientes">Quitar búsqueda</Link>}</div>}

        {result.totalCount > PAGE_SIZE && <nav className={styles.pager} aria-label="Paginación de clientes">
          <span>Página {page} de {totalPages} · {result.totalCount.toLocaleString("es-ES")} clientes</span>
          <span className={styles.pagerLinks}>{page > 1 ? <Link href={pageHref(query, page - 1)}><ArrowLeft size={13} /> Anterior</Link> : <span aria-disabled="true"><ArrowLeft size={13} /> Anterior</span>}{page < totalPages ? <Link href={pageHref(query, page + 1)}>Siguiente <ArrowRight size={13} /></Link> : <span aria-disabled="true">Siguiente <ArrowRight size={13} /></span>}</span>
        </nav>}
      </section>
    </main>
  );
}
