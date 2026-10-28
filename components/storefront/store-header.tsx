import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/storefront/brand-mark";
import { SearchBox } from "@/components/storefront/search-box";
import { CartLink } from "@/components/storefront/store-interactions";

const demoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function StoreHeader() {
  return (
    <>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <div className="announcement-bar" id="page-top">
        <span className="announcement-dot" />
        <span>Conocimiento técnico. Atención especializada en telecomunicaciones.</span>
        <Link href="/empresas">Descubre NODRIA Empresas <ArrowUpRight size={13} /></Link>
      </div>
      {demoMode && (
        <div className="demo-ribbon" role="status">
          <span>ENTORNO DE DEMOSTRACIÓN TÉCNICA</span>
          <span>Los pagos son simulados. No introduzcas datos bancarios reales.</span>
        </div>
      )}
      <header className="site-header">
        <div className="header-main">
          <BrandMark />
          <nav aria-label="Navegación principal" className="primary-nav">
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/categorias">Categorías</Link>
            <Link href="/configurador">PC Builder <span className="nav-new">PRO</span></Link>
            <Link href="/empresas">Empresas</Link>
          </nav>
          <SearchBox />
          <div className="header-actions">
            <Link aria-label="Mis favoritos" className="header-icon-button" href="/favoritos"><span className="heart-glyph">♡</span></Link>
            <Link aria-label="Mi espacio" className="account-link" href="/mi-cuenta">Mi espacio</Link>
            <CartLink />
          </div>
        </div>
        <div className="header-subnav">
          <span className="subnav-label">EXPLORA</span>
          <Link className="mobile-nav-link" href="/catalogo">Catálogo</Link>
          <Link href="/catalogo?categoria=infraestructuras-telecomunicaciones">Infraestructuras</Link>
          <Link href="/catalogo?categoria=equipos-sistemas-telecomunicaciones">Equipos y Redes</Link>
          <Link href="/catalogo?categoria=domotica-hogar-digital">Hogar Digital</Link>
          <Link href="/catalogo?categoria=telefonia-comunicaciones">Telefonía</Link>
          <Link href="/catalogo?categoria=digitalizacion-industria-conectada">Industria 4.0</Link>
          <Link className="mobile-nav-link" href="/configurador">PC Builder</Link>
          <Link href="/marcas">Marcas</Link>
          <Link className="mobile-nav-link" href="/empresas">Empresas</Link>
          <Link className="mobile-nav-link" href="/mi-cuenta">Mi espacio</Link>
          <span className="subnav-spacer" />
          <Link href="/backoffice" className="team-link">Portal equipo <ArrowUpRight size={13} /></Link>
        </div>
      </header>
      <span className="skip-target" id="main-content" tabIndex={-1}>Inicio del contenido principal</span>
    </>
  );
}
