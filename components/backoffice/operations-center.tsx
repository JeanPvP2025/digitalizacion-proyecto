import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Gauge,
  Headset,
  LayoutDashboard,
  PackageSearch,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import type { DemoOrderRecord } from "@/lib/server/demo-orders";
import type { Product } from "@/lib/catalog";
import styles from "./operations-center.module.css";

type OrderStatus = DemoOrderRecord["status"];
type StatusFilter = "all" | OrderStatus;

type OperationsCenterProps = {
  allOrders: DemoOrderRecord[];
  visibleOrders: DemoOrderRecord[];
  products: Product[];
  query: string;
  status: StatusFilter;
};

type DayBucket = { key: string; label: string; count: number };

const currency = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const fullDate = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const weekday = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  timeZone: "Europe/Madrid",
});

function madridDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function recentDays(orders: DemoOrderRecord[], now = new Date()): DayBucket[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const created = new Date(order.createdAt);
    if (!Number.isNaN(created.getTime())) {
      const key = madridDateKey(created);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const todayKey = madridDateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - (6 - index), 12));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    return { key, label: weekday.format(date).replace(".", ""), count: counts.get(key) ?? 0 };
  });
}

function periodChange(current: number, previous: number, format: (value: number) => string): string {
  if (previous === 0) {
    return current === 0 ? "Sin actividad en ambos periodos" : `Nuevo · ${format(current)} en 7 días`;
  }

  const difference = current - previous;
  const percentage = Math.round((difference / previous) * 100);
  if (difference === 0) return `Sin cambio · ${format(current)} en 7 días`;
  const direction = difference > 0 ? "↑" : "↓";
  return `${direction} ${Math.abs(percentage)} % · ${format(current)} en 7 días`;
}

function orderState(status: OrderStatus): string {
  switch (status) {
    case "confirmed": return "Confirmado";
    case "payment_processing": return "Pago en proceso";
    case "pending": return "Pendiente";
  }
}

function paymentState(status: DemoOrderRecord["paymentStatus"]): string {
  switch (status) {
    case "approved": return "Aprobado";
    case "declined": return "Rechazado";
    case "invalid": return "Datos no válidos";
    case "insufficient_funds": return "Fondos insuficientes";
    case "processing": return "Procesando";
    case "temporary_error": return "Error temporal";
  }
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es-ES") ?? "")
    .join("");
}

export function OperationsCenter({ allOrders, visibleOrders, products, query, status }: OperationsCenterProps) {
  const now = new Date();
  const currentWindowStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const previousWindowStart = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const orderDates = allOrders.map((order) => ({ order, time: Date.parse(order.createdAt) }));
  const currentWindow = orderDates.filter(({ time }) => Number.isFinite(time) && time >= currentWindowStart && time <= now.getTime());
  const previousWindow = orderDates.filter(({ time }) => Number.isFinite(time) && time >= previousWindowStart && time < currentWindowStart);
  const approvedOrders = allOrders.filter((order) => order.status === "confirmed" && order.paymentStatus === "approved");
  const currentRevenue = currentWindow.reduce((sum, { order }) => {
    return order.status === "confirmed" && order.paymentStatus === "approved" ? sum + order.total : sum;
  }, 0);
  const previousRevenue = previousWindow.reduce((sum, { order }) => {
    return order.status === "confirmed" && order.paymentStatus === "approved" ? sum + order.total : sum;
  }, 0);
  const inProgressCount = allOrders.filter((order) => order.status === "pending" || order.status === "payment_processing").length;
  const averageBasket = approvedOrders.length
    ? approvedOrders.reduce((sum, order) => sum + order.total, 0) / approvedOrders.length
    : 0;
  const chartDays = recentDays(allOrders, now);
  const peak = Math.max(1, ...chartDays.map((day) => day.count));

  const stockTotal = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockProducts = products.filter((product) => product.stock <= 8).sort((left, right) => left.stock - right.stock);
  const pendingCount = allOrders.filter((order) => order.status === "pending").length;
  const processingCount = allOrders.filter((order) => order.status === "payment_processing").length;
  const noFilters = !query && status === "all";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="NODRIA, volver a la tienda">
          <span className={styles.brandMark} aria-hidden="true">N</span>
          <span className={styles.brandText}>NODRIA<small>OPERACIONES</small></span>
        </Link>

        <div className={styles.sideRule} />
        <nav className={styles.nav} aria-label="Navegación de operaciones">
          <p className={styles.navCaption}>ESPACIO DE TRABAJO</p>
          <Link className={`${styles.navItem} ${styles.navItemActive}`} href="#resumen" aria-current="page">
            <LayoutDashboard size={17} strokeWidth={1.7} /><span>Vista general</span><span className={styles.navIndex}>01</span>
          </Link>
          <Link className={styles.navItem} href="#pedidos">
            <ShoppingBag size={17} strokeWidth={1.7} /><span>Pedidos</span><span className={styles.navCount}>{allOrders.length}</span>
          </Link>
          <Link className={styles.navItem} href="#inventario">
            <Boxes size={17} strokeWidth={1.7} /><span>Inventario demo</span>
          </Link>
          <span className={styles.navCaptionSecondary}>EN DESARROLLO</span>
          <div className={styles.navItemDisabled} aria-disabled="true" title="La gestión de clientes aún no está disponible">
            <BriefcaseBusiness size={17} strokeWidth={1.7} /><span>Clientes y CRM</span><span className={styles.comingSoon}>Próximo</span>
          </div>
          <div className={styles.navItemDisabled} aria-disabled="true" title="El flujo de compras aún no está disponible">
            <Truck size={17} strokeWidth={1.7} /><span>Compras y envíos</span><span className={styles.comingSoon}>Próximo</span>
          </div>
          <div className={styles.navItemDisabled} aria-disabled="true" title="El centro de soporte aún no está disponible">
            <Headset size={17} strokeWidth={1.7} /><span>Soporte</span><span className={styles.comingSoon}>Próximo</span>
          </div>
          <div className={styles.navItemDisabled} aria-disabled="true" title="La analítica avanzada aún no está disponible">
            <Activity size={17} strokeWidth={1.7} /><span>Analítica</span><span className={styles.comingSoon}>Próximo</span>
          </div>
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.demoSeal}><Sparkles size={15} /><span>ENTORNO DE DEMO</span></div>
          <p>Registros ficticios persistidos localmente. Sin datos reales de clientes.</p>
          <Link href="/" className={styles.storeLink}>Ir a la tienda <ArrowUpRight size={14} /></Link>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>OPERACIONES</span><span className={styles.breadcrumbSlash}>/</span><strong>VISTA GENERAL</strong></div>
          <div className={styles.topbarTools}>
            <span className={styles.localStatus}><i /> PEDIDOS LOCALES</span>
            <span className={styles.topbarDate}><CalendarDays size={14} />{fullDate.format(now)}</span>
          </div>
        </header>

        <div className={styles.content}>
          <section className={styles.intro} id="resumen" aria-labelledby="page-title">
            <div>
              <p className={styles.eyebrow}>NODRIA <span>·</span> CONTROL DE OPERACIONES</p>
              <h1 id="page-title">El día, en <em>movimiento.</em></h1>
              <p className={styles.introText}>Pedidos persistidos y disponibilidad del catálogo de demostración, reunidos en una sola vista.</p>
            </div>
            <div className={styles.introStamp}>
              <span className={styles.stampIcon}><Gauge size={18} /></span>
              <div><strong>Vista de actividad</strong><small>Actualizada al cargar la página</small></div>
            </div>
          </section>

          <div className={styles.demoNotice} role="note">
            <span className={styles.noticeDot} />
            <strong>ENTORNO DEMO</strong>
            <span>Los pedidos se guardan en el servidor local de demostración; el stock mostrado procede de fixtures del catálogo.</span>
          </div>

          <section className={styles.kpiGrid} aria-label="Indicadores de actividad">
            <article className={`${styles.kpiCard} ${styles.kpiCardDark}`}>
              <div className={styles.kpiTop}><span>PEDIDOS REGISTRADOS</span><ShoppingBag size={16} /></div>
              <strong className={styles.kpiValue}>{allOrders.length.toLocaleString("es-ES")}</strong>
              <div className={styles.kpiFoot}><span className={styles.kpiTrend}>{allOrders.length ? <ArrowUpRight size={13} /> : <Activity size={13} />}{periodChange(currentWindow.length, previousWindow.length, (value) => `${value} pedidos`)}</span><small>vs. 7 días anteriores</small></div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiTop}><span>VENTAS APROBADAS</span><Check size={16} /></div>
              <strong className={styles.kpiValue}>{currency.format(approvedOrders.reduce((sum, order) => sum + order.total, 0))}</strong>
              <div className={styles.kpiFoot}><span className={styles.kpiTrendLight}>{periodChange(currentRevenue, previousRevenue, (value) => currency.format(value))}</span><small>últimos 7 días</small></div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiTop}><span>EN CURSO</span><PackageSearch size={16} /></div>
              <strong className={styles.kpiValue}>{inProgressCount.toLocaleString("es-ES")}</strong>
              <div className={styles.kpiFoot}><span className={styles.kpiBreakdown}>{pendingCount} pendientes <i /> {processingCount} pagos en proceso</span><small>estado actual</small></div>
            </article>
            <article className={styles.kpiCard}>
              <div className={styles.kpiTop}><span>TICKET CONFIRMADO MEDIO</span><ArrowUpRight size={16} /></div>
              <strong className={styles.kpiValue}>{currency.format(averageBasket)}</strong>
              <div className={styles.kpiFoot}><span className={styles.kpiBreakdown}>{approvedOrders.length} pedido{approvedOrders.length === 1 ? "" : "s"} aprobado{approvedOrders.length === 1 ? "" : "s"}</span><small>acumulado</small></div>
            </article>
          </section>

          <section className={styles.overviewGrid} aria-label="Actividad e inventario">
            <article className={styles.panel} aria-labelledby="activity-title">
              <div className={styles.panelHeading}>
                <div><p className={styles.panelEyebrow}>RITMO DE PEDIDOS</p><h2 id="activity-title">Actividad reciente</h2></div>
                <span className={styles.panelMeta}>ÚLTIMOS 7 DÍAS</span>
              </div>
              {allOrders.length ? (
                <div className={styles.chart} role="img" aria-label={`Pedidos por día en los últimos siete días: ${chartDays.map((day) => `${day.label} ${day.count}`).join(", ")}`}>
                  <div className={styles.chartAxis} aria-hidden="true"><span>{peak}</span><span>{Math.ceil(peak / 2)}</span><span>0</span></div>
                  <div className={styles.chartPlot}>
                    <div className={styles.chartGuides} aria-hidden="true"><i /><i /><i /></div>
                    {chartDays.map((day) => (
                      <div className={styles.chartDay} key={day.key}>
                        <div className={styles.chartBarTrack}><span className={styles.chartBar} style={{ height: `${day.count ? Math.max(7, (day.count / peak) * 100) : 0}%` }} /></div>
                        <strong>{day.count}</strong><small>{day.label}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.chartEmpty}>
                  <span><Activity size={18} /></span>
                  <div><strong>Aún no hay actividad registrada</strong><p>Cuando se persista un pedido, aparecerá aquí su fecha real.</p></div>
                </div>
              )}
              <div className={styles.chartFooter}><span><i /> Pedidos persistidos</span><small>Comparativa exacta de 7 días frente a los 7 anteriores</small></div>
            </article>

            <article className={`${styles.panel} ${styles.inventoryPanel}`} id="inventario" aria-labelledby="inventory-title">
              <div className={styles.panelHeading}>
                <div><p className={styles.panelEyebrow}>CATÁLOGO DE DEMO</p><h2 id="inventory-title">Pulso de stock</h2></div>
                <span className={styles.inventoryBadge}><Boxes size={13} /> FIXTURES</span>
              </div>
              <div className={styles.stockSummary}><strong>{stockTotal.toLocaleString("es-ES")}</strong><span>unidades declaradas<br />en {products.length} productos</span></div>
              <div className={styles.stockMeter} aria-label={`${lowStockProducts.length} productos con 8 unidades o menos`}>
                <span style={{ width: `${products.length ? (lowStockProducts.length / products.length) * 100 : 0}%` }} />
              </div>
              <div className={styles.stockMeterLabels}><span>STOCK LIMITADO <b>{lowStockProducts.length}</b></span><span>UMBRAL ≤ 8 U.</span></div>
              <div className={styles.lowStockList}>
                {lowStockProducts.length ? lowStockProducts.slice(0, 3).map((product) => (
                  <div className={styles.stockProduct} key={product.id}>
                    <span className={styles.stockProductMark}><Boxes size={14} /></span>
                    <span className={styles.stockProductName}>{product.name}<small>{product.sku}</small></span>
                    <strong className={product.stock <= 3 ? styles.stockCritical : ""}>{product.stock}<small> uds.</small></strong>
                  </div>
                )) : <p className={styles.noLowStock}>No hay productos bajo el umbral de 8 unidades.</p>}
              </div>
              <p className={styles.stockDisclaimer}>Cifras de catálogo demo; no representan un almacén conectado.</p>
            </article>
          </section>

          <section className={styles.ordersPanel} id="pedidos" aria-labelledby="orders-title">
            <div className={styles.ordersHeading}>
              <div><p className={styles.panelEyebrow}>REGISTRO LOCAL</p><h2 id="orders-title">Pedidos recientes <span>{visibleOrders.length}</span></h2></div>
              <p className={styles.ordersHint}><ClipboardList size={14} /> Resultados de registros persistidos</p>
            </div>

            <form className={styles.filters} action="/backoffice" method="get" role="search">
              <label className={styles.searchBox}>
                <Search size={16} aria-hidden="true" />
                <span className={styles.srOnly}>Buscar pedidos</span>
                <input type="search" name="q" placeholder="Pedido, cliente, SKU o ciudad" defaultValue={query} maxLength={120} />
              </label>
              <label className={styles.statusSelect}>
                <span className={styles.srOnly}>Filtrar por estado del pedido</span>
                <select name="status" defaultValue={status}>
                  <option value="all">Todos los estados</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="pending">Pendientes</option>
                  <option value="payment_processing">Pago en proceso</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
              <button className={styles.filterButton} type="submit">Aplicar filtros</button>
              {!noFilters && <Link className={styles.clearFilters} href="/backoffice">Limpiar</Link>}
            </form>

            {visibleOrders.length ? (
              <div className={styles.tableScroll} role="region" aria-label="Tabla de pedidos demo" tabIndex={0}>
                <table className={styles.ordersTable}>
                  <thead><tr><th scope="col">PEDIDO</th><th scope="col">CLIENTE DE DEMO</th><th scope="col">FECHA</th><th scope="col">ARTÍCULOS</th><th scope="col">TOTAL</th><th scope="col">ESTADO</th></tr></thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id}>
                        <td><strong className={styles.orderNumber}>{order.orderNumber}</strong><small className={styles.orderId}>{order.id}</small></td>
                        <td><div className={styles.customerCell}><span className={styles.avatar} aria-hidden="true">{initials(order.customer.name)}</span><span>{order.customer.name}<small>{order.customer.email}</small></span></div></td>
                        <td className={styles.dateCell}>{Number.isNaN(Date.parse(order.createdAt)) ? "Fecha no disponible" : dateTime.format(new Date(order.createdAt))}</td>
                        <td><span className={styles.itemCount}>{order.items.reduce((sum, item) => sum + item.quantity, 0)} uds.</span><small className={styles.itemDetail}>{order.items.length} referencia{order.items.length === 1 ? "" : "s"}</small></td>
                        <td className={styles.totalCell}>{currency.format(order.total)}</td>
                        <td><div className={styles.stateCell}><span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>{orderState(order.status)}</span><small className={`${styles.paymentBadge} ${styles[`payment_${order.paymentStatus}`]}`}>{paymentState(order.paymentStatus)}</small></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.ordersEmpty}>
                <span className={styles.emptyIcon}>{allOrders.length ? <Search size={20} /> : <ShoppingBag size={20} />}</span>
                <strong>{allOrders.length ? "No hay pedidos que coincidan" : "Todavía no hay pedidos persistidos"}</strong>
                <p>{allOrders.length ? "Prueba otra búsqueda o cambia el estado seleccionado." : "Los pedidos completados en el flujo demo aparecerán aquí con su importe y estado reales."}</p>
                {!noFilters && <Link href="/backoffice">Ver todos los pedidos <ArrowRight size={14} /></Link>}
                {!allOrders.length && <span className={styles.emptyFootnote}><CircleHelp size={13} /> Las métricas de pedidos y ventas parten de cero hasta que exista un registro.</span>}
              </div>
            )}
            <div className={styles.tableFoot}><span>DEMO · PERSISTENCIA LOCAL</span><span>{visibleOrders.length} de {allOrders.length} pedidos registrados</span></div>
          </section>

          <footer className={styles.pageFooter}><span>© NODRIA · CENTRO DE OPERACIONES</span><span>Vista académica de demostración</span></footer>
        </div>
      </main>
    </div>
  );
}
