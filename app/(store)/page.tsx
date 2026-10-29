import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Cpu, Layers, Network, Radio, Server, ShieldCheck, ShoppingBag, Smartphone } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ConnectedProductCard } from "@/components/storefront/connected-product-card";
import { formatPrice, type Product } from "@/lib/catalog";
import { getCatalogData, getCatalogSourceNotice } from "@/lib/catalog-repository";
import { getHomepageMerchandising, productHref } from "@/lib/content/merchandising";

// Fetch the active source at request time, including after a catalogue read failure.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Especialistas en Telecomunicaciones, Redes e Industria Digital",
  description: "Equipamiento profesional para infraestructuras de telecomunicaciones, fibra óptica, redes corporativas, domótica y telefonía IP en NODRIA.",
};

const categoryIcons: Record<string, typeof Network> = {
  "Infraestructuras de Telecomunicaciones": Server,
  "Equipos y Sistemas de Telecomunicaciones": Network,
  "Domótica y Hogar Digital": Radio,
  "Telefonía y Comunicaciones": Smartphone,
  "Digitalización e Industria Conectada": Cpu,
};

function ProductSelection({ products, demo }: { products: Product[]; demo: boolean }) {
  return (
    <div className="product-grid">
      {products.map((product, index) =>
        demo ? (
          <ProductCard key={product.id} product={product} index={index} />
        ) : (
          <ConnectedProductCard key={product.id} product={product} index={index} />
        ),
      )}
    </div>
  );
}

export default async function HomePage() {
  const data = await getCatalogData();
  if (data.source === "error") {
    return (
      <main className="page-wrap">
        <h1 className="page-title">El catálogo no está disponible.</h1>
        <p className="page-intro" role="alert">{data.message}</p>
        <p className="page-intro">La tienda no puede cargar ahora mismo. Vuelve a intentarlo en unos minutos.</p>
        <form action="/" method="get">
          <button className="button button--dark" type="submit">
            Volver a intentar cargar la portada <ArrowRight aria-hidden="true" size={15} />
          </button>
        </form>
        <p>
          <Link className="section-link" href="/catalogo">
            Abrir el catálogo <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </p>
      </main>
    );
  }

  const { hero, featured, discoveries, categories, campaign, totalProducts, hasExplicitNovelties } = getHomepageMerchandising(data);
  const demo = data.source === "demo";
  const sourceNotice = getCatalogSourceNotice(data.source);

  return (
    <main>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-ring" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <h1 id="home-title">
              Telecomunicaciones y redes,<br />
              <em>con criterio profesional.</em>
            </h1>
            <p>
              Equipamiento especializado para infraestructuras de telecomunicaciones, cableado estructurado Cat.6A/Cat.7, fibra óptica preconectorizada, switches L2/L3, domótica Matter y telefonía IP corporativa.
            </p>
            <p role="status">{sourceNotice}</p>
            <div className="hero-actions" style={{ flexWrap: "wrap" }}>
              <Link className="button button--accent" href="/catalogo">
                Explorar catálogo técnico <ArrowRight aria-hidden="true" size={15} />
              </Link>
              <Link className="hero-text-link" href="/empresas">
                Portal y cotizaciones para empresas <ArrowUpRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <div className="hero-trust" aria-label="Garantías del catálogo">
              <div>
                <strong>Stock en tienda</strong>
                <span>ENVÍOS EN 24/48 HORAS</span>
              </div>
              <span className="trust-separator" aria-hidden="true" />
              <div>
                <strong>Marcas oficiales</strong>
                <span>FABRICANTES LÍDERES</span>
              </div>
              <span className="trust-separator" aria-hidden="true" />
              <div>
                <strong>Soporte técnico</strong>
                <span>CONSULTORÍA ESPECIALIZADA</span>
              </div>
            </div>
          </div>
          <div className="hero-art">
            {hero ? (
              <Link className="hero-device" href={productHref(hero)} aria-label={`Ver la ficha de ${hero.name}`}>
                {hero.image ? (
                  <Image
                    src={hero.image}
                    alt={hero.imageAlt || hero.name}
                    fill
                    sizes="(max-width: 760px) calc(100vw - 38px), (max-width: 1100px) 46vw, 42vw"
                    loading="eager"
                    fetchPriority="high"
                    unoptimized
                  />
                ) : (
                  <span className="sr-only">Imagen no disponible</span>
                )}
                <div className="device-frame" aria-hidden="true" />
                <div className="hero-product-callout" style={{ right: 24, overflowWrap: "anywhere" }}>
                  <span>{hero.category} · EQUIPO PROFESIONAL</span>
                  <strong>{hero.name}</strong>
                  {!hero.image && <small>Imagen no disponible</small>}
                  <small>Disponible en NODRIA · {formatPrice(hero.price)}</small>
                </div>
              </Link>
            ) : (
              <div className="hero-device">
                <div className="hero-product-callout">
                  <strong>Aún no hay productos publicados.</strong>
                  <small>Vuelve al catálogo más adelante.</small>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="section-shell">
        <section className="service-strip" aria-label="Servicios de NODRIA">
          <div className="service-point">
            <span className="service-icon"><Server aria-hidden="true" size={16} /></span>
            <div>
              <strong>Catálogo NODRIA</strong>
              <span>{totalProducts} {totalProducts === 1 ? "producto" : "productos"}</span>
            </div>
          </div>
          <div className="service-point">
            <span className="service-icon"><Network aria-hidden="true" size={16} /></span>
            <div>
              <strong>Redes y Fibra</strong>
              <span>Infraestructuras certificadas</span>
            </div>
          </div>
          <div className="service-point">
            <span className="service-icon"><Layers aria-hidden="true" size={16} /></span>
            <div>
              <strong>PC Builder</strong>
              <span>Estaciones y servidores</span>
            </div>
          </div>
          <div className="service-point">
            <span className="service-icon"><ShieldCheck aria-hidden="true" size={16} /></span>
            <div>
              <strong>Garantía oficial</strong>
              <span>Soporte directo B2C / B2B</span>
            </div>
          </div>
        </section>
      </div>

      <section className="category-section section-shell" aria-labelledby="home-categories">
        <div className="section-heading-row">
          <div>
            <h2 id="home-categories">Explora las áreas técnicas.</h2>
            <p>Infraestructura física, conmutación gestionada, domótica avanzada, comunicaciones unificadas y digitalización en planta.</p>
          </div>
          <Link className="section-link" href="/catalogo">
            Ver catálogo completo <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
        {categories.length ? (
          <div className="category-grid">
            {categories.map((category) => {
              const Icon = categoryIcons[category.name] ?? ShoppingBag;
              return (
                <Link href={category.href} className="category-card" key={category.id}>
                  <span className="category-symbol">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
                  </span>
                  <strong>{category.name}</strong>
                  <span>{category.description}</span>
                  <small className="category-count">
                    {category.count} {category.count === 1 ? "referencia" : "referencias"} · Explorar <ArrowUpRight aria-hidden="true" size={11} />
                  </small>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="catalog-empty">
            <strong>No hay categorías con productos para explorar.</strong>
            <p>La selección aparecerá cuando el catálogo tenga fichas publicadas.</p>
            <Link href="/catalogo">Consultar el catálogo</Link>
          </div>
        )}
      </section>

      {featured.length > 0 && (
        <section className="featured-section" aria-labelledby="home-featured">
          <div className="section-shell">
            <div className="section-heading-row">
              <div>
                <h2 id="home-featured">Destacados del catálogo.</h2>
                <p>Equipos profesionales seleccionados por rendimiento, fiabilidad y disponibilidad inmediata.</p>
              </div>
              <Link className="section-link" href="/catalogo">
                Ver todos los productos <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <ProductSelection products={featured} demo={demo} />
          </div>
        </section>
      )}

      {campaign && (
        <section className="showcase-banner section-shell" aria-labelledby="home-campaign">
          <div className="showcase-copy">
            <h2 id="home-campaign">{campaign.title}</h2>
            <p>{campaign.description}</p>
            <Link className="button button--accent" href={campaign.href}>
              Explorar selección técnica <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(24px, 4vw, 48px)", minWidth: 0 }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {campaign.products.map((product) => (
                <li key={product.id} style={{ borderBottom: "1px solid #4f705d" }}>
                  <Link
                    href={productHref(product)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "20px 0", overflowWrap: "anywhere" }}
                  >
                    <span>
                      <small style={{ display: "block", color: "#becbc0", marginBottom: 6 }}>
                        {product.category} · {product.brand}
                      </small>
                      <strong>{product.name}</strong>
                      <small style={{ display: "block", color: "#becbc0", marginTop: 6 }}>
                        Precio NODRIA · {formatPrice(product.price)}
                      </small>
                    </span>
                    <ArrowUpRight aria-hidden="true" size={18} style={{ flexShrink: 0 }} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {discoveries.length > 0 && (
        <section className="featured-section" aria-labelledby="home-discoveries">
          <div className="section-shell">
            <div className="section-heading-row">
              <div>
                <h2 id="home-discoveries">
                  {hasExplicitNovelties ? "Novedades y equipamiento técnico." : "Más equipamiento por descubrir."}
                </h2>
                <p>
                  Soluciones tecnológicas contrastadas para instaladores, integradores de sistemas y departamentos de TI.
                </p>
              </div>
              <Link className="section-link" href="/catalogo">
                Seguir explorando <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <ProductSelection products={discoveries} demo={demo} />
          </div>
        </section>
      )}

      <section className="proof-section section-shell" aria-labelledby="home-demo">
        <div className="section-heading-row">
          <div>
            <h2 id="home-demo">Una plataforma tecnológica completa.</h2>
            <p>
              Catálogo técnico en tiempo real, configurador de estaciones de trabajo, cotizaciones para empresas y compras conectadas en NODRIA.
            </p>
          </div>
          <Link className="section-link" href="/envios">
            Cómo funciona la tienda <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
        <div className="story-link-row" style={{ flexWrap: "wrap", gap: 24 }}>
          <Link className="section-link" href="/configurador">
            Probar el PC Builder <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
          <Link className="section-link" href="/empresas">
            Probar el portal para empresas <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
