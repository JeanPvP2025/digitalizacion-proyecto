import telecomData from "./catalog-data/telecom-products.json";

export type ProductCategory =
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
    name: "Infraestructuras de Telecomunicaciones",
    code: "infraestructuras-telecomunicaciones",
    description: "Racks de 19\", cableado estructurado Cat.6A/Cat.7, fibra óptica preconectorizada, paneles de parcheo y certificación.",
  },
  {
    name: "Equipos y Sistemas de Telecomunicaciones",
    code: "equipos-sistemas-telecomunicaciones",
    description: "Switches gestionables L2+/L3, routers de borde, puntos de acceso Wi-Fi 6E/7, transceptores ópticos SFP+ y cabeceras.",
  },
  {
    name: "Domótica y Hogar Digital",
    code: "domotica-hogar-digital",
    description: "Pasarelas multiprotocolo Zigbee/Matter/Thread, relés para carril DIN, sensores ambientales, videoporteros IP y clima.",
  },
  {
    name: "Telefonía y Comunicaciones",
    code: "telefonia-comunicaciones",
    description: "Centralitas IP-PBX, terminales SIP ejecutivos, teléfonos DECT, pasarelas VoIP FXS/FXO y routers industriales 4G/5G.",
  },
  {
    name: "Digitalización e Industria Conectada",
    code: "digitalizacion-industria-conectada",
    description: "Gateways IoT industriales, servidores Edge fanless, almacenamiento NAS Synology, sensores Modbus y trazabilidad Zebra.",
  },
] as const;

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);

/** Storefront lookup for demo products. */
export const getDemoProduct = (slug: string) => demoProducts.find((product) => product.slug === slug);
