import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { checkSupportAgentRole, getConnectedSupportSession } from "@/lib/support/auth";
import { SupportAgentWorkspace } from "../agent-workspace";

export const metadata: Metadata = {
  title: "Bandeja de soporte",
  description: "Gestión de tickets y revisión de devoluciones de NODRIA.",
};

export default async function SupportAgentPage() {
  const session = await getConnectedSupportSession();
  if (session.kind === "unavailable") {
    return <main className="page-wrap"><p className="eyebrow">OPERACIONES DE SOPORTE</p><h1 className="page-title">Bandeja no disponible<span className="title-period">.</span></h1><p className="page-intro">Esta bandeja necesita el entorno conectado de Supabase.</p></main>;
  }
  if (session.kind === "unauthenticated") {
    return <main className="page-wrap"><p className="eyebrow">OPERACIONES DE SOPORTE</p><h1 className="page-title">Acceso del equipo<span className="title-period">.</span></h1><p className="page-intro">Inicia sesión con una cuenta del equipo de soporte.</p><Link className="button button--dark" href="/acceso?next=%2Fsoporte%2Fagente">Iniciar sesión</Link></main>;
  }

  const role = await checkSupportAgentRole(session.supabase, session.user.id);
  if (role.error) {
    return <main className="page-wrap"><p className="eyebrow">OPERACIONES DE SOPORTE</p><h1 className="page-title">No se pudo verificar el acceso<span className="title-period">.</span></h1><p className="page-intro">Vuelve a cargar la página cuando se restablezca la conexión.</p></main>;
  }
  if (!role.allowed) {
    return <main className="page-wrap"><p className="eyebrow">OPERACIONES DE SOPORTE</p><h1 className="page-title">Bandeja restringida<span className="title-period">.</span></h1><p className="page-intro">Esta vista está reservada a las cuentas con rol de soporte.</p><Link href="/soporte"><ArrowLeft size={14} /> Volver a soporte</Link></main>;
  }

  return (
    <main className="page-wrap">
      <p className="eyebrow">OPERACIONES DE SOPORTE</p>
      <h1 className="page-title">Bandeja de soporte<span className="title-period">.</span></h1>
      <p className="page-intro">Responde a clientes, registra cambios de estado y deja constancia de cada decisión sobre devoluciones.</p>
      <SupportAgentWorkspace />
    </main>
  );
}
