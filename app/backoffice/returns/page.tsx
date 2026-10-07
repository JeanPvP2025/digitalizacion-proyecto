import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { getReturnInspectionWorkspace } from "@/lib/inventory/returns";
import { ReturnInspectionBoard } from "./return-inspection-board";
import styles from "./returns.module.css";

export const metadata: Metadata = {
  title: "Inspección de devoluciones | NODRIA Operaciones",
  description: "Inspección de almacén y disposición auditable de unidades devueltas.",
};

const messages = {
  not_configured: { title: "Inspección conectada no disponible", body: "Configura Supabase para consultar devoluciones pendientes. No se usarán datos locales como sustituto." },
  unauthenticated: { title: "Inicia sesión para continuar", body: "La inspección requiere una cuenta de almacén autenticada." },
  forbidden: { title: "Acceso restringido", body: "Esta acción requiere fulfillment_manager o super_admin." },
  error: { title: "No se pudo cargar la cola", body: "La consulta conectada falló. No se ha cambiado inventario; vuelve a intentarlo." },
} as const;

export default async function ReturnInspectionPage() {
  await connection();
  const workspace = await getReturnInspectionWorkspace();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/backoffice/inventory"><ArrowLeft size={15} aria-hidden="true" /> Volver a inventario</Link>
        <p className={styles.eyebrow}>OPERACIONES / DEVOLUCIONES</p>
        <h1>Inspección de almacén<span>.</span></h1>
        <p className={styles.intro}>Confirma que las unidades aprobadas han llegado. Repón solo lo que supere inspección; el resto queda registrado como no apto para reventa.</p>
      </header>
      {workspace.status === "ready" ? <ReturnInspectionBoard {...workspace} /> : (
        <section className={styles.statePanel} role={workspace.status === "error" ? "alert" : "status"}>
          <CircleAlert size={20} aria-hidden="true" />
          <div><h2>{messages[workspace.status].title}</h2><p>{messages[workspace.status].body}</p></div>
        </section>
      )}
    </main>
  );
}
