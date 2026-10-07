import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, LifeBuoy, Wrench } from "lucide-react";
import { ReturnRequestForm } from "./return-request-form";
import { SupportForm } from "@/components/storefront/support-form";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getServerAuthState } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Soporte técnico",
  description: "Abre un ticket o solicita una devolución de un pedido elegible de NODRIA.",
};

type OrganizationOption = { slug: string; displayName: string };

export default async function SupportPage() {
  const mode = getServerDataMode();
  const auth = await getServerAuthState();
  const authenticated = auth.kind === "signed-in";
  let organizations: OrganizationOption[] = [];

  if (authenticated) {
    const { data: memberships, error: membershipError } = await auth.supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", auth.user.id);
    if (!membershipError && memberships?.length) {
      const { data } = await auth.supabase
        .from("organizations")
        .select("slug, display_name")
        .in("id", memberships.map((membership) => membership.organization_id));
      organizations = (data ?? []).map((organization) => ({
        slug: String(organization.slug),
        displayName: String(organization.display_name),
      }));
    }
  }

  const demoMode = mode === "local-demo";
  return (
    <main className="page-wrap">
      <p className="eyebrow">PERSONAS EXPERTAS, AL OTRO LADO</p>
      <h1 className="page-title">Estamos contigo<span className="title-period">.</span></h1>
      <p className="page-intro">Registra una consulta asociada a tu cuenta, pedido o empresa. También puedes revisar si un pedido cumple las condiciones de devolución.</p>
      <section className="support-contact">
        <aside className="support-aside">
          <span className="support-icon"><LifeBuoy size={20} /></span>
          <h2>Cuéntanos qué necesitas.</h2>
          <p>{demoMode ? "Las solicitudes públicas de esta demo guardan datos ficticios en un archivo local." : "En el entorno conectado, cada ticket y su primer mensaje se guardan juntos y quedan vinculados a una cuenta verificada."}</p>
          <div className="support-aside-detail"><span><Wrench size={14} /> Diagnóstico y configuración</span><span>Devoluciones sujetas a elegibilidad del pedido</span></div>
          <Link href="/servicios">Descubre nuestros servicios <ArrowUpRight size={13} /></Link>
        </aside>
        <div className="support-form-wrap">
          <p className="eyebrow">ABRIR UNA SOLICITUD</p>
          <h2>¿En qué podemos ayudarte?</h2>
          <SupportForm
            demoMode={demoMode}
            requiresAuth={mode === "supabase" && !authenticated}
            unavailable={mode === "unavailable"}
            organizations={organizations}
          />
        </div>
      </section>
      <section className="support-contact support-returns-section">
        <aside className="support-aside">
          <span className="support-icon"><Wrench size={20} /></span>
          <h2>Devoluciones con reglas claras.</h2>
          <p>Solo puede solicitarla la cuenta que realizó el pedido entregado. El plazo de la demo académica es de 30 días desde la entrega y el sistema comprueba las cantidades pendientes.</p>
        </aside>
        <div className="support-form-wrap">
          <p className="eyebrow">DEVOLUCIÓN O RMA</p>
          <h2>Solicitar una devolución</h2>
          <ReturnRequestForm connected={mode === "supabase"} authenticated={authenticated} />
        </div>
      </section>
    </main>
  );
}
