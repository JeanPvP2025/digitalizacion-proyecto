import Link from "next/link";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/storefront/brand-mark";

export function StoreFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand-block">
          <BrandMark />
          <p>Tecnología con sentido.<br />Y personas detrás de cada respuesta.</p>
          <span className="footer-location"><i /> Madrid · España · 40°25′ N</span>
        </div>
        <div className="footer-column"><span className="footer-heading">EXPLORA</span><Link href="/catalogo">Tienda</Link><Link href="/categorias">Categorías</Link><Link href="/marcas">Marcas</Link><Link href="/campanas">Selecciones</Link><Link href="/configurador">PC Builder</Link><Link href="/empresas">Empresas</Link><Link href="/servicios">Servicios</Link><Link href="/guias">Guías</Link><Link href="/blog">Blog</Link></div>
        <div className="footer-column"><span className="footer-heading">TE ACOMPAÑAMOS</span><Link href="/mi-cuenta">Mi espacio</Link><Link href="/soporte">Soporte</Link><Link href="/envios">Envíos y devoluciones</Link><Link href="/garantia">Garantía</Link></div>
        <div className="footer-note-card"><span>LA TECNOLOGÍA CAMBIA.</span><strong>El criterio<br />permanece.</strong><Link href="/empresas">Hablemos de tu proyecto <ArrowUpRight size={15} /></Link></div>
      </div>
      <div className="footer-bottom"><span>© 2026 NODRIA Tecnología S.L. · Empresa ficticia creada con fines académicos.</span><div><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/condiciones">Condiciones</Link><Link href="/legal/cookies">Cookies</Link></div><Link className="back-top" href="#page-top">VOLVER ARRIBA <ArrowUp aria-hidden="true" size={12} /></Link></div>
    </footer>
  );
}
