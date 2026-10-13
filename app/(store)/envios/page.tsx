import Link from "next/link";
import { ArrowRight, PackageCheck, Truck } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Información de compra y envíos",
  "NODRIA muestra referencias de productos y enlaza al vendedor. No vende, envía ni tramita devoluciones de esos productos.",
);

export default function ShippingPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">INFORMACIÓN DE COMPRA</p>
      <h1 className="page-title">Consulta al vendedor<span className="title-period">.</span></h1>
      <p className="page-intro">
        Las fichas de NODRIA muestran modelos reales y precios de referencia consultados en PcComponentes.
        NODRIA no vende esos modelos ni mantiene su inventario; cada precio y disponibilidad puede cambiar.
      </p>
      <div className="policy-grid">
        <article>
          <span className="policy-icon"><Truck size={19} /></span>
          <h2>Compra en la ficha del vendedor.</h2>
          <p>
            El enlace externo abre la página de PcComponentes del modelo. Allí puedes consultar el precio vigente,
            disponibilidad, condiciones de compra y datos del vendedor.
          </p>
          <p>NODRIA no cobra, confirma pedidos, prepara envíos ni ofrece stock propio.</p>
          <Link href="/catalogo">Ver referencias de producto <ArrowRight size={13} /></Link>
        </article>
        <article>
          <span className="policy-icon"><PackageCheck size={19} /></span>
          <h2>Devolución y garantía.</h2>
          <p>
            Cualquier compra se realizaría con el vendedor externo, por lo que sus condiciones de devolución y garantía
            son las aplicables. NODRIA no tramita devoluciones ni reembolsos de esas compras.
          </p>
          <p>Los formularios de soporte y pedidos de esta plataforma son demostraciones académicas.</p>
          <Link href="/soporte">Probar formulario de soporte <ArrowRight size={13} /></Link>
        </article>
      </div>
      <p className="legal-demo-note">
        NODRIA es un proyecto académico y no tiene relación comercial con PcComponentes. Los precios son instantáneas de referencia, no una oferta de NODRIA.
        Consulta <Link href="/garantia">los límites de garantía</Link> de la demo.
      </p>
    </main>
  );
}
