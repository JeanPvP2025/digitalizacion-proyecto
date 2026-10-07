import type { ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerAuthState, getStaffRoleGrants } from "@/lib/supabase/auth";
import { getServerDataMode } from "@/lib/server/data-mode";
import { hasStaffSurfaceRole } from "@/lib/supabase/policies";
import styles from "./staff-nav.module.css";

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AccessMessage title="Comprobando acceso…">Verificando tu sesión con NODRIA.</AccessMessage>}><BackofficeGate>{children}</BackofficeGate></Suspense>;
}

async function BackofficeGate({ children }: { children: ReactNode }) {
  // Auth cookies and runtime credentials must be checked for each request, not at build time.
  await connection();
  const dataMode = getServerDataMode();
  const auth = await getServerAuthState();

  if (auth.kind === "demo") {
    return <AccessMessage title="Portal de equipo desactivado.">La demo no tiene proyecto Supabase, sesión real ni una forma segura de comprobar permisos. No se muestra el panel de operaciones.</AccessMessage>;
  }

  if (auth.kind === "signed-out") redirect("/acceso?next=%2Fbackoffice");

  const { roles, error } = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (error) {
    return <AccessMessage title="No se pudieron comprobar los permisos.">La consulta de roles de Supabase falló. Vuelve a intentarlo cuando se recupere el servicio.</AccessMessage>;
  }

  if (!hasStaffSurfaceRole(roles, "backoffice")) {
    return <AccessMessage title="No tienes acceso al portal de equipo.">El portal requiere un rol de personal asignado mediante una vía administrativa confiable.</AccessMessage>;
  }

  return <>{roles.includes("catalog_manager") && <nav className={styles.catalogNav} aria-label="Herramientas de catálogo"><Link className="button button--dark" href="/backoffice/catalog">Gestión de catálogo</Link></nav>}{dataMode === "local-demo" && <div className="staff-demo-data-notice" role="status">Acceso validado con Supabase. Los pedidos del centro de operaciones son datos ficticios locales de desarrollo.</div>}{children}</>;
}

function AccessMessage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="page-wrap staff-access-message"><p className="eyebrow">NODRIA · ACCESO INTERNO</p><h1 className="page-title">{title}</h1><p>{children}</p><Link className="button button--dark" href="/">Volver a la tienda</Link></main>;
}
