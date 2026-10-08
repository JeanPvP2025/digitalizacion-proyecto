import Link from "next/link";
import { Check, Search, X } from "lucide-react";
import type { CatalogData } from "@/lib/catalog-mapping";
import { getCatalogSourceNotice } from "@/lib/catalog-repository";
import { ProductCard } from "@/components/storefront/product-card";
import { ConnectedProductCard } from "@/components/storefront/connected-product-card";
import { formatPrice } from "@/lib/catalog";
import { SEARCH_QUERY_MAX_LENGTH } from "@/lib/search";
import { availabilityLabel, catalogHref, changeCatalogParam, clearCatalogFilters, discoverCatalog, toCatalogParams, type CatalogParams, type FacetOption } from "./discovery";
import styles from "./catalog.module.css";

function HiddenParams({ params, except }: { params: URLSearchParams; except: string[] }) {
  return [...params.entries()].filter(([key]) => !except.includes(key)).map(([key, value], index) => <input key={`${key}-${index}`} type="hidden" name={key} value={value} />);
}

function FacetLink({ label, option, href, category = false }: { label: string; option: FacetOption; href: string; category?: boolean }) {
  const content = <><span aria-hidden="true" className={styles.check}>{option.selected && <Check size={12} />}</span><span className={styles.optionLabel}>{label}</span><small>{option.count}</small></>;
  if (!option.count && !option.selected) return <span className={`${styles.option} ${styles.unavailable}`} aria-disabled="true">{content}<span className="sr-only">Sin coincidencias con los filtros actuales</span></span>;
  return <Link aria-current={option.selected ? "true" : undefined} aria-label={`${option.selected ? "Quitar" : category ? "Ver categoría" : "Añadir filtro"} ${label}, ${option.count} ${option.count === 1 ? "producto" : "productos"}`} className={`${styles.option} ${option.selected ? styles.selected : ""}`} href={href} scroll={false} prefetch={false}>{content}</Link>;
}

export function CatalogView({ data, rawParams }: { data: CatalogData; rawParams: CatalogParams }) {
  const params = toCatalogParams(rawParams);
  if (data.source === "error") return (
    <main className="page-wrap catalog-page">
      <nav className="eyebrow" aria-label="Ruta de navegación"><Link href="/">INICIO</Link><span>/</span><span>CATÁLOGO</span></nav>
      <h1 className="page-title">Catálogo no disponible<span className="title-period">.</span></h1>
      <p className="page-intro" role="alert">{data.message}</p>
      <a className="button button--dark" href={catalogHref(params)}>Volver a intentarlo</a>
    </main>
  );
  const model = discoverCatalog(data.products, data.categories, params, data.source);
  const sourceNotice = getCatalogSourceNotice(data.source);
  const hasFilters = model.selections.some((item) => item.key !== "q");
  return (
    <main className={`page-wrap catalog-page ${styles.page}`}>
      <nav className="eyebrow" aria-label="Ruta de navegación"><Link href="/">INICIO</Link><span>/</span><span>CATÁLOGO</span></nav>
      <h1 className="page-title">Tecnología para lo que sigue<span className="title-period">.</span></h1>
      <p className="page-intro">Una selección cuidada de equipos, componentes y soluciones para cada forma de trabajar, crear y conectar.</p>
      {sourceNotice && <p className={styles.source}>{sourceNotice}</p>}
      <div className={styles.toolbar}>
        <form action="/catalogo" method="get" key={params.toString()}>
          <div className={styles.search}>
            <label htmlFor="catalog-search">Buscar en el catálogo</label>
            <input id="catalog-search" name="q" type="search" maxLength={SEARCH_QUERY_MAX_LENGTH} placeholder="Producto, SKU o característica" defaultValue={model.query} />
          </div>
          <HiddenParams params={params} except={["q", "orden"]} />
          <div className={styles.sort}>
            <label htmlFor="catalog-sort">Ordenar productos</label>
            <select id="catalog-sort" name="orden" defaultValue={model.sort}>
              <option value="recomendados">Orden recomendado</option>
              <option value="precio-asc">Precio: menor a mayor</option>
              <option value="precio-desc">Precio: mayor a menor</option>
              {data.source === "demo" && <option value="mejor-valorados">Mejor valorados · demo</option>}
            </select>
          </div>
          <button className={`button button--dark ${styles.apply}`} type="submit" aria-label="Aplicar búsqueda y orden"><Search size={16} aria-hidden="true" />Aplicar</button>
        </form>
        <span className={styles.count} role="status" aria-live="polite" aria-atomic="true">{model.results.length} {model.results.length === 1 ? "resultado" : "resultados"}</span>
      </div>
      {model.notices.map((notice) => <p key={notice} className={styles.notice} role="status">{notice}</p>)}
      {model.selections.length > 0 && <nav className={styles.selections} aria-label="Selecciones del catálogo">
        {model.selections.map((item) => {
          const multiple = item.key === "marca" || item.key.startsWith("spec.");
          return <Link key={`${item.key}-${item.value}`} href={changeCatalogParam(params, item.key, multiple ? item.value : null, multiple)} scroll={false} prefetch={false} aria-label={`Quitar ${item.label}`} className={styles.chip}>{item.label}<X size={12} aria-hidden="true" /></Link>;
        })}
        {hasFilters && <Link className={styles.clear} href={clearCatalogFilters(params)} scroll={false} prefetch={false}>Limpiar filtros</Link>}
      </nav>}
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Filtros del catálogo">
          <details open className={styles.filters}>
            <summary>Filtrar catálogo</summary>
            <div className={styles.filterContent}>
              <section className={styles.group} aria-labelledby="catalog-categories">
                <h2 id="catalog-categories">Categoría</h2>
                <FacetLink category label="Todas" option={{ value: "", count: model.allCategoryCount, selected: !model.categorySlug }} href={changeCatalogParam(params, "categoria", null)} />
                {model.categoryOptions.map((category) => <div key={category.id} style={{ paddingInlineStart: `${Math.min(category.depth, 4) * 12}px` }}><FacetLink category label={category.name} option={{ value: category.slug, count: category.count, selected: category.selected }} href={changeCatalogParam(params, "categoria", category.selected ? null : category.slug)} /></div>)}
                <p className={styles.hint}>Cambiar categoría restablece los filtros técnicos.</p>
              </section>
              {(model.priceRange || params.has("min") || params.has("max")) && <form className={styles.group} action="/catalogo" method="get" key={`price-${params.toString()}`}>
                <fieldset className={styles.price}>
                  <legend>Precio · EUR{data.source === "demo" ? " · demo" : ""}</legend>
                  {model.priceRange && <p className={styles.hint}>En esta selección: {formatPrice(model.priceRange.min)} – {formatPrice(model.priceRange.max)}</p>}
                  <HiddenParams params={params} except={["min", "max"]} />
                  <div className={styles.priceInputs}>
                    <label>Desde<input name="min" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={model.min ?? ""} placeholder="Sin mínimo" /></label>
                    <label>Hasta<input name="max" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={model.max ?? ""} placeholder="Sin máximo" /></label>
                  </div>
                  <button className={styles.priceApply} type="submit">Aplicar precio</button>
                </fieldset>
              </form>}
              {model.facets.map((facet, index) => <section className={styles.group} key={facet.key} aria-labelledby={`catalog-facet-${index}`}>
                <h2 id={`catalog-facet-${index}`}>{facet.label}</h2>
                {facet.options.map((option) => <FacetLink key={option.value} label={facet.key === "disponibilidad" ? availabilityLabel(option.value) : option.value} option={option} href={changeCatalogParam(params, facet.key, facet.key === "disponibilidad" && option.selected ? null : option.value, facet.key !== "disponibilidad")} />)}
              </section>)}
              {!model.category && <p className={styles.hint}>Elige una categoría para ver sus características técnicas disponibles.</p>}
              <p className={styles.hint}>Las opciones muestran coincidencias manteniendo los demás filtros. Puedes combinar varios valores de una característica.</p>
            </div>
          </details>
        </aside>
        <section className={styles.results} aria-label="Resultados del catálogo">
          {model.category && <div className={styles.categoryIntro}><h2>{model.category.name}</h2><p>{model.category.description}</p></div>}
          {model.results.length > 0 ? <div className="catalog-product-grid">{model.results.map((product, index) => <div key={product.id} className={styles.product}>
            {data.source === "demo" ? <ProductCard product={product} index={index} /> : <ConnectedProductCard product={product} index={index} />}
            {data.source === "demo" && product.stock <= 0 && <p className={styles.soldOut}>Agotado · demo. No se puede añadir a la cesta.</p>}
          </div>)}</div> : data.products.length === 0 ? <div className={styles.empty}><h2>Aún no hay productos publicados.</h2><p>El catálogo aparecerá aquí cuando haya productos publicados para explorar.</p></div> : <div className={styles.empty}>
            <h2>No encontramos lo que buscas.</h2>
            <p>{model.query ? `No hay coincidencias para “${model.query}” con esta selección.` : "No hay productos que cumplan todos estos filtros."} Cambia una opción o amplía el precio.</p>
            <div className={styles.recovery}>{hasFilters && <Link className="button button--dark" href={clearCatalogFilters(params)} prefetch={false}>Quitar filtros y conservar búsqueda</Link>}<Link className="button button--outline" href={clearCatalogFilters(params, true)} prefetch={false}>Ver todo el catálogo</Link></div>
          </div>}
        </section>
      </div>
    </main>
  );
}
