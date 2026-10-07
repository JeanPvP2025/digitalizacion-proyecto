import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { OperationsCenter } from "@/components/backoffice/operations-center";
import styles from "@/components/backoffice/operations-center.module.css";
import { getOperationsWorkspace, type OperationsWorkspace } from "@/lib/operations/data";

export const metadata: Metadata = {
  title: "Centro de operaciones | NODRIA",
  description: "Pedidos, expediciones y eventos operativos conectados de NODRIA.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type QueueFilter = "all" | "ready" | "shipped";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function OperationsState({ status }: { status: Exclude<OperationsWorkspace["status"], "ready"> }) {
  const messages = {
    unconfigured: {
      title: "Operaciones conectadas no disponibles",
      body: "Configura Supabase para consultar pedidos y eventos. Este centro no sustituye la información conectada por registros demo.",
    },
    unauthenticated: {
      title: "Inicia sesión para continuar",
      body: "Consulta pedidos con una sesión de personal autenticada.",
    },
    forbidden: {
      title: "Acceso restringido",
      body: "El centro operativo requiere el rol fulfillment_manager o super_admin.",
    },
    error: {
      title: "No se pudo cargar la cola operativa",
      body: "Una consulta a Supabase ha fallado. No se han cambiado pedidos; vuelve a cargar cuando se recupere el servicio.",
    },
  } as const;
  const message = messages[status];

  return (
    <main className="page-wrap staff-access-message" role={status === "error" ? "alert" : "status"}>
      <p className="eyebrow">NODRIA · CENTRO DE OPERACIONES</p>
      <h1 className="page-title">{message.title}</h1>
      <p>{message.body}</p>
      {status === "error" && <a className="button button--dark" href="/backoffice">Volver a cargar</a>}
    </main>
  );
}

function OperationsLoading() {
  return (
    <main className={styles.loading} aria-label="Cargando pedidos y eventos operativos" role="status">
      <span className={styles.loadingLine} />
      <span className={styles.loadingCards}><i /><i /><i /><i /></span>
      <span className={styles.loadingPanel} />
    </main>
  );
}

async function OperationsContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const [params, workspace] = await Promise.all([searchParams, getOperationsWorkspace()]);
  if (workspace.status !== "ready") return <OperationsState status={workspace.status} />;

  const query = firstValue(params.q).trim().slice(0, 100);
  const requestedFilter = firstValue(params.queue);
  const queue: QueueFilter = requestedFilter === "ready" || requestedFilter === "shipped" ? requestedFilter : "all";

  return <OperationsCenter workspace={workspace} query={query} queue={queue} />;
}

export default function BackofficePage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<OperationsLoading />}><OperationsContent searchParams={searchParams} /></Suspense>;
}
