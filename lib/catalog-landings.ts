import type { CatalogProduct, CatalogCategory, CatalogData } from "./catalog-mapping";

export type CatalogBrand = { name: string; slug: string; products: CatalogProduct[] };
export type CatalogCategoryLanding = {
  category: CatalogCategory;
  children: Array<CatalogCategory & { count: number }>;
  products: CatalogProduct[];
};
export type CatalogCampaign = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  categorySlugs: string[];
  categories: Array<CatalogCategory & { count: number }>;
  products: CatalogProduct[];
};

type CampaignDefinition = Omit<CatalogCampaign, "categories" | "products" | "categorySlugs"> & {
  categorySlugs: string[];
  fallbackSlugs: string[];
};

const campaignDefinitions: CampaignDefinition[] = [
  {
    slug: "conectividad",
    eyebrow: "REDES EMPRESARIALES",
    title: "Equipos e infraestructura de telecomunicaciones.",
    description: "Conmutación gestionable L2/L3, routers multi-WAN de borde, enlaces ópticos 10G SFP+ y puntos de acceso Wi-Fi 6E/7 para entornos de alta densidad.",
    categorySlugs: ["equipos-sistemas-telecomunicaciones", "switches-gestionables", "routers-borde", "transceptores-opticos"],
    fallbackSlugs: ["equipos-sistemas-telecomunicaciones"],
  },
  {
    slug: "infraestructuras",
    eyebrow: "INSTALACIONES TÉCNICAS",
    title: "Armarios rack y cableado estructurado Cat.6A y Cat.7.",
    description: "Distribución troncal, bandejas de fibra óptica preconectorizada, paneles de parcheo apantallados y herramientas de certificación profesional.",
    categorySlugs: ["infraestructuras-telecomunicaciones", "racks-armarios", "cableado-estructurado", "fibra-optica"],
    fallbackSlugs: ["infraestructuras-telecomunicaciones"],
  },
  {
    slug: "hogar-digital",
    eyebrow: "EDIFICIOS INTELIGENTES",
    title: "Domótica profesional, control de accesos y climatización.",
    description: "Pasarelas Matter y Zigbee 3.0, relés inteligentes para carril DIN con monitorización de energía, videoporteros IP PoE y sensores de presencia milimétrica.",
    categorySlugs: ["domotica-hogar-digital", "pasarelas-controladores", "reles-actuadores", "videoporteros-control-acceso"],
    fallbackSlugs: ["domotica-hogar-digital"],
  },
  {
    slug: "telefonia-ip",
    eyebrow: "COMUNICACIONES CORPORATIVAS",
    title: "Centralitas IP-PBX y terminales SIP de alta definición.",
    description: "Sistemas de telefonía para empresas, pasarelas VoIP FXS/FXO/ISDN, routers celulares industriales 4G/5G con doble SIM y telefonía inalámbrica DECT.",
    categorySlugs: ["telefonia-comunicaciones", "centralitas-ip-pbx", "telefonos-ip-dect", "routers-celulares-4g-5g"],
    fallbackSlugs: ["telefonia-comunicaciones"],
  },
  {
    slug: "industria-conectada",
    eyebrow: "INDUSTRIA 4.0 Y EDGE COMPUTING",
    title: "Digitalización de planta, sensórica Modbus y almacenamiento NAS.",
    description: "Gateways IoT industriales con soporte Node-RED y MQTT, servidores Edge fanless, almacenamiento centralizado Synology y terminales móviles Zebra.",
    categorySlugs: ["digitalizacion-industria-conectada", "gateways-iot-industriales", "servidores-edge-computacion", "almacenamiento-nas-servidores"],
    fallbackSlugs: ["digitalizacion-industria-conectada"],
  },
];

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export function catalogSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getCatalogBrands(data: CatalogData): CatalogBrand[] {
  if (data.source === "error") return [];
  const groups = new Map<string, CatalogBrand>();
  for (const product of data.products) {
    const name = product.brand.trim();
    const slug = catalogSlug(name);
    if (!slug) continue;
    const current = groups.get(slug) ?? { name, slug, products: [] };
    current.products.push(product);
    groups.set(slug, current);
  }
  return [...groups.values()]
    .map((brand) => ({ ...brand, products: [...brand.products].sort((a, b) => collator.compare(a.name, b.name)) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function getCatalogBrand(data: CatalogData, slug: string): CatalogBrand | undefined {
  return getCatalogBrands(data).find((brand) => brand.slug === slug);
}

function categoryAndDescendants(categories: CatalogCategory[], category: CatalogCategory): CatalogCategory[] {
  const descendants = new Map(categories.map((item) => [item.id, item]));
  const selected = new Map([[category.id, category]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of descendants.values()) {
      if (item.parentId && selected.has(item.parentId) && !selected.has(item.id)) {
        selected.set(item.id, item);
        changed = true;
      }
    }
  }
  return [...selected.values()];
}

function productsForCategories(data: CatalogData, categories: CatalogCategory[]): CatalogProduct[] {
  if (data.source === "error" || categories.length === 0) return [];
  const ids = new Set(categories.map((category) => category.id));
  const names = new Set(categories.map((category) => category.name));
  return data.products.filter((product) => product.categoryIds
    ? product.categoryIds.some((id) => ids.has(id))
    : names.has(product.category));
}

export function getCatalogCategory(data: CatalogData, slug: string): CatalogCategoryLanding | undefined {
  if (data.source === "error") return undefined;
  const category = data.categories.find((item) => item.slug === slug);
  if (!category) return undefined;
  const tree = categoryAndDescendants(data.categories, category);
  const children = data.categories.filter((item) => item.parentId === category.id)
    .map((child) => ({ ...child, count: productsForCategories(data, categoryAndDescendants(data.categories, child)).length }))
    .filter((child) => child.count > 0);
  return { category, children, products: productsForCategories(data, tree) };
}

export function getCatalogCategoryDirectory(data: CatalogData) {
  if (data.source === "error") return [];
  return data.categories.filter((category) => !category.parentId)
    .map((category) => ({ ...category, count: getCatalogCategory(data, category.slug)?.products.length ?? 0 }))
    .filter((category) => category.count > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || collator.compare(a.name, b.name));
}

function resolveCampaign(data: CatalogData, definition: CampaignDefinition): CatalogCampaign | undefined {
  if (data.source === "error") return undefined;
  const primary = definition.categorySlugs.flatMap((slug) => data.categories.filter((category) => category.slug === slug));
  const usedFallback = primary.length === 0;
  const categories = usedFallback
    ? definition.fallbackSlugs.flatMap((slug) => data.categories.filter((category) => category.slug === slug))
    : primary;
  const selectedCategories = categories.map((category) => ({
    ...category,
    count: productsForCategories(data, categoryAndDescendants(data.categories, category)).length,
  })).filter((category) => category.count > 0);
  if (selectedCategories.length === 0) return undefined;
  const productsById = new Map<string, CatalogProduct>();
  for (const category of selectedCategories) {
    for (const product of productsForCategories(data, categoryAndDescendants(data.categories, category))) productsById.set(product.id, product);
  }
  return {
    slug: definition.slug, title: definition.title, eyebrow: definition.eyebrow,
    description: definition.description,
    categorySlugs: selectedCategories.map((category) => category.slug),
    categories: selectedCategories,
    products: [...productsById.values()].sort((a, b) => collator.compare(a.name, b.name)),
  };
}

export function getCatalogCampaigns(data: CatalogData): CatalogCampaign[] {
  return campaignDefinitions.flatMap((definition) => {
    const campaign = resolveCampaign(data, definition);
    return campaign ? [campaign] : [];
  });
}

export function getCatalogCampaign(data: CatalogData, slug: string): CatalogCampaign | undefined {
  const definition = campaignDefinitions.find((campaign) => campaign.slug === slug);
  return definition ? resolveCampaign(data, definition) : undefined;
}
