import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleAlert,
  CircleHelp,
  CreditCard,
  Database,
  FileWarning,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";
import { getAnalyticsSnapshot, type AnalyticsSnapshot } from "@/lib/analytics/data";
import { ANALYTICS_METRIC_DEFINITIONS, ANALYTICS_TIME_ZONE } from "@/lib/analytics/metrics";
import styles from "./analytics.module.css";

export const metadata: Metadata = {
  title: "Analítica · NODRIA",
  description: "Métricas de pedidos, pagos, existencias y solicitudes CRM desde datos conectados.",
};

const currency = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const percentage = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: ANALYTICS_TIME_ZONE });
const dateTime = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ANALYTICS_TIME_ZONE,
});

function periodLabel(snapshot: Extract<AnalyticsSnapshot, { state: "ready" }>): string {
  return `${date.format(new Date(snapshot.period.startInclusive))} — ${date.format(new Date(snapshot.period.endExclusive))}`;
}

function AnalyticsFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.breadcrumb} aria-label="Navegación de backoffice">
          <Link href="/backoffice"><ArrowLeft size={14} aria-hidden="true" /> Operaciones</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Analítica</span>
        </nav>
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>NODRIA <span>·</span> INTELIGENCIA OPERATIVA</p>
            <h1>Lo que dicen <em>los datos.</em></h1>
            <p className={styles.intro}>Pedidos, cobros, stock y solicitudes comerciales calculados desde registros protegidos.</p>
          </div>
          <div className={styles.accessStamp}>
            <span><ShieldCheck size={15} aria-hidden="true" /> ACCESO INTERNO</span>
            <small>Solo super_admin</small>
          </div>
        </div>
        <nav className={styles.sectionNav} aria-label="Áreas de equipo">
          <Link href="/backoffice">Operaciones <ArrowUpRight size={12} aria-hidden="true" /></Link>
          <Link href="/backoffice/inventory">Inventario <ArrowUpRight size={12} aria-hidden="true" /></Link>
          <Link href="/backoffice/crm">CRM <ArrowUpRight size={12} aria-hidden="true" /></Link>
          <span aria-current="page">Analítica <BarChart3 size={13} aria-hidden="true" /></span>
        </nav>
      </header>
      {children}
    </main>
  );
}

function AnalyticsState({ snapshot }: { snapshot: Exclude<AnalyticsSnapshot, { state: "ready" }> }) {
  const errorReason = snapshot.state === "error" ? snapshot.reason : null;
  const copy = {
    not_configured: {
      title: "Analítica conectada pendiente",
      body: "No hay una conexión Supabase configurada. Esta vista no utiliza pedidos demo, archivos locales ni métricas estimadas.",
      icon: <Database size={21} aria-hidden="true" />,
      alert: false,
      action: "Volver a operaciones",
      href: "/backoffice",
    },
    unauthenticated: {
      title: "Inicia sesión para continuar",
      body: "Las métricas operativas requieren una sesión Auth verificada.",
      icon: <ShieldCheck size={21} aria-hidden="true" />,
      alert: false,
      action: "Iniciar sesión",
      href: "/acceso?next=%2Fbackoffice%2Fanalytics",
    },
    forbidden: {
      title: "Acceso restringido",
      body: "El agregado cruza datos de pedidos, pagos, almacén y CRM. La matriz actual limita esta vista al rol super_admin.",
      icon: <ShieldCheck size={21} aria-hidden="true" />,
      alert: true,
      action: "Volver a operaciones",
      href: "/backoffice",
    },
    error: {
      title: errorReason === "inconsistent" ? "Fuentes de pago no conciliadas" : "No se pudo cargar la analítica",
      body: errorReason === "limit"
        ? "Una fuente supera el máximo seguro de 5.000 filas. No se muestran agregados parciales."
        : errorReason === "inconsistent"
          ? "Los eventos, las transacciones y el pedido asociado no coinciden. Se ocultan los totales hasta resolver la discrepancia."
          : "Falló una de las lecturas protegidas de Supabase. No se muestran resultados parciales; vuelve a intentarlo.",
      icon: errorReason === "inconsistent" ? <FileWarning size={21} aria-hidden="true" /> : <CircleAlert size={21} aria-hidden="true" />,
      alert: true,
      action: "Reintentar",
      href: "/backoffice/analytics",
    },
  } as const;
  const message = copy[snapshot.state];

  return (
    <section className={styles.statePanel} role={message.alert ? "alert" : "status"}>
      <span className={styles.stateIcon}>{message.icon}</span>
      <div>
        <p className={styles.panelKicker}>DATOS CONECTADOS · CONTROL DE ACCESO</p>
        <h2>{message.title}</h2>
        <p>{message.body}</p>
        <Link href={message.href}>{message.action} <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

function MetricCard({
  className,
  icon,
  label,
  value,
  detail,
  dark = false,
}: {
  className: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  dark?: boolean;
}) {
  return (
    <article className={`${styles.metricCard} ${styles[className]} ${dark ? styles.metricCardDark : ""}`}>
      <div className={styles.metricTop}><span>{label}</span><span className={styles.metricIcon}>{icon}</span></div>
      <strong className={styles.metricValue}>{value}</strong>
      <p className={styles.metricDetail}>{detail}</p>
    </article>
  );
}

function MetricDefinitions() {
  return (
    <section className={styles.definitions} aria-labelledby="definitions-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.panelKicker}>CONTRATO DE CÁLCULO</p>
          <h2 id="definitions-title">Qué entra en cada cifra</h2>
        </div>
        <span className={styles.definitionMark}><CircleHelp size={15} aria-hidden="true" /> Fórmulas auditables</span>
      </div>
      <div className={styles.definitionScroll}>
        <table>
          <caption className={styles.visuallyHidden}>Numerador, denominador, periodo, zona horaria y filtro de estados de cada métrica</caption>
          <thead>
            <tr><th scope="col">Métrica</th><th scope="col">Numerador</th><th scope="col">Denominador</th><th scope="col">Periodo y zona horaria</th><th scope="col">Estados</th></tr>
          </thead>
          <tbody>
            {ANALYTICS_METRIC_DEFINITIONS.map((definition) => (
              <tr key={definition.id}>
                <th scope="row">{definition.label}</th>
                <td>{definition.numerator}</td>
                <td>{definition.denominator}</td>
                <td>{definition.period}<small>{definition.timeZone}</small></td>
                <td>{definition.states}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.boundaryNote}>Ventana temporal semiabierta: inicio incluido, instante de consulta excluido. La lectura usa el cliente autenticado y RLS; si falla una fuente, se oculta todo el agregado.</p>
    </section>
  );
}

function AnalyticsDashboard({ snapshot }: { snapshot: Extract<AnalyticsSnapshot, { state: "ready" }> }) {
  const { metrics } = snapshot;
  const hasNoPeriodActivity = metrics.orderCount === 0
    && metrics.approvedPaymentOrders === 0
    && metrics.resolvedPaymentOrders === 0
    && metrics.crm.totalRequests === 0;
  const noInventoryRows = metrics.inventory.rowCount === 0;

  return (
    <>
      <section className={styles.reportBar} aria-label="Periodo del informe">
        <div><span className={styles.reportDot} aria-hidden="true" /><strong>SUPABASE · RLS ACTIVO</strong><span>Periodo {periodLabel(snapshot)} · {ANALYTICS_TIME_ZONE}</span></div>
        <small>Corte {dateTime.format(new Date(snapshot.generatedAt))}</small>
      </section>

      {hasNoPeriodActivity && noInventoryRows && (
        <p className={styles.emptyNotice} role="status"><CircleHelp size={15} aria-hidden="true" /> Aún no hay registros en estas fuentes. Los valores cero reflejan tablas vacías; no se generan datos de muestra.</p>
      )}

      <section className={styles.metricGrid} aria-label="Indicadores de negocio">
        <MetricCard
          className="metricSales"
          dark
          icon={<CreditCard size={17} aria-hidden="true" />}
          label="VENTAS BRUTAS APROBADAS · EUR"
          value={currency.format(metrics.grossSalesEurCents / 100)}
          detail={`${integer.format(metrics.approvedPaymentOrders)} pedidos únicos con evento payment_paid`}
        />
        <MetricCard
          className="metricOrders"
          icon={<ShoppingBag size={17} aria-hidden="true" />}
          label="PEDIDOS VÁLIDOS"
          value={integer.format(metrics.orderCount)}
          detail="Pagados y no reembolsados en la cohorte de 30 fechas"
        />
        <MetricCard
          className="metricPayments"
          icon={<CreditCard size={17} aria-hidden="true" />}
          label="APROBACIÓN DE PAGOS"
          value={metrics.paymentApprovalRate === null ? "—" : percentage.format(metrics.paymentApprovalRate)}
          detail={metrics.resolvedPaymentOrders
            ? `${integer.format(metrics.approvedPaymentOrders)} aprobados / ${integer.format(metrics.resolvedPaymentOrders)} pedidos resueltos`
            : "Sin pedidos con resultado terminal en el periodo"}
        />
        <MetricCard
          className="metricInventory"
          icon={<Boxes size={17} aria-hidden="true" />}
          label="UNIDADES DISPONIBLES"
          value={integer.format(metrics.inventory.availableUnits)}
          detail={`${integer.format(metrics.inventory.reservedUnits)} reservadas · ${integer.format(metrics.inventory.rowCount)} ubicaciones SKU`}
        />
        <MetricCard
          className="metricCrm"
          icon={<BarChart3 size={17} aria-hidden="true" />}
          label="CONVERSIÓN DE SOLICITUDES"
          value={metrics.crm.conversionRate === null ? "—" : percentage.format(metrics.crm.conversionRate)}
          detail={metrics.crm.totalRequests
            ? `${integer.format(metrics.crm.convertedRequests)} convertidas / ${integer.format(metrics.crm.totalRequests)} solicitudes creadas`
            : "Sin solicitudes creadas en el periodo"}
        />
      </section>

      {metrics.grossSalesExcludedCurrencyOrders > 0 && (
        <p className={styles.currencyNotice} role="status">{integer.format(metrics.grossSalesExcludedCurrencyOrders)} pedidos pagados en monedas distintas de EUR se excluyen del importe; no hay conversor cambiario configurado.</p>
      )}

      <MetricDefinitions />

      <section className={styles.unavailable} aria-labelledby="unavailable-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.panelKicker}>FUERA DEL CONTRATO ACTUAL</p><h2 id="unavailable-title">Métricas aún no disponibles</h2></div>
          <span className={styles.unavailableMark}><FileWarning size={15} aria-hidden="true" /> Sin fuente verificable</span>
        </div>
        <ul>
          <li><strong>Ventas netas tras devoluciones</strong><span>No existe un ledger de reembolsos con importe y fecha para restarlos.</span></li>
          <li><strong>Margen bruto</strong><span>Los pedidos no guardan el coste histórico de compra del producto.</span></li>
          <li><strong>Conversión de visita a pedido</strong><span>El sistema no tiene eventos de sesión o analítica web conectados.</span></li>
          <li><strong>Conversión de presupuesto B2B a pedido</strong><span>El flujo actual no enlaza una oferta aceptada con una orden de compra.</span></li>
        </ul>
      </section>

      <footer className={styles.footer}><Database size={13} aria-hidden="true" /> Valores calculados al solicitar la página; sin caché ni fixtures. La instantánea de inventario representa el estado observado durante la consulta.</footer>
    </>
  );
}

export default async function AnalyticsPage() {
  await connection();
  const snapshot = await getAnalyticsSnapshot();

  return (
    <AnalyticsFrame>
      {snapshot.state === "ready"
        ? <AnalyticsDashboard snapshot={snapshot} />
        : <AnalyticsState snapshot={snapshot} />}
    </AnalyticsFrame>
  );
}
