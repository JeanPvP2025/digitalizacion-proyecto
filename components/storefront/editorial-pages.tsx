import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogData } from "@/lib/catalog-repository";
import {
  editorialCollections,
  editorialPath,
  formatEditorialDate,
  getEditorialArticle,
  getEditorialArticles,
  getRelatedEditorial,
  editorialReadingMinutes,
  resolveEditorialCommerce,
  type EditorialCollection,
} from "@/lib/content/editorial";
import styles from "./editorial-pages.module.css";

export function EditorialCollectionPage({ collection }: { collection: EditorialCollection }) {
  const details = editorialCollections[collection];
  const articles = getEditorialArticles(collection);

  return (
    <main className={`page-wrap ${styles.page}`}>
      <p className="eyebrow">NODRIA · {details.label.toUpperCase()}</p>
      <h1 className="page-title">{details.title}<span className="title-period">.</span></h1>
      <p className="page-intro">{details.description}</p>
      <div className={styles.articleGrid}>
        {articles.map((article) => (
          <article className={styles.articleCard} key={article.slug}>
            <p className={styles.meta}>{article.category} · {formatEditorialDate(article.publishedAt)} · {editorialReadingMinutes(article)} min</p>
            <h2><Link href={editorialPath(article)}>{article.title}</Link></h2>
            <p>{article.description}</p>
            <Link className={styles.readLink} href={editorialPath(article)}>Leer {collection === "guias" ? "la guía" : "el artículo"}<span aria-hidden="true"> →</span></Link>
          </article>
        ))}
      </div>
      <p className={styles.disclosure}>Contenido académico con ejemplos ficticios. No son análisis de laboratorio, recomendaciones de compra ni ofertas comerciales.</p>
    </main>
  );
}

export async function EditorialArticlePage({ collection, slug }: { collection: EditorialCollection; slug: string }) {
  const article = getEditorialArticle(collection, slug);
  if (!article) notFound();

  const catalog = await getCatalogData();
  const commerce = resolveEditorialCommerce(article, catalog);
  const related = getRelatedEditorial(article);
  const label = editorialCollections[collection].label;

  return (
    <main className={`page-wrap ${styles.page} ${styles.articlePage}`}>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href={`/${collection}`}>{label}</Link>
      </nav>
      <article>
        <header className={styles.articleHeader}>
          <p className="eyebrow">{label.toUpperCase()} · {article.category.toUpperCase()}</p>
          <h1 className="page-title">{article.title}<span className="title-period">.</span></h1>
          <p className="page-intro">{article.description}</p>
          <p className={styles.meta}>{article.author} · {formatEditorialDate(article.publishedAt)} · {editorialReadingMinutes(article)} min de lectura</p>
          <p className={styles.takeaway}><strong>Idea clave</strong><br />{article.takeaway}</p>
        </header>

        <div className={styles.articleBody}>
          {article.sections.map((section) => (
            <section key={section.id} aria-labelledby={`editorial-${section.id}`}>
              <h2 id={`editorial-${section.id}`}>{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}
              {section.checklist && <ul>{section.checklist.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
        </div>

        <section className={styles.references} aria-labelledby="editorial-references">
          <h2 id="editorial-references">Explora el catálogo relacionado</h2>
          {commerce.unavailable ? (
            <p role="status">El catálogo no está disponible ahora. El contenido editorial sigue visible; vuelve a intentarlo más tarde para consultar las fichas.</p>
          ) : (
            <>
              {commerce.products.length > 0 && <ul>{commerce.products.map((product) => <li key={product.id}><Link href={`/producto/${encodeURIComponent(product.slug)}`}>{product.name}</Link><span> · ejemplo ficticio; consulta la ficha vigente</span></li>)}</ul>}
              {commerce.categories.length > 0 && <p>{commerce.categories.map((category, index) => <span key={category.id}>{index > 0 && " · "}<Link href={`/catalogo?categoria=${encodeURIComponent(category.slug)}`}>{category.name}</Link></span>)}</p>}
              {!commerce.products.length && !commerce.categories.length && <p>No hay fichas relacionadas publicadas en el catálogo activo.</p>}
            </>
          )}
        </section>

        {related.length > 0 && <nav className={styles.related} aria-label="Lecturas relacionadas">
          <h2>Sigue leyendo</h2>
          <ul>{related.map((item) => <li key={`${item.collection}-${item.slug}`}><Link href={editorialPath(item)}>{item.title}</Link></li>)}</ul>
        </nav>}
      </article>
      <p className={styles.disclosure}>NODRIA es un proyecto académico. Las empresas, productos, precios, pedidos y procesos de esta demostración son ficticios.</p>
    </main>
  );
}
