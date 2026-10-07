import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, AudioLines, Cpu, HardDrive, Laptop, Network, PanelsTopLeft, ShieldCheck, ShoppingBag } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { categories, demoProducts, formatPrice } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Tecnología con sentido",
  description: "Explora el catálogo, el PC Builder y el checkout de demostración de NODRIA. Productos, precios y estados ficticios; sin ventas, envíos ni pagos reales.",
};

const categoryIcons = [Laptop, Cpu, PanelsTopLeft, Network, AudioLines, HardDrive];

const demoNotes = [
  { title: "Catálogo", text: "Los productos, precios, existencias y promociones son datos ficticios." },
  { title: "Valoraciones", text: "Las puntuaciones son ejemplos; no proceden de compras reales." },
  { title: "Reseñas", text: "Los textos de opinión son ficticios y no pertenecen a clientes." },
];

export default function HomePage() {
  const featuredProducts = demoProducts.filter((product) => product.featured).slice(0, 4);
  return (
    <main>
      <section className="home-hero">
        <div className="hero-ring" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-kicker"><i /> DEMOSTRACIÓN ACADÉMICA <span>— NODRIA</span></div>
            <h1>Lo que viene,<br /><em>bien elegido.</em></h1>
            <p>Recorre un catálogo de ejemplo y prueba una configuración de PC. Los productos, precios y estados de compra son ficticios.</p>
            <div className="hero-actions">
              <Link className="button button--accent" href="/catalogo">Explorar el catálogo demo <ArrowRight size={15} /></Link>
              <Link className="hero-text-link" href="/empresas">Probar el flujo para empresas <ArrowUpRight size={14} /></Link>
            </div>
            <div className="hero-trust" aria-label="Alcance de la demostración">
              <div><strong>Fichas demo</strong><span>PRODUCTOS Y PRECIOS DE EJEMPLO</span></div><span className="trust-separator" />
              <div><strong>PC Builder</strong><span>COMPATIBILIDAD ORIENTATIVA</span></div><span className="trust-separator" />
              <div><strong>Checkout</strong><span>SIN COBROS REALES</span></div>
            </div>
          </div>
          <div className="hero-art" aria-label="Ficha de ejemplo del FluxBook 14 Pro">
            <div className="hero-index"><b>01</b> / FICHA DEMO</div>
            <div className="hero-device">
              <Image
                src={demoProducts[0].image}
                alt={demoProducts[0].imageAlt}
                fill
                sizes="(max-width: 760px) calc(100vw - 38px), (max-width: 1100px) 46vw, 42vw"
                loading="eager"
                fetchPriority="high"
              />
              <div className="device-frame" />
              <div className="device-coordinate">NODRIA / PRODUCTO FICTICIO</div>
              <div className="hero-product-callout"><span>FLUXBOOK 14 PRO · EJEMPLO</span><strong>Vista de<br />demostración.</strong><small>Precio demo · {formatPrice(demoProducts[0].price)}</small></div>
            </div>
            <div className="hero-float-card"><span>PRODUCTO DE EJEMPLO</span><strong>01 / 06</strong><small>Ficha ficticia</small></div>
            <div className="hero-side-label">42° 21′ 07.2″ N · 03° 42′ 12.0″ W</div>
          </div>
        </div>
      </section>

      <div className="section-shell">
        <section className="service-strip" aria-label="Funciones de la demostración">
          <div className="service-point"><span className="service-icon"><Laptop size={16} /></span><div><strong>Catálogo ficticio</strong><span>Productos y precios de ejemplo</span></div></div>
          <div className="service-point"><span className="service-icon"><Cpu size={16} /></span><div><strong>PC Builder</strong><span>Comprobaciones orientativas</span></div></div>
          <div className="service-point"><span className="service-icon"><ShoppingBag size={16} /></span><div><strong>Carrito de prueba</strong><span>Para recorrer el flujo</span></div></div>
          <div className="service-point"><span className="service-icon"><ShieldCheck size={16} /></span><div><strong>Checkout simulado</strong><span>Sin tarjeta ni cobros</span></div></div>
        </section>
      </div>

      <section className="category-section section-shell">
        <div className="section-heading-row"><div><p className="eyebrow">RECORRIDO DE LA DEMO</p><h2>Explora las categorías.</h2><p>El catálogo y sus cifras son ejemplos ficticios.</p></div><Link className="section-link" href="/catalogo">Ver catálogo demo <ArrowRight size={14} /></Link></div>
        <div className="category-grid">
          {categories.map((category, index) => {
            const Icon = categoryIcons[index];
            const hasDemoProducts = demoProducts.some((product) => product.category === category.name);
            const isEmptyComponentCategory = category.code === "componentes" && !hasDemoProducts;
            const href = isEmptyComponentCategory ? "/configurador" : `/catalogo?categoria=${category.code}`;
            const description = isEmptyComponentCategory
              ? "El catálogo demo no tiene piezas sueltas. Prueba el configurador con fichas de ejemplo."
              : category.description;
            const linkLabel = isEmptyComponentCategory ? "Abrir PC Builder" : "Explorar categoría";
            return <Link href={href} className="category-card" key={category.code}><span className="category-symbol"><Icon size={18} strokeWidth={1.6} /></span><strong>{category.name}</strong><span>{description}</span><small className="category-count">{linkLabel} <ArrowUpRight size={11} /></small></Link>;
          })}
        </div>
      </section>

      <section className="featured-section">
        <div className="section-shell">
          <div className="section-heading-row"><div><p className="eyebrow">FICHAS DE DEMOSTRACIÓN</p><h2>Productos de muestra.</h2><p>Datos ficticios para recorrer las pantallas del catálogo.</p></div><Link className="section-link" href="/catalogo">Ver catálogo demo <ArrowRight size={14} /></Link></div>
          <div className="product-grid">{featuredProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>
        </div>
      </section>

      <section className="showcase-banner section-shell">
        <div className="showcase-copy"><p className="eyebrow">CONFIGURADOR DE PRUEBA</p><h2>Prueba el PC Builder.</h2><p>Selecciona piezas ficticias y revisa reglas orientativas de compatibilidad, consumo y precio. La configuración no representa inventario real.</p><Link className="button button--accent" href="/configurador">Abrir PC Builder <ArrowRight size={15} /></Link></div>
        <div className="showcase-art" aria-hidden="true"><div className="showcase-core" /><div className="builder-spec"><b>01 / CPU</b> &nbsp; 8 núcleos<br /><b>02 / GPU</b> &nbsp; 12 GB VRAM<br /><b>03 / PSU</b> &nbsp; 850 W · OK</div></div>
      </section>

      <section className="proof-section section-shell">
        <div className="section-heading-row"><div><p className="eyebrow">DATOS DE DEMOSTRACIÓN</p><h2>No hay reseñas reales.</h2><p>Las valoraciones y opiniones de esta interfaz son ficticias.</p></div><Link className="section-link" href="/envios">Ver límites de la demo <ArrowRight size={14} /></Link></div>
        <div className="proof-grid">{demoNotes.map((note) => <article className="proof-card" key={note.title}><strong>{note.title}</strong><p>{note.text}</p></article>)}</div>
        <div className="story-link-row"><Link className="section-link" href="/empresas">Probar el formulario para empresas <ArrowUpRight size={14} /></Link></div>
      </section>
    </main>
  );
}
