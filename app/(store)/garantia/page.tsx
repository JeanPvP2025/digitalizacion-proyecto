import Link from "next/link";
import { ArrowRight, BadgeCheck, Wrench } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Garantía y asistencia (demo)",
  "Las coberturas de las fichas NODRIA son datos ficticios. Esta demo no tramita garantías, reparaciones ni devoluciones reales.",
);

export default function WarrantyPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">GARANTÍA · DEMOSTRACIÓN ACADÉMICA</p>
      <h1 className="page-title">No termina<br />cuando llega<span className="title-period">.</span></h1>
      <p className="page-intro">
        NODRIA y sus productos son ficticios. Esta página explica qué significa la información de garantía
        que aparece en la interfaz de demostración; no describe una cobertura comercial ni asesoramiento legal.
      </p>
      <div className="policy-grid">
        <article>
          <span className="policy-icon"><BadgeCheck size={19} /></span>
          <h2>Las coberturas son ficticias.</h2>
          <p>
            Las etiquetas de garantía del catálogo son datos de ejemplo y no crean una cobertura de NODRIA o de un fabricante.
            No hay una compra real, factura ni producto cubierto dentro de esta demostración.
          </p>
          <p>Para una compra real, revisa la documentación de ese producto y del vendedor correspondiente.</p>
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
        No introduzcas datos personales reales. Puedes consultar también los <Link href="/envios">límites de envíos y devoluciones</Link>.
      </p>
    </main>
  );
}
