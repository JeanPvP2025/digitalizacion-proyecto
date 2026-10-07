import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Headset, Inbox, RotateCcw } from "lucide-react";
import styles from "./agent-shell.module.css";

export function SupportAgentShell({
  children,
  authenticatedStaff = false,
}: {
  children: ReactNode;
  authenticatedStaff?: boolean;
}) {
  return (
    <div className={styles.agentPage} data-support-agent-shell>
      <a className={styles.skipLink} href="#staff-main">Saltar a la bandeja</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="NODRIA, ir a la tienda">
          <span className={styles.brandName}>NODRIA</span>
          <span className={styles.brandContext}>Operaciones · Soporte</span>
        </Link>
        {authenticatedStaff ? (
          <nav className={styles.navigation} aria-label="Navegación de soporte">
            <a href="#support-inbox-title" aria-label="Ir a la cola de tickets">
              <Inbox size={16} aria-hidden="true" /> Tickets
            </a>
            <a href="#return-review-title" aria-label="Ir a las devoluciones por revisar">
              <RotateCcw size={16} aria-hidden="true" /> Devoluciones
            </a>
          </nav>
        ) : (
          <span className={styles.accessLabel}><Headset size={16} aria-hidden="true" /> Acceso del equipo</span>
        )}
        <Link className={styles.storeLink} href="/">
          Ver tienda <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </header>
      <main className={styles.main} id="staff-main" tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>
        <span>NODRIA · Herramientas internas de soporte</span>
        <Link href="/soporte">Centro de ayuda público</Link>
      </footer>
    </div>
  );
}
