import Link from "next/link";
import { ArrowRight, Cable, Cpu, Headphones, Network, Wrench } from "lucide-react";
import { createPublicPageMetadata } from "@/lib/content/public-seo";

export const metadata = createPublicPageMetadata(
  "Servicios tecnológicos (demo)",
  "Explora el configurador de PC y los formularios de soporte y B2B de esta demo académica. NODRIA es ficticia y no presta servicios reales.",
);

const services = [
  {
    icon: Wrench,
    title: "Montaje a medida",
    copy: "El PC Builder comprueba compatibilidades entre componentes ficticios y permite preparar una configuración para el carrito demo. No montamos ni probamos equipos reales.",
    href: "/configurador",
    action: "Abrir el configurador demo",
  },
  {
    icon: Cpu,
    title: "Diagnóstico técnico",
    copy: "Puedes probar el formulario de soporte con una incidencia de ejemplo. Se guarda un ticket local de demostración; no se realiza un diagnóstico técnico.",
    href: "/soporte",
    action: "Probar formulario de soporte",
  },
  {
    icon: Network,
    title: "Redes e infraestructura",
    copy: "Esta área ilustra una posible consulta B2B. El formulario registra una solicitud ficticia en el entorno local; no se prepara una propuesta ni se instala infraestructura.",
    href: "/empresas#solicitar",
    action: "Ver formulario B2B demo",
  },
  {
    icon: Headphones,
    title: "Soporte y mantenimiento",
    copy: "El flujo de soporte permite recorrer la apertura de un ticket de prueba. No hay mantenimiento contratado, equipo de guardia ni plazo real de respuesta.",
    href: "/soporte",
    action: "Probar el flujo de soporte",
  },
  {
    icon: Cable,
    title: "Integración audiovisual",
    copy: "Es un ejemplo de servicio dentro del concepto de NODRIA. La demo no ofrece catálogo, instalación ni gestión de proyectos audiovisuales.",
    href: "/empresas#solicitar",
    action: "Ver formulario B2B demo",
  },
];

export default function ServicesPage() {
  return (
    <main className="page-wrap">
      <p className="eyebrow">SERVICIOS · DEMOSTRACIÓN ACADÉMICA</p>
      <h1 className="page-title">La tecnología también<br />necesita criterio<span className="title-period">.</span></h1>
      <p className="page-intro">
        NODRIA es una empresa ficticia. Esta página presenta capacidades de software que puedes explorar,
        no servicios que se puedan contratar ni trabajos que se vayan a ejecutar.
      </p>
      <div className="service-catalog-grid">
        {services.map(({ icon: Icon, title, copy, href, action }, index) => (
          <article className="service-catalog-card" key={title}>
            <span className="service-catalog-index">0{index + 1} / DEMO</span>
            <span className="category-symbol"><Icon size={19} /></span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <Link href={href}>{action} <ArrowRight size={13} /></Link>
          </article>
        ))}
      </div>
      <section className="service-bottom-cta">
        <div>
          <p className="eyebrow">PRUEBA UN FLUJO</p>
          <h2>Configura un equipo ficticio.</h2>
        </div>
        <Link className="button button--accent" href="/configurador">Abrir PC Builder <ArrowRight size={14} /></Link>
      </section>
      <p className="legal-demo-note">
        Los formularios de soporte y solicitud B2B solo guardan datos de demostración en el entorno local.
        No introduzcas información personal real.
      </p>
    </main>
  );
}
