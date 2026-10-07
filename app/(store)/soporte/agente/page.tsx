import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { checkSupportAgentRole, getConnectedSupportSession } from "@/lib/support/auth";
import { SupportAgentWorkspace } from "../agent-workspace";
import { SupportAgentShell } from "./agent-shell";
import styles from "./agent-shell.module.css";

export const metadata: Metadata = {
  title: "Bandeja de soporte",
  description: "Gestión de tickets y revisión de devoluciones de NODRIA.",
};

export default async function SupportAgentPage() {
  // Session and role are request-specific even when this deployment has no Supabase env at build time.
  await connection();
  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return <AccessPage title="Bandeja no disponible" description="Esta bandeja necesita el entorno conectado de Supabase." />;
  }
  if (session.kind === "unauthenticated") {
    return (
      <AccessPage title="Acceso del equipo" description="Inicia sesión con una cuenta del equipo de soporte.">
        <Link className="button button--dark" href="/acceso?next=%2Fsoporte%2Fagente">Iniciar sesión</Link>
      </AccessPage>
    );
  }

  const role = await checkSupportAgentRole(session.supabase, session.user.id);
  if (role.error) {
    return <AccessPage title="No se pudo verificar el acceso" description="Vuelve a cargar la página cuando se restablezca la conexión." />;
  }
  if (!role.allowed) {
    return (
      <AccessPage title="Bandeja restringida" description="Esta vista está reservada a las cuentas con rol de soporte.">
        <Link href="/soporte"><ArrowLeft size={14} aria-hidden="true" /> Volver a soporte</Link>
      </AccessPage>
    );
  }

  return (
    <SupportAgentShell authenticatedStaff>
      <p className={styles.eyebrow}>Operaciones de soporte</p>
      <h1>Bandeja de soporte</h1>
      <p className={styles.intro}>Responde a clientes, registra cambios de estado y deja constancia de cada decisión sobre devoluciones.</p>
      <SupportAgentWorkspace />
    </SupportAgentShell>
  );
}

function AccessPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <SupportAgentShell>
      <section className={styles.state} aria-labelledby="support-access-title">
        <p className={styles.eyebrow}>Operaciones de soporte</p>
        <h1 id="support-access-title">{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </SupportAgentShell>
  );
}
