import Link from "next/link";
import { ArrowRight, PackageCheck, Truck } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Envíos y devoluciones (demo)",
  "Conoce los límites del checkout académico de NODRIA: no hay transportista, entrega ni devolución real. Los importes y estados son ficticios.",
);

export default function ShippingPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">ENVÍOS · DEMOSTRACIÓN ACADÉMICA</p>
      <h1 className="page-title">Cada entrega,<br />bien acompañada<span className="title-period">.</span></h1>
      <p className="page-intro">
        El checkout permite recorrer un pedido ficticio, pero NODRIA no vende ni envía productos.
        No uses direcciones, teléfonos ni otros datos personales reales en la demo.
      </p>
      <div className="policy-grid">
        <article>
          <span className="policy-icon"><Truck size={19} /></span>
          <h2>El pedido no se expide.</h2>
          <p>
            En desarrollo local, el checkout puede registrar un pedido ficticio y mostrar un importe de envío de ejemplo.
            No calcula una tarifa comercial ni se conecta a un transportista.
          </p>
          <p>No se crea una etiqueta, no se recoge ningún paquete y no hay fecha de entrega real.</p>
          <Link href="/catalogo">Explorar el catálogo ficticio <ArrowRight size={13} /></Link>
        </article>
        <article>
          <span className="policy-icon"><PackageCheck size={19} /></span>
          <h2>Devoluciones no disponibles.</h2>
          <p>
            No existe una compra real que devolver y la plataforma no gestiona paquetes, reembolsos ni solicitudes de RMA.
            Los estados de pedido que muestra son datos de demostración.
          </p>
          <p>El formulario de soporte solo sirve para probar el registro local de una consulta ficticia.</p>
          <Link href="/soporte">Probar formulario de soporte <ArrowRight size={13} /></Link>
        </article>
      </div>
      <p className="legal-demo-note">
        NODRIA es un proyecto académico ficticio. Los importes, productos y estados de esta plataforma no son una oferta comercial.
        Consulta <Link href="/garantia">los límites de garantía</Link> de la demo.
      </p>
    </main>
  );
}
