import telecomData from "./catalog-data/telecom-products.json";

export type ProductCategory =
  | "Técnicas y procesos en infraestructuras de telecomunicaciones"
  | "Elementos de sistemas de telecomunicaciones"
  | "Sistemas integrados y hogar digital"
  | "Sistemas de telefonía fija y móvil"
  | "Digitalización aplicada a los sectores productivos"
  | "Infraestructuras de Telecomunicaciones"
  | "Equipos y Sistemas de Telecomunicaciones"
  | "Domótica y Hogar Digital"
  | "Telefonía y Comunicaciones"
  | "Digitalización e Industria Conectada"
  | "Ordenadores"
  | "Componentes"
  | "Monitores"
  | "Redes"
  | "Telefonía"
  | "Almacenamiento";

export type ProductSpecification = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: ProductCategory;
  categoryIds?: readonly string[];
  brand: string;
  modelNumber?: string;
  price: number;
  previousPrice?: number;
  rating: number;
  reviewCount: number;
  stock: number;
  image: string;
  imageAlt: string;
  badge?: string;
  summary: string;
  specifications: ProductSpecification[];
  featured?: boolean;
};

/** Product records used by NODRIA's storefront simulation. */
export const demoProducts: Product[] = (telecomData.products as unknown as Product[]).map((product) => ({
  ...product,
  rating: product.rating ?? 4.8,
  reviewCount: product.reviewCount ?? 12,
  stock: product.stock ?? 12,
  featured: Boolean(product.featured),
}));

export const categories = [
  {
    name: "Técnicas y procesos en infraestructuras de telecomunicaciones",
    code: "tecnicas-procesos-infraestructuras-telecomunicaciones",
    description: "Racks de 19\", cableado estructurado Cat.6A/Cat.7, fibra óptica preconectorizada, paneles de parcheo y certificación.",
  },
  {
    name: "Elementos de sistemas de telecomunicaciones",
    code: "elementos-sistemas-telecomunicaciones",
    description: "Switches gestionables L2+/L3, routers de borde, puntos de acceso Wi-Fi 6E/7, transceptores ópticos SFP+ y cabeceras.",
  },
  {
    name: "Sistemas integrados y hogar digital",
    code: "sistemas-integrados-hogar-digital",
    description: "Pasarelas multiprotocolo Zigbee/Matter/Thread, relés para carril DIN, sensores ambientales, videoporteros IP y clima.",
  },
  {
    name: "Sistemas de telefonía fija y móvil",
    code: "sistemas-telefonia-fija-movil",
    description: "Centralitas IP-PBX, terminales SIP ejecutivos, teléfonos DECT, pasarelas VoIP FXS/FXO y routers industriales 4G/5G.",
  },
  {
    name: "Digitalización aplicada a los sectores productivos",
    code: "digitalizacion-aplicada-sectores-productivos",
    description: "Gateways IoT industriales, servidores Edge fanless, almacenamiento NAS Synology, sensores Modbus y trazabilidad Zebra.",
  },
] as const;

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);

/** Storefront lookup for demo products. */
export const getDemoProduct = (slug: string) => demoProducts.find((product) => product.slug === slug);
