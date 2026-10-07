import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Boxes, CircleAlert, ShoppingBag } from "lucide-react";
import { getProcurementWorkspace } from "@/lib/inventory/procurement/data";
import { ProcurementBoard } from "./ProcurementBoard";
import styles from "./procurement.module.css";

export const metadata: Metadata = {
  title: "Proveedores y compras | NODRIA Operaciones",
  description: "Gestiona proveedores, órdenes de compra y recepciones de almacén de NODRIA.",
};

function ProcurementState({ status }: { status: "not_configured" | "unauthenticated" | "forbidden" | "error" }) {
  const messages = {
    not_configured: { title: "Compras conectadas no disponibles", body: "Configura Supabase para consultar proveedores y órdenes. Esta ruta no crea datos locales ni inventa existencias." },
    unauthenticated: { title: "Inicia sesión para continuar", body: "La gestión de proveedores y compras requiere una sesión de personal autenticada." },
    forbidden: { title: "Acceso restringido", body: "Esta superficie requiere fulfillment_manager o super_admin, también comprobado por cada RPC de base de datos." },
    error: { title: "No se pudo cargar procurement", body: "Una consulta de Supabase falló. No se ha cambiado stock; vuelve a intentarlo cuando se recupere el servicio." },
  } as const;
  const message = messages[status];
  return <section className={styles.statePanel} role={status === "error" ? "alert" : "status"}><span className={styles.stateIcon}><CircleAlert size={20} aria-hidden="true" /></span><div><h2>{message.title}</h2><p>{message.body}</p>{status === "error" && <Link href="/backoffice/procurement">Volver a cargar</Link>}</div></section>;
}

export default async function ProcurementPage() {
  await connection();
  const workspace = await getProcurementWorkspace();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/backoffice"><ArrowLeft size={15} aria-hidden="true" /> Volver al centro de operaciones</Link>
        <Link className={styles.inventoryLink} href="/backoffice/inventory"><Boxes size={14} aria-hidden="true" /> Stock e inventario</Link>
        <p className={styles.eyebrow}>OPERACIONES / COMPRAS</p>
        <div className={styles.titleLine}><h1>Proveedores y compras<span>.</span></h1><span className={styles.headerBadge}><ShoppingBag size={13} aria-hidden="true" /> PROCUREMENT CONECTADO</span></div>
        <p className={styles.intro}>Prepara órdenes, controla lo que queda por recibir y confirma cada llegada contra el ledger de inventario.</p>
      </header>
      {workspace.status === "ready" ? <ProcurementBoard {...workspace} /> : <ProcurementState status={workspace.status} />}
    </main>
  );
}
