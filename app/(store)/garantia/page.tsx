import Link from "next/link";
import { ArrowRight, BadgeCheck, Wrench } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Garantía y asistencia",
  "NODRIA muestra referencias externas y no vende, repara ni tramita garantías o devoluciones de estos productos.",
);

export default function WarrantyPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">GARANTÍA · REFERENCIAS EXTERNAS</p>
      <h1 className="page-title">No termina<br />cuando llega<span className="title-period">.</span></h1>
      <p className="page-intro">
        NODRIA es un proyecto académico que enlaza a fichas de modelos reales. No vende esos productos
        ni ofrece garantía, reparación o devolución; confirma las condiciones con el vendedor y el fabricante.
      </p>
      <div className="policy-grid">
        <article>
          <span className="policy-icon"><BadgeCheck size={19} /></span>
          <h2>NODRIA no tramita garantías.</h2>
          <p>
            Las fichas de catálogo no crean una cobertura de NODRIA. No existe una compra o factura emitida por NODRIA.
          </p>
          <p>Para una compra externa, revisa la documentación vigente del producto y del vendedor.</p>
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
