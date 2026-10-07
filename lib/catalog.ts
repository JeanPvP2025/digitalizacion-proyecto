export type ProductCategory = "Ordenadores" | "Componentes" | "Monitores" | "Redes" | "Telefonía" | "Almacenamiento";

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
  brand: string;
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

/** Demo catalogue used only when the server has no Supabase credentials. */
export const demoProducts: Product[] = [
  {
    id: "pr_fluxbook14",
    slug: "fluxbook-14-pro",
    sku: "NOD-FB14-PRO",
    name: "FluxBook 14 Pro",
    category: "Ordenadores",
    brand: "NODRIA",
    price: 1499,
    previousPrice: 1699,
    rating: 4.8,
    reviewCount: 126,
    stock: 14,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Portátil fino de aluminio abierto sobre una mesa de trabajo",
    badge: "-200 €",
    summary: "Rendimiento de estación de trabajo en un chasis ligero, construido para crear sin límites.",
    specifications: [
      { label: "Procesador", value: "NODRIA Core 9 · 16 núcleos" },
      { label: "Memoria", value: "32 GB LPDDR5X" },
      { label: "Almacenamiento", value: "1 TB NVMe Gen 4" },
      { label: "Pantalla", value: "14″ OLED · 2.8K · 120 Hz" },
    ],
    featured: true,
  },
  {
    id: "pr_foundry_s",
    slug: "foundry-s-studio",
    sku: "NOD-FS-02",
    name: "Foundry S Studio",
    category: "Ordenadores",
    brand: "NODRIA",
    price: 2499,
    rating: 4.9,
    reviewCount: 84,
    stock: 6,
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Torre de ordenador de sobremesa en un escritorio de trabajo",
    badge: "Montaje gratuito",
    summary: "Una workstation silenciosa y equilibrada para proyectos exigentes y largas jornadas.",
    specifications: [
      { label: "Procesador", value: "AMD Ryzen 9 9900X" },
      { label: "Gráfica", value: "NVIDIA GeForce RTX 5070 Ti · 16 GB" },
      { label: "Memoria", value: "64 GB DDR5 6000" },
      { label: "Almacenamiento", value: "2 TB NVMe Gen 4" },
    ],
    featured: true,
  },
  {
    id: "pr_loom27",
    slug: "loom-27-4k",
    sku: "NOD-LM27-4K",
    name: "Loom 27 4K",
    category: "Monitores",
    brand: "NODRIA",
    price: 629,
    previousPrice: 699,
    rating: 4.7,
    reviewCount: 52,
    stock: 21,
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Monitor de escritorio de alta resolución visto de frente",
    badge: "-10 %",
    summary: "Color preciso, negros profundos y espacio de sobra para dar forma a cada detalle.",
    specifications: [
      { label: "Panel", value: "IPS Black · 27 pulgadas" },
      { label: "Resolución", value: "3840 × 2160 · 4K UHD" },
      { label: "Frecuencia", value: "144 Hz · Adaptive Sync" },
      { label: "Conexiones", value: "2× HDMI 2.1 · USB-C 90 W" },
    ],
    featured: true,
  },
  {
    id: "pr_linkmesh",
    slug: "linkmesh-x7-pro",
    sku: "NOD-LMX7-PRO",
    name: "LinkMesh X7 Pro",
    category: "Redes",
    brand: "NODRIA",
    price: 289,
    rating: 4.6,
    reviewCount: 41,
    stock: 18,
    image: "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Router inalámbrico de diseño compacto en un entorno doméstico",
    summary: "Wi-Fi 7 de nueva generación con una cobertura estable para hogares conectados.",
    specifications: [
      { label: "Estándar", value: "Wi-Fi 7 · 802.11be" },
      { label: "Velocidad", value: "Hasta 11 Gbps" },
      { label: "Puertos", value: "1× 10 GbE · 4× 2.5 GbE" },
      { label: "Cobertura", value: "Hasta 230 m² por unidad" },
    ],
  },
  {
    id: "pr_slateair",
    slug: "slate-air-11",
    sku: "NOD-SA11-256",
    name: "Slate Air 11",
    category: "Telefonía",
    brand: "NODRIA",
    price: 549,
    rating: 4.5,
    reviewCount: 63,
    stock: 32,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Tablet ligera de color claro junto a accesorios de trabajo",
    summary: "Una pantalla amplia y ligera para trabajar, estudiar y desconectar en cualquier lugar.",
    specifications: [
      { label: "Procesador", value: "NODRIA A8 · 8 núcleos" },
      { label: "Memoria", value: "8 GB" },
      { label: "Almacenamiento", value: "256 GB" },
      { label: "Pantalla", value: "11″ Liquid Retina · 120 Hz" },
    ],
  },
  {
    id: "pr_arcssd",
    slug: "arc-ssd-2tb",
    sku: "NOD-ARC-2T",
    name: "Arc SSD 2 TB",
    category: "Almacenamiento",
    brand: "NODRIA",
    price: 179,
    rating: 4.8,
    reviewCount: 98,
    stock: 47,
    image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Unidad de almacenamiento SSD compacta sobre fondo neutro",
    summary: "Carga tus proyectos en segundos con almacenamiento NVMe rápido y fiable.",
    specifications: [
      { label: "Capacidad", value: "2 TB" },
      { label: "Interfaz", value: "NVMe PCIe 4.0 ×4" },
      { label: "Lectura secuencial", value: "Hasta 7.100 MB/s" },
      { label: "Garantía", value: "5 años limitada" },
    ],
  },
];

export const categories = [
  { name: "Ordenadores", code: "ordenadores", description: "Portátiles, sobremesa y workstations" },
  { name: "Componentes", code: "componentes", description: "Piezas para crear tu propio equipo" },
  { name: "Monitores", code: "monitores", description: "Color, resolución y fluidez" },
  { name: "Redes", code: "redes", description: "Conectividad sin límites" },
  { name: "Telefonía", code: "telefonia", description: "Móvil, tablet y accesorios" },
  { name: "Almacenamiento", code: "almacenamiento", description: "Tus datos, siempre a mano" },
] as const;

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);

export const getProduct = (slug: string) => demoProducts.find((product) => product.slug === slug);
