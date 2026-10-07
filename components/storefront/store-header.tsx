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
        <span>Conocimiento técnico. Atención humana.</span>
        <Link href="/empresas">Descubre NODRIA Empresas <ArrowUpRight size={13} /></Link>
      </div>
      {demoMode && (
        <div className="demo-ribbon" role="status">
          <span>ENTORNO DE DEMOSTRACIÓN</span>
          <span>Los pagos son ficticios. No introduzcas datos bancarios.</span>
        </div>
      )}
      <header className="site-header">
        <div className="header-main">
          <BrandMark />
          <nav aria-label="Navegación principal" className="primary-nav">
            <Link href="/catalogo">Tienda</Link>
            <Link href="/catalogo?categoria=componentes">Componentes</Link>
            <Link href="/configurador">PC Builder <span className="nav-new">PRO</span></Link>
            <Link href="/empresas">Empresas</Link>
          </nav>
          <SearchBox />
          <div className="header-actions">
            <Link aria-label="Mis favoritos" className="header-icon-button" href="/favoritos"><span className="heart-glyph">♡</span></Link>
            <Link aria-label="Mi cuenta" className="account-link" href="/mi-cuenta">Mi espacio</Link>
            <CartLink />
          </div>
        </div>
        <div className="header-subnav">
          <span className="subnav-label">EXPLORA</span>
          <Link className="mobile-nav-link" href="/catalogo">Tienda</Link>
          <Link href="/catalogo?categoria=ordenadores">Ordenadores</Link>
          <Link href="/catalogo?categoria=componentes">Componentes</Link>
          <Link href="/catalogo?categoria=monitores">Monitores</Link>
          <Link href="/catalogo?categoria=redes">Redes</Link>
          <Link href="/catalogo?categoria=telefonia">Telefonía</Link>
          <Link href="/catalogo?categoria=almacenamiento">Almacenamiento</Link>
          <Link className="mobile-nav-link" href="/configurador">PC Builder</Link>
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
