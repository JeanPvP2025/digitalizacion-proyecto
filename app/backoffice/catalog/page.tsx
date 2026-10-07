import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Boxes, CircleAlert } from "lucide-react";
import { getCatalogAdminAccess } from "@/lib/catalog/admin/access";
import { listCatalogAdminProducts } from "@/lib/catalog/admin/data";
import type { CatalogAdminProduct } from "@/lib/catalog/admin/contracts";
import { CatalogProductEditor } from "./product-editor";
import styles from "./catalog.module.css";

export const metadata: Metadata = {
  title: "Gestión de catálogo · NODRIA Operaciones",
  description: "Edición de contenido editorial de productos NODRIA.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function AccessState({ status }: { status: "not_configured" | "forbidden" | "error" }) {
  const messages = {
    not_configured: ["Catálogo conectado no disponible", "La gestión requiere un proyecto Supabase conectado. No se muestran ni guardan datos de demo."],
    forbidden: ["Acceso restringido", "Esta superficie requiere un grant persistido catalog_manager o super_admin."],
    error: ["No se pudo comprobar el acceso", "La consulta de roles falló. No se han mostrado productos; vuelve a intentarlo."],
  } as const;
  const [title, body] = messages[status];
  return <section className={styles.statePanel} role={status === "error" ? "alert" : "status"}><CircleAlert size={20} aria-hidden="true" /><div><h2>{title}</h2><p>{body}</p></div></section>;
}

function CatalogHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.backLink} href="/backoffice"><ArrowLeft size={15} aria-hidden="true" /> Volver a operaciones</Link>
      <p className={styles.eyebrow}>NODRIA / CONTENIDO DE PRODUCTO</p>
      <div className={styles.titleLine}><h1>Gestión de catálogo<span>.</span></h1><span className={styles.roleLabel}>CATALOG MANAGER</span></div>
      <p className={styles.intro}>Corrige nombres, textos e imágenes de las fichas. Cada cambio pasa por la RPC segura de catálogo y conserva los permisos de tu sesión.</p>
      <div className={styles.scopeNote}><span aria-hidden="true">i</span><p>Solo contenido editorial. El estado de publicación, los precios, las variantes y las valoraciones no se editan aquí.</p></div>
    </header>
  );
}

function matchesQuery(product: CatalogAdminProduct, query: string): boolean {
  if (!query) return true;
  return [product.name, product.brand, product.sku, product.slug, product.id]
    .some((value) => value.toLocaleLowerCase("es-ES").includes(query));
}

async function CatalogContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q).trim().slice(0, 100);
  const normalizedQuery = query.toLocaleLowerCase("es-ES");
  const status = firstValue(params.status);
  const statusFilter = status === "published" || status === "draft" ? status : "all";
  const access = await getCatalogAdminAccess();

  if (access.status === "unauthenticated") redirect("/acceso?next=%2Fbackoffice%2Fcatalog");
  if (access.status !== "ready") return <><CatalogHeader /><AccessState status={access.status} /></>;

  const snapshot = await listCatalogAdminProducts(access.supabase);
  if (snapshot.status === "error") {
    return <><CatalogHeader /><section className={styles.statePanel} role="alert"><CircleAlert size={20} aria-hidden="true" /><div><h2>No se pudo cargar el catálogo</h2><p>La consulta de productos ha fallado. No se han usado datos de demo como sustituto.</p><Link href="/backoffice/catalog">Volver a cargar</Link></div></section></>;
  }

  const visibleProducts = snapshot.products.filter((product) =>
    (statusFilter === "all" || product.is_published === (statusFilter === "published")) && matchesQuery(product, normalizedQuery));

  return (
    <>
      <CatalogHeader />
      <section className={styles.catalogPanel} aria-labelledby="products-title">
        <div className={styles.panelHeading}>
          <div><p className={styles.panelEyebrow}>FICHAS DE PRODUCTO</p><h2 id="products-title">Contenido editorial <span>{visibleProducts.length}</span></h2></div>
          <span className={styles.sourceBadge}><i aria-hidden="true" /> LECTURA CON SESIÓN · RLS</span>
        </div>
        <form className={styles.filters} action="/backoffice/catalog" method="get" role="search">
          <label className={styles.searchField}><span className={styles.srOnly}>Buscar producto por nombre, marca o SKU</span><input type="search" name="q" maxLength={100} placeholder="Nombre, marca, slug o SKU" defaultValue={query} /></label>
          <label className={styles.statusField}><span>Estado</span><select name="status" defaultValue={statusFilter}><option value="all">Todos</option><option value="published">Publicados</option><option value="draft">Borradores</option></select></label>
          <button type="submit">Filtrar</button>
          {(query || statusFilter !== "all") && <Link href="/backoffice/catalog">Limpiar</Link>}
        </form>

        {snapshot.truncated && <p className={styles.limitNote}>Se muestran como máximo 500 productos. Afina la búsqueda para encontrar una ficha fuera de esta lista.</p>}
        {visibleProducts.length ? (
          <div className={styles.productList}>
            {visibleProducts.map((product) => <CatalogProductEditor key={product.id} product={product} />)}
          </div>
        ) : (
          <div className={styles.emptyState}><Boxes size={22} aria-hidden="true" /><h3>{snapshot.products.length ? "No hay coincidencias" : "El catálogo está vacío"}</h3><p>{snapshot.products.length ? "Prueba con otro nombre, marca o SKU, o cambia el estado seleccionado." : "No hay productos visibles para este rol en la base de datos conectada."}</p></div>
        )}
        <footer className={styles.panelFooter}><span><i aria-hidden="true" /> Sin edición de publicación ni de datos comerciales</span><small>Los permisos de filas los vuelve a comprobar PostgreSQL</small></footer>
      </section>
    </>
  );
}

export default async function CatalogAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  return <main className={styles.page}><CatalogContent searchParams={searchParams} /></main>;
}

