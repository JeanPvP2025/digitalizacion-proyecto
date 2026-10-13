import Link from "next/link";
import { ArrowRight, BadgeCheck, Wrench } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Garantía y asistencia",
  "Consulta la cobertura de garantía y el flujo de asistencia que representa la tienda NODRIA.",
);

export default function WarrantyPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">GARANTÍA · ASISTENCIA</p>
      <h1 className="page-title">Acompañamiento<br />después de elegir<span className="title-period">.</span></h1>
      <p className="page-intro">
        La experiencia incluye las pantallas de soporte, garantía y devolución de una tienda tecnológica. Los casos se guardan como datos de demostración y no generan reparaciones o envíos reales.
      </p>
      <div className="policy-grid">
        <article>
          <span className="policy-icon"><BadgeCheck size={19} /></span>
          <h2>Consulta la cobertura.</h2>
          <p>
            La ficha de cada modelo reúne sus especificaciones. Para una compra real, la cobertura depende de las condiciones comerciales vigentes y del fabricante.
          </p>
          <p>Los pedidos de esta web son simulados y no generan factura ni garantía comercial.</p>
        </article>
        <article>
          <span className="policy-icon"><Wrench size={19} /></span>
          <h2>El soporte también es una demo.</h2>
          <p>
            El formulario permite probar la apertura de una consulta y, en desarrollo local, guarda un ticket ficticio.
            No se realiza diagnóstico, reparación, sustitución ni gestión de garantía.
          </p>
          <Link href="/soporte">Probar formulario de soporte <ArrowRight size={13} /></Link>
        </article>
      </div>
      <p className="legal-demo-note">
        Usa datos ficticios al probar los formularios. Consulta también <Link href="/envios">envíos y devoluciones</Link>.
      </p>
    </main>
  );
}
