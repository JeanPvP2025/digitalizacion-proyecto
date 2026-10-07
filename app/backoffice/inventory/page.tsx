import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Boxes, Search } from "lucide-react";
import { getInventorySnapshot, type InventoryRow, type InventorySnapshot } from "@/lib/inventory";
import { InventoryActions } from "./InventoryActions";
import styles from "./inventory.module.css";

export const metadata: Metadata = {
  title: "Inventario | NODRIA Operaciones",
  description: "Consulta interna del stock por almacén de NODRIA.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOW_STOCK_LIMIT = 5;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function number(value: number): string {
  return value.toLocaleString("es-ES");
}

function lastUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function matchesQuery(row: InventoryRow, query: string): boolean {
  if (!query) return true;
  const searchable = [
    row.sku,
    row.variantTitle,
    row.productName,
    row.brand,
    row.variantId,
    row.warehouseCode,
    row.warehouseName,
    row.warehouseCity,
  ];
  return searchable.some((value) => value?.toLocaleLowerCase("es-ES").includes(query));
}

function InventoryShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/backoffice">
          <ArrowLeft size={15} aria-hidden="true" /> Volver al centro de operaciones
        </Link>
        <Link className={styles.procurementLink} href="/backoffice/procurement">Proveedores y órdenes de compra <span aria-hidden="true">→</span></Link>
        <p className={styles.eyebrow}>OPERACIONES / INVENTARIO</p>
        <div className={styles.titleLine}>
          <h1>Stock por almacén<span>.</span></h1>
          <span className={styles.readOnly}>RECEPCIONES · AJUSTES</span>
        </div>
        <p className={styles.intro}>Consulta el inventario conectado y registra recepciones de proveedor o ajustes con autorización de almacén.</p>
      </header>
      {children}
    </main>
  );
}

function InventoryState({ status }: { status: Exclude<InventorySnapshot["status"], "ready"> }) {
  const messages = {
    not_configured: {
      title: "Inventario conectado no disponible",
      body: "No hay credenciales de Supabase configuradas y no existe una fuente local de inventario. Esta ruta no sustituye el stock conectado con datos estimados.",
    },
    unauthenticated: {
      title: "Inicia sesión para continuar",
      body: "Consulta el inventario con una cuenta autenticada que tenga un rol de personal autorizado.",
    },
    forbidden: {
      title: "Acceso restringido",
      body: "Tu cuenta no tiene el rol fulfillment_manager ni super_admin requerido para consultar almacenes e inventario.",
    },
    error: {
      title: "No se pudo cargar el inventario",
      body: "La consulta a Supabase ha fallado. Comprueba la conexión y vuelve a intentarlo; no se han aplicado cambios al stock.",
    },
  } as const;
  const message = messages[status];

  return (
    <section className={styles.statePanel} role={status === "error" ? "alert" : "status"}>
      <span className={styles.stateIcon}><Boxes size={20} aria-hidden="true" /></span>
      <div>
        <h2>{message.title}</h2>
        <p>{message.body}</p>
        {status === "error" && <Link href="/backoffice/inventory">Volver a cargar</Link>}
      </div>
    </section>
  );
}

function InventoryLoading() {
  return (
    <InventoryShell>
      <div className={styles.loading} role="status" aria-label="Cargando inventario">
        <span /> <span /> <span />
      </div>
    </InventoryShell>
  );
}

async function InventoryContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q).trim().slice(0, 100);
  const normalizedQuery = query.toLocaleLowerCase("es-ES");
  const snapshot = await getInventorySnapshot();

  return (
    <InventoryShell>
      {snapshot.status !== "ready" ? <InventoryState status={snapshot.status} /> : (
        <InventoryTable snapshot={snapshot} query={query} normalizedQuery={normalizedQuery} />
      )}
    </InventoryShell>
  );
}

function InventoryTable({
  snapshot,
  query,
  normalizedQuery,
}: {
  snapshot: Extract<InventorySnapshot, { status: "ready" }>;
  query: string;
  normalizedQuery: string;
}) {
  const rows = snapshot.rows;
  const visibleRows = rows.filter((row) => matchesQuery(row, normalizedQuery));
  const physicalUnits = rows.reduce((total, row) => total + row.onHand, 0);
  const reservedUnits = rows.reduce((total, row) => total + row.reserved, 0);
  const availableUnits = rows.reduce((total, row) => total + row.available, 0);
  const lowStockRows = rows.filter((row) => row.available <= LOW_STOCK_LIMIT).length;

  return (
    <>
      <InventoryActions rows={rows} />
      <section className={styles.metrics} aria-label="Resumen de stock consultado">
        <article className={styles.metric}>
          <span>UNIDADES FÍSICAS</span>
          <strong>{number(physicalUnits)}</strong>
          <small>{number(rows.length)} referencias por almacén</small>
        </article>
        <article className={styles.metric}>
          <span>UNIDADES RESERVADAS</span>
          <strong>{number(reservedUnits)}</strong>
          <small>Descontadas de la disponibilidad</small>
        </article>
        <article className={styles.metric}>
          <span>DISPONIBLES</span>
          <strong>{number(availableUnits)}</strong>
          <small>Físico menos reservado</small>
        </article>
        <article className={`${styles.metric} ${styles.metricAlert}`}>
          <span>BAJO MÍNIMO</span>
          <strong>{number(lowStockRows)}</strong>
          <small>Ubicaciones con 5 unidades o menos</small>
        </article>
      </section>

      <section className={styles.inventoryPanel} aria-labelledby="stock-table-title">
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>EXISTENCIAS</p>
            <h2 id="stock-table-title">Referencias de inventario <span>{number(visibleRows.length)}</span></h2>
          </div>
          <span className={styles.sourceBadge}>SUPABASE · CONSULTA PROTEGIDA</span>
        </div>

        <form className={styles.searchForm} action="/backoffice/inventory" method="get" role="search">
          <label className={styles.searchField}>
            <Search size={16} aria-hidden="true" />
            <span className={styles.srOnly}>Buscar por producto, SKU o almacén</span>
            <input type="search" name="q" placeholder="Producto, SKU, referencia o almacén" defaultValue={query} maxLength={100} />
          </label>
          <button type="submit">Buscar</button>
          {query && <Link href="/backoffice/inventory">Limpiar</Link>}
        </form>

        {snapshot.isLimited && <p className={styles.limitNote}>La consulta está limitada a las 500 referencias actualizadas más recientemente. Las métricas resumen este lote y la búsqueda filtra sus filas.</p>}
        {snapshot.variantDetailsLimited && <p className={styles.visibilityNote}>Algunas referencias se muestran por identificador: las políticas actuales solo permiten al rol de fulfillment leer fichas de catálogo publicadas.</p>}
        <p className={styles.thresholdNote}>Umbral operativo visible: {LOW_STOCK_LIMIT} unidades disponibles o menos.</p>

        {visibleRows.length ? (
          <div className={styles.tableViewport}>
            <table>
              <caption className={styles.srOnly}>Stock físico, reservas y disponibilidad por variante y almacén</caption>
              <thead>
                <tr>
                  <th scope="col">Producto / variante</th>
                  <th scope="col">Almacén</th>
                  <th scope="col">Físico</th>
                  <th scope="col">Reservado</th>
                  <th scope="col">Disponible</th>
                  <th scope="col">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => <InventoryTableRow key={`${row.warehouseId}:${row.variantId}`} row={row} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Boxes size={19} aria-hidden="true" />
            <strong>{rows.length ? "No hay coincidencias" : "Aún no hay existencias registradas"}</strong>
            <p>{rows.length ? "Prueba con otro SKU, producto o almacén." : "Cuando el esquema reciba inventario conectado, las filas aparecerán aquí."}</p>
          </div>
        )}

        <footer className={styles.panelFooter}>
          <span><i aria-hidden="true" /> Solo lectura · métricas calculadas desde las filas recibidas</span>
          <small>Historial persistido en el ledger de movimientos</small>
        </footer>
      </section>
    </>
  );
}

function InventoryTableRow({ row }: { row: InventoryRow }) {
  const low = row.available <= LOW_STOCK_LIMIT;
  const outOfStock = row.available <= 0;
  const itemName = row.productName ?? (row.sku ? `Producto ${row.sku}` : `Referencia ${row.variantId.slice(0, 8)}`);
  const variantDetail = [row.brand, row.sku, row.variantTitle].filter(Boolean).join(" · ");

  return (
    <tr>
      <td>
        <strong className={styles.productName}>{itemName}</strong>
        <small className={styles.productMeta}>{variantDetail || `ID ${row.variantId}`}</small>
      </td>
      <td><strong className={styles.warehouseName}>{row.warehouseName}</strong><small className={styles.productMeta}>{row.warehouseCode} · {row.warehouseCity}</small></td>
      <td className={styles.quantity}>{number(row.onHand)}</td>
      <td className={styles.quantity}>{number(row.reserved)}</td>
      <td>
        <span className={`${styles.stockValue} ${low ? styles.stockLow : ""} ${outOfStock ? styles.stockEmpty : ""}`}>
          <i aria-hidden="true" />{number(row.available)}
          <small>{outOfStock ? "Sin stock" : low ? "Bajo mínimo" : "Disponible"}</small>
        </span>
      </td>
      <td className={styles.updatedAt}>{lastUpdated(row.updatedAt)}</td>
    </tr>
  );
}

export default function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<InventoryLoading />}>
      <InventoryContent searchParams={searchParams} />
    </Suspense>
  );
}
