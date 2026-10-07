import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Cable,
  ClipboardCheck,
  Headset,
  Laptop,
  Network,
  PackageCheck,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { BusinessQuoteForm } from "@/components/business/business-quote-form";
import styles from "@/components/business/business-page.module.css";

export const metadata: Metadata = {
  title: "Soluciones para empresas",
  description:
    "Equipamiento, infraestructura y acompañamiento técnico para empresas. Cuéntanos qué necesita tu equipo y solicita una propuesta a NODRIA.",
};

const services = [
  {
    number: "01",
    icon: Laptop,
    title: "Equipamiento de empresa",
    description:
      "Portátiles, puestos de trabajo, periféricos y renovación de parque con una configuración coherente para cada equipo.",
    tags: ["Puestos de trabajo", "Renovación", "Periféricos"],
  },
  {
    number: "02",
    icon: Network,
    title: "Redes e infraestructura",
    description:
      "Conectividad, Wi-Fi, switching, almacenamiento y servidores para que la base tecnológica acompañe el ritmo del negocio.",
    tags: ["Conectividad", "Wi-Fi", "Infraestructura"],
  },
  {
    number: "03",
    icon: Settings2,
    title: "Preparación y despliegue",
    description:
      "Montaje, configuración inicial y puesta en marcha según el alcance acordado para cada proyecto.",
    tags: ["Montaje", "Configuración", "Puesta en marcha"],
  },
  {
    number: "04",
    icon: Headset,
    title: "Acompañamiento técnico",
    description:
      "Orientación antes de comprar y un punto de contacto para resolver dudas sobre la solución seleccionada.",
    tags: ["Asesoramiento", "Continuidad", "Garantía"],
  },
];

const procurementSteps = [
  {
    number: "01",
    title: "Entendemos el contexto",
    description: "Uso, entorno, cantidades y calendario. Empezamos por la necesidad real.",
  },
  {
    number: "02",
    title: "Preparamos una propuesta",
    description: "Una selección técnica y económica que puedes revisar con tu equipo.",
  },
  {
    number: "03",
    title: "Validas la compra",
    description: "La propuesta queda clara para avanzar con las aprobaciones de tu organización.",
  },
  {
    number: "04",
    title: "Coordinamos la entrega",
    description: "Acordamos suministro y preparación en función del alcance del proyecto.",
  },
];

export default function BusinessPage() {
  return (
    <main className={styles.businessPage}>
      <section aria-labelledby="business-title" className={styles.hero}>
        <div aria-hidden="true" className={styles.heroGrid} />
        <div aria-hidden="true" className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              <span /> NODRIA PARA EMPRESAS <span className={styles.eyebrowIndex}>B2B / 01</span>
            </p>
            <h1 id="business-title">
              Tecnología que <em>trabaja</em> contigo.
            </h1>
            <p className={styles.heroLead}>
              Un equipo experto para equipar, conectar y hacer avanzar a tu empresa. Desde una renovación de puestos hasta un proyecto de infraestructura.
            </p>
            <div className={styles.heroActions}>
              <Link className={`${styles.heroPrimaryButton} button button--accent`} href="#solicitar">
                Solicitar propuesta <ArrowRight aria-hidden="true" size={15} />
              </Link>
              <Link className={styles.heroTextLink} href="/empresas/portal">
                Espacio de empresa <ArrowUpRight aria-hidden="true" size={14} />
              </Link>
              <Link className={styles.heroTextLink} href="/catalogo">
                Explorar tecnología <ArrowUpRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <div className={styles.heroSignals}>
              <div>
                <span className={styles.signalIcon}><ClipboardCheck aria-hidden="true" size={15} /></span>
                <span>Propuestas claras</span>
              </div>
              <div>
                <span className={styles.signalIcon}><ShieldCheck aria-hidden="true" size={15} /></span>
                <span>Criterio técnico</span>
              </div>
              <div>
                <span className={styles.signalIcon}><PackageCheck aria-hidden="true" size={15} /></span>
                <span>Compra coordinada</span>
              </div>
            </div>
          </div>

          <aside aria-label="Proceso de compra para empresas" className={styles.heroPanel}>
            <div className={styles.panelTopline}>
              <span>EL SIGUIENTE PASO, CLARO</span>
              <span className={styles.panelMark}>N / B2B</span>
            </div>
            <div className={styles.panelIntro}>
              <span className={styles.panelIcon}><Boxes aria-hidden="true" size={20} /></span>
              <div>
                <h2>Una mesa de compra para tecnología.</h2>
                <p>Personas y producto, conectados por un proceso sencillo.</p>
              </div>
            </div>
            <ol className={styles.heroSteps}>
              {procurementSteps.map((step, index) => (
                <li className={styles.heroStep} key={step.number}>
                  <span aria-hidden="true" className={styles.heroStepNumber}>{step.number}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                  {index < procurementSteps.length - 1 && <span aria-hidden="true" className={styles.stepConnector} />}
                </li>
              ))}
            </ol>
            <div className={styles.panelFooter}>
              <span><i /> ESPAÑA · ATENCIÓN EN ESPAÑOL</span>
              <ArrowDownRight aria-hidden="true" size={16} />
            </div>
          </aside>
        </div>
        <div aria-hidden="true" className={styles.heroCoordinate}>40° 25′ N&nbsp; / &nbsp;03° 42′ O</div>
      </section>

      <section aria-labelledby="services-title" className={styles.servicesSection}>
        <div className={styles.sectionShell}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>SOLUCIONES QUE ENCAJAN</p>
              <h2 id="services-title">La tecnología correcta,<br />para el trabajo real.</h2>
            </div>
            <p className={styles.sectionIntro}>
              Selección, preparación y acompañamiento en el mismo recorrido. Definimos el alcance contigo antes de proponer una solución.
            </p>
          </div>

          <div className={styles.serviceGrid}>
            {services.map(({ number, icon: Icon, title, description, tags }) => (
              <article className={styles.serviceCard} key={number}>
                <div className={styles.serviceCardTop}>
                  <span className={styles.serviceIcon}><Icon aria-hidden="true" size={18} strokeWidth={1.7} /></span>
                  <span className={styles.serviceNumber}>{number} / 04</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <ul aria-label={`Áreas de ${title}`} className={styles.serviceTags}>
                  {tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="workflow-title" className={styles.workflowSection}>
        <div className={styles.sectionShell}>
          <div className={styles.workflowHeader}>
            <div>
              <p className={styles.eyebrow}>COMPRAS SIN FRICCIÓN</p>
              <h2 id="workflow-title">De la necesidad<br />a una compra bien resuelta.</h2>
            </div>
            <p>Un flujo transparente que ayuda a compras, IT y a las personas que usarán la tecnología a tomar la misma decisión.</p>
          </div>
          <ol className={styles.workflowList}>
            {procurementSteps.map((step) => (
              <li className={styles.workflowStep} key={step.number}>
                <span className={styles.workflowNumber}>{step.number}</span>
                <div className={styles.workflowStepBody}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                <Cable aria-hidden="true" className={styles.workflowIcon} size={18} strokeWidth={1.5} />
              </li>
            ))}
          </ol>
          <div className={styles.workflowNote}>
            <span className={styles.noteIcon}><ShieldCheck aria-hidden="true" size={16} /></span>
            <p><strong>Sin sorpresas.</strong> Las cantidades, configuración, servicios y condiciones se recogen en la propuesta antes de avanzar.</p>
            <Link href="#solicitar">Cuéntanos qué necesitas <ArrowRight aria-hidden="true" size={14} /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="quote-title" className={styles.quoteSection} id="solicitar">
        <div className={styles.quoteShell}>
          <div className={styles.quoteAside}>
            <p className={styles.eyebrow}>EMPECEMOS POR TU PROYECTO</p>
            <h2 id="quote-title">Cuéntanos qué necesita tu equipo.</h2>
            <p className={styles.quoteLead}>
              Comparte el contexto básico y el volumen aproximado. Nuestro equipo podrá revisar tu solicitud y preparar el siguiente paso.
            </p>
            <div className={styles.quoteContactCard}>
              <span className={styles.contactIcon}><Headset aria-hidden="true" size={18} /></span>
              <div>
                <strong>Un interlocutor, desde el inicio.</strong>
                <span>La solicitud queda registrada para su revisión comercial.</span>
              </div>
            </div>
            <div className={styles.quoteDetail}>
              <span>01</span><p>Indica el alcance aproximado, aunque todavía esté por definir.</p>
            </div>
            <div className={styles.quoteDetail}>
              <span>02</span><p>Incluye las necesidades técnicas o de calendario que ya conozcas.</p>
            </div>
            <Link className={styles.quoteCatalogLink} href="/catalogo">
              Ver categorías de producto <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </div>
          <BusinessQuoteForm />
        </div>
      </section>

      <section aria-label="Contacto para proyectos empresariales" className={styles.closingBand}>
        <div className={styles.closingInner}>
          <div><p>NODRIA EMPRESAS <span>·</span> TECNOLOGÍA CON CRITERIO</p><h2>Tu siguiente paso empieza con una conversación.</h2></div>
          <Link className="button button--dark" href="#solicitar">Hablemos del proyecto <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
      </section>
    </main>
  );
}
