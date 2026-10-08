import type { Product } from "@/lib/catalog";
import type { CatalogCategory, CatalogData } from "@/lib/catalog-mapping";

export type HomepageCategory = CatalogCategory & { count: number; href: string };
export type HomepageCampaign = {
  title: string;
  description: string;
  href: string;
  products: Product[];
};

export type HomepageMerchandising = {
  hero: Product | null;
  featured: Product[];
  discoveries: Product[];
  categories: HomepageCategory[];
  campaign: HomepageCampaign | null;
  totalProducts: number;
  hasExplicitNovelties: boolean;
};

const byName = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const workspaceCategories = ["Ordenadores", "Monitores", "Redes", "Almacenamiento"];
const isNovelty = (product: Product) => /\b(nuevo|nueva|novedad|new)\b/i.test(product.badge ?? "");

export const productHref = (product: Product) => `/producto/${encodeURIComponent(product.slug)}`;

/** Pure selection from the active repository result. Never imports or supplies fixtures.
 * Priority: hero → explicitly featured → workspace campaign → discoveries.
 * Product identity and destination are unique across these four placements.
 * There is no createdAt in Product: novelty badges are editorial, not a date ranking.
 */
export function getHomepageMerchandising(data: CatalogData): HomepageMerchandising {
  const empty: HomepageMerchandising = {
    hero: null, featured: [], discoveries: [], categories: [], campaign: null,
    totalProducts: 0, hasExplicitNovelties: false,
  };
  if (data.source === "error") return empty;

  const ids = new Set<string>();
  const slugs = new Set<string>();
  const products = [...data.products]
    .sort((a, b) => byName.compare(a.name, b.name) || byName.compare(a.slug, b.slug) || byName.compare(a.id, b.id))
    .filter((product) => {
      if (!product.id || !product.slug.trim() || ids.has(product.id) || slugs.has(product.slug)) return false;
      ids.add(product.id);
      slugs.add(product.slug);
      return true;
    });

  const categorySlugs = new Set<string>();
  const categories: HomepageCategory[] = [...data.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder || byName.compare(a.name, b.name))
    .flatMap((category) => {
      if (category.parentId) return [];
      const count = products.filter((product) => product.category === category.name).length;
      if (!count || !category.slug.trim() || categorySlugs.has(category.slug)) return [];
      categorySlugs.add(category.slug);
      return [{ ...category, count, href: `/categorias/${encodeURIComponent(category.slug)}` }];
    });

  const hero = products.find((product) => product.featured && product.image)
    ?? products.find((product) => product.featured)
    ?? products[0]
    ?? null;
  const used = new Set(hero ? [hero.id] : []);
  const featured = products.filter((product) => product.featured && !used.has(product.id)).slice(0, 4);
  featured.forEach((product) => used.add(product.id));

  const remaining = products.filter((product) => !used.has(product.id));
  const campaignProducts: Product[] = [];
  // Keep at least one other ficha for discovery when the pool permits it.
  const campaignLimit = Math.min(3, Math.max(0, remaining.length - 1));
  for (const category of workspaceCategories) {
    if (campaignProducts.length >= campaignLimit) break;
    // Editorial novelty badges belong in discoveries rather than the campaign.
    const product = remaining.find((item) => item.category === category && !isNovelty(item));
    if (product) {
      campaignProducts.push(product);
      used.add(product.id);
    }
  }
  const campaign: HomepageCampaign | null = campaignProducts.length ? {
    title: "Tu espacio de trabajo, pieza a pieza.",
    description: "Piensa en el equipo, la pantalla, la conexión y el almacenamiento. Explora estas fichas ficticias como punto de partida; esta selección no es un pack ni certifica compatibilidad.",
    href: "/campanas/puesto-de-trabajo",
    products: campaignProducts,
  } : null;

  const discoveryPool = products.filter((product) => !used.has(product.id))
    .sort((a, b) => Number(isNovelty(b)) - Number(isNovelty(a)) || byName.compare(a.name, b.name));
  // First pass favors category breadth; a second pass fills any remaining slots.
  const discoveries: Product[] = [];
  const discoveryCategories = new Set<string>();
  for (const product of discoveryPool) {
    if (discoveries.length >= 4) break;
    if (discoveryCategories.has(product.category)) continue;
    discoveries.push(product);
    discoveryCategories.add(product.category);
    used.add(product.id);
  }
  discoveries.sort((a, b) => Number(isNovelty(b)) - Number(isNovelty(a)) || byName.compare(a.name, b.name));
  for (const product of discoveryPool) {
    if (discoveries.length >= 4) break;
    if (used.has(product.id)) continue;
    discoveries.push(product);
    used.add(product.id);
  }

  return {
    hero, featured, discoveries, categories, campaign, totalProducts: products.length,
    hasExplicitNovelties: discoveries.some(isNovelty),
  };
}
