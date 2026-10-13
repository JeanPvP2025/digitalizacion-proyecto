import Link from "next/link";
import { ArrowRight, PackageCheck, Truck } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Envíos y devoluciones",
  "Consulta cómo se representa el pedido, la entrega y la devolución dentro de la demostración NODRIA.",
);

export default function ShippingPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">TU PEDIDO NODRIA</p>
      <h1 className="page-title">Envíos y devoluciones<span className="title-period">.</span></h1>
      <p className="page-intro">
        La tienda incluye el recorrido de compra y las pantallas operativas de envío y devolución. Los estados muestran cómo funcionaría el proceso.
      </p>
      <div className="policy-grid">
        <article>
          <span className="policy-icon"><Truck size={19} /></span>
          <h2>Seguimiento del pedido.</h2>
          <p>
            Tras confirmar un pedido, su estado y los cambios de preparación se muestran en el área de cliente y en el centro de operaciones.
          </p>
          <p>Los pedidos de esta demostración no se preparan ni se entregan físicamente.</p>
          <Link href="/mi-cuenta">Ver mi espacio <ArrowRight size={13} /></Link>
        </article>
        <article>
          <span className="policy-icon"><PackageCheck size={19} /></span>
          <h2>Solicitar una devolución.</h2>
          <p>
            Puedes recorrer la solicitud de devolución, su revisión y los estados de RMA desde el área de cliente.
          </p>
          <p>La resolución, el reembolso y la inspección se registran como datos de demostración.</p>
          <Link href="/soporte">Abrir soporte <ArrowRight size={13} /></Link>
        </article>
      </div>
      <p className="legal-demo-note">
        NODRIA es una experiencia académica: los productos, existencias, pedidos y operaciones son de demostración. No hay cobros, envíos ni devoluciones reales.
        Consulta <Link href="/garantia">la información de garantía</Link> de la tienda.
      </p>
    </main>
  );
}
