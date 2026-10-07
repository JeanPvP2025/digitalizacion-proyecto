import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, Boxes, CheckCircle2, Clock3, Package, Search, Truck } from "lucide-react";
import type { OperationsFulfillmentStage, OperationsOrder, OperationsWorkspace } from "@/lib/operations/data";
import { OperationsOrderAction } from "@/components/backoffice/operations-order-action";
import styles from "./operations-center.module.css";

type QueueFilter = "all" | "ready" | "shipped";

const dateTime = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const dateTimeFull = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function formatDate(value: string, formatter = dateTime): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : formatter.format(date);
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toLocaleString("es-ES")} ${currency}`;
  }
}

function fulfillmentStageLabel(stage: OperationsFulfillmentStage): string {
  const labels: Record<OperationsFulfillmentStage, string> = {
    pending: "Pendiente de picking",
    picking: "En picking",
    packed: "Empaquetado",
    shipped: "En tránsito",
  };
  return labels[stage];
}

function transitionForStage(stage: OperationsFulfillmentStage): "pick" | "pack" | "dispatch" | "deliver" {
  if (stage === "pending") return "pick";
  if (stage === "picking") return "pack";
  if (stage === "packed") return "dispatch";
  return "deliver";
}

function searchMatches(order: OperationsOrder, query: string): boolean {
  if (!query) return true;
  return [order.orderNumber, order.recipient, order.destination, ...order.items.flatMap((item) => [item.name, item.sku])]
    .some((value) => value.toLocaleLowerCase("es-ES").includes(query));
}

export function OperationsCenter({
  workspace,
  query,
  queue,
}: {
  workspace: Extract<OperationsWorkspace, { status: "ready" }>;
  query: string;
  queue: QueueFilter;
}) {
  const normalizedQuery = query.toLocaleLowerCase("es-ES");
  const visibleOrders = workspace.orders.filter((order) => {
    if (queue === "ready" && order.fulfillmentStage === "shipped") return false;
    if (queue === "shipped" && order.fulfillmentStage !== "shipped") return false;
    return searchMatches(order, normalizedQuery);
  });
  const latestEventsByOrder = new Map<string, (typeof workspace.events)[number]>();
  for (const event of workspace.events) {
    if (!latestEventsByOrder.has(event.orderId)) latestEventsByOrder.set(event.orderId, event);
  }
  const lastUpdated = formatDate(workspace.fetchedAt, dateTimeFull);
  const hasFilters = Boolean(query) || queue !== "all";

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="NODRIA, volver a la tienda">
          <span className={styles.brandMark}>N</span>
          <span>NODRIA<small>OPERACIONES</small></span>
        </Link>
        <nav className={styles.topNav} aria-label="Navegación interna">
          <Link href="/backoffice" aria-current="page">Centro operativo</Link>
          <Link href="/backoffice/inventory"><Boxes size={15} aria-hidden="true" />Inventario</Link>
          <Link className={styles.storeLink} href="/">Tienda <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="operations-title">
        <div>
          <p className={styles.eyebrow}><span /> OPERACIONES / FULFILLMENT</p>
          <h1 id="operations-title">Centro operativo<span>.</span></h1>
          <p className={styles.intro}>Picking, empaquetado, expedición y actividad del timeline en una sola vista.</p>
        </div>
        <div className={styles.connectionStatus}>
          <span className={styles.connectionDot} />
          <span><strong>Supabase conectado</strong><small>Lectura protegida por sesión y RLS</small></span>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Indicadores operativos">
        <article className={`${styles.metric} ${styles.metricPrimary}`}>
          <span className={styles.metricIcon}><Package size={16} aria-hidden="true" /></span>
          <p>PENDIENTES DE EXPEDICIÓN</p>
          <strong>{workspace.readyForDispatch.toLocaleString("es-ES")}</strong>
          <small>Pedidos pagados pendientes de despacho</small>
          <ArrowUpRight className={styles.metricArrow} size={16} aria-hidden="true" />
        </article>
        <article className={styles.metric}>
          <span className={`${styles.metricIcon} ${styles.metricIconOlive}`}><Truck size={16} aria-hidden="true" /></span>
          <p>EN TRÁNSITO</p>
          <strong>{workspace.inTransit.toLocaleString("es-ES")}</strong>
          <small>Esperando confirmación de entrega</small>
          <ArrowDownRight className={styles.metricArrowMuted} size={16} aria-hidden="true" />
        </article>
        <article className={styles.metric}>
          <span className={`${styles.metricIcon} ${styles.metricIconBlue}`}><Activity size={16} aria-hidden="true" /></span>
          <p>EVENTOS · 24 H</p>
          <strong>{workspace.eventsLast24Hours.toLocaleString("es-ES")}</strong>
          <small>Registros del timeline de pedidos</small>
        </article>
        <article className={styles.metric}>
          <span className={`${styles.metricIcon} ${styles.metricIconGreen}`}><CheckCircle2 size={16} aria-hidden="true" /></span>
          <p>ENTREGAS · 7 DÍAS</p>
          <strong>{workspace.deliveriesLast7Days.toLocaleString("es-ES")}</strong>
          <small>Confirmaciones registradas</small>
        </article>
      </section>

      <div className={styles.workGrid}>
        <section className={styles.ordersPanel} id="pedidos" aria-labelledby="orders-title">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.panelEyebrow}>COLA DE TRABAJO</p>
              <h2 id="orders-title">Pedidos accionables <span>{visibleOrders.length}</span></h2>
            </div>
            <span className={styles.sourceBadge}><span /> DATOS CONECTADOS</span>
          </div>

          <form className={styles.filters} action="/backoffice" method="get" role="search">
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden="true" />
              <span className={styles.srOnly}>Buscar pedido, destinatario o producto</span>
              <input type="search" name="q" placeholder="Pedido, destinatario, SKU o producto" defaultValue={query} maxLength={100} />
            </label>
            <label className={styles.filterSelect}>
              <span className={styles.srOnly}>Filtrar cola por etapa</span>
              <select name="queue" defaultValue={queue}>
                <option value="all">Todas las etapas</option>
                <option value="ready">Pendientes de despacho</option>
                <option value="shipped">En tránsito</option>
              </select>
            </label>
            <button className={styles.filterButton} type="submit">Aplicar</button>
            {hasFilters && <Link className={styles.clearFilters} href="/backoffice">Limpiar</Link>}
          </form>

          {workspace.queueIsLimited && <p className={styles.limitNotice}>La tabla muestra los 24 pedidos operables más antiguos. Los indicadores muestran el recuento total permitido por RLS.</p>}

          {visibleOrders.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.ordersTable}>
                <caption className={styles.srOnly}>Pedidos pagados en picking o empaquetado y pedidos expedidos pendientes de entrega</caption>
                <thead><tr><th scope="col">PEDIDO</th><th scope="col">DESTINO / ARTÍCULOS</th><th scope="col">ÚLTIMO EVENTO</th><th scope="col">ESTADO</th><th scope="col">ACCIÓN</th></tr></thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const latestEvent = latestEventsByOrder.get(order.id);
                    const preview = order.items[0];
                    const restCount = Math.max(0, order.items.length - 1);
                    return (
                      <tr id={`order-${order.id}`} key={order.id}>
                        <td>
                          <strong className={styles.orderNumber}>{order.orderNumber}</strong>
                          <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
                          <span className={styles.orderTotal}>{formatMoney(order.total, order.currency)}</span>
                        </td>
                        <td>
                          <strong className={styles.recipient}>{order.recipient}</strong>
                          <span className={styles.destination}>{order.destination}</span>
                          <span className={styles.itemSummary}>{preview ? `${preview.quantity} × ${preview.name}` : "Líneas de pedido no disponibles"}{restCount ? ` · +${restCount} más` : ""}</span>
                        </td>
                        <td>
                          {latestEvent ? <><strong className={styles.eventName}>{latestEvent.key}</strong><span className={styles.eventDate}>{formatDate(latestEvent.occurredAt)}</span></> : <span className={styles.muted}>Sin eventos en los últimos 7 días</span>}
                        </td>
                        <td><span className={`${styles.statusBadge} ${styles[`stage_${order.fulfillmentStage}`]}`}><i aria-hidden="true" />{fulfillmentStageLabel(order.fulfillmentStage)}</span></td>
                        <td><OperationsOrderAction orderId={order.id} transition={transitionForStage(order.fulfillmentStage)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}><Package size={19} aria-hidden="true" /></span>
              <strong>{hasFilters ? "No hay pedidos que coincidan" : "La cola de preparación está al día"}</strong>
              <p>{hasFilters ? "Prueba con otro término o etapa." : "Los pedidos aparecen aquí tras confirmar el pago. Los expedidos permanecen hasta que se registra su entrega."}</p>
              {hasFilters && <Link href="/backoffice">Ver toda la cola</Link>}
            </div>
          )}
          <footer className={styles.panelFooter}>
            <span><i aria-hidden="true" /> Picking y empaquetado quedan en timeline · El despacho consume reservas en PostgreSQL</span>
            <small>Actualizado {lastUpdated}</small>
          </footer>
        </section>

        <aside className={styles.activityPanel} aria-labelledby="activity-title">
          <div className={styles.activityHeading}>
            <div><p className={styles.panelEyebrow}>TRAZABILIDAD</p><h2 id="activity-title">Timeline reciente</h2></div>
            <span className={styles.activityCount}>{workspace.events.length.toString().padStart(2, "0")}</span>
          </div>
          {workspace.events.length ? (
            <ol className={styles.timeline}>
              {workspace.events.map((event) => (
                <li key={event.id}>
                  <span className={styles.timelineMarker}><Clock3 size={13} aria-hidden="true" /></span>
                  <div className={styles.timelineCopy}>
                    <a href={`#order-${event.orderId}`} className={styles.timelineOrder}>{event.orderNumber}</a>
                    <strong>{event.key}</strong>
                    <p>{event.note || "Evento registrado en el timeline operativo."}</p>
                    <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.activityEmpty}>
              <Activity size={20} aria-hidden="true" />
              <strong>Sin actividad reciente</strong>
              <p>Los cambios de pedido aparecerán aquí cuando se registren eventos operativos.</p>
            </div>
          )}
          <p className={styles.activityFoot}>Últimos 7 días · eventos visibles para tu rol</p>
        </aside>
      </div>

      <footer className={styles.pageFooter}>
        <span>NODRIA · OPERACIONES</span>
        <span>Las reglas de expedición y reservas se validan en PostgreSQL.</span>
      </footer>
    </main>
  );
}
