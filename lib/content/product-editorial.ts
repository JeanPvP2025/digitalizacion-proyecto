import type { Product, ProductCategory, ProductSpecification } from "@/lib/catalog";
import type { PcBuilderCatalogComponent } from "@/lib/pc-builder/types";

export function groupSpecifications(specifications: readonly ProductSpecification[]) {
  const groups = new Map<string, ProductSpecification[]>();
  for (const spec of specifications) {
    const label = spec.label.toLocaleLowerCase("es");
    const group = /garant|caja|incluid|contenido|accesorios/.test(label)
      ? "Garantía y contenido"
      : /puerto|conex|interfaz|socket|compat|estándar|formato|ranura|conector/.test(label)
      ? "Puertos y conectividad"
      : /pantalla|panel|resolución|frecuencia|display/.test(label)
      ? "Pantalla y visualización"
      : /aliment|tensi|potencia|consumo|bater|poe|batería/.test(label)
      ? "Alimentación y energía"
      : /velocidad|tasa|rendimiento|ancho de banda|frecuencia|cpu|procesador|memoria|capacidad|lectura|escritura/.test(label)
      ? "Rendimiento y capacidad"
      : /temperatura|protección|ip|humedad|resistencia|dimension|peso|material/.test(label)
      ? "Construcción y condiciones ambientales"
      : "Otras especificaciones";
    groups.set(group, [...(groups.get(group) ?? []), spec]);
  }
  return [...groups].map(([title, items]) => ({ title, items }));
}

const guides: Partial<Record<ProductCategory, { title: string; checks: string[] }>> = {
  "Técnicas y procesos en infraestructuras de telecomunicaciones": {
    title: "Planificación de armarios rack y cableado estructurado",
    checks: [
      "Calcula las unidades de altura (U) y la profundidad útil considerando radios de curvatura y espacio para pasahilos.",
      "Verifica la categoría requerida (Cat.6A o Cat.7) y la clasificación europea de reacción al fuego CPR (mínimo Dca/LSZH).",
      "Asegura la continuidad de la toma de tierra en paneles de parcheo apantallados y distribuidores de fibra óptica.",
    ],
  },
  "Elementos de sistemas de telecomunicaciones": {
    title: "Selección de conmutación, enrutamiento y fibra óptica",
    checks: [
      "Calcula el presupuesto PoE total (W) sumando los consumos máximos de puntos de acceso, telefonía y cámaras.",
      "Comprueba la longitud de onda y el tipo de fibra (1310 nm monomodo vs 850 nm multimodo) al elegir transceptores SFP+.",
      "Revisa la capacidad de conmutación sin bloqueos y el soporte de enrutamiento estático o dinámico entre VLAN.",
    ],
  },
  "Sistemas integrados y hogar digital": {
    title: "Diseño de instalaciones domóticas y hogar digital",
    checks: [
      "Prioriza pasarelas multiprotocolo compatibles con estándares abiertos (Zigbee 3.0, Matter y Thread).",
      "Comprueba la intensidad máxima por circuito en relés de carril DIN y la necesidad de neutro en micromódulos empotrables.",
      "Instala los sensores de presencia por ondas milimétricas (mmWave) alejados de fuentes de vibración o ventiladores directos.",
    ],
  },
  "Sistemas de telefonía fija y móvil": {
    title: "Implantación de telefonía IP y comunicaciones móviles",
    checks: [
      "Dimensiona la concurrencia de llamadas (aprox. 100 kbps por llamada simultánea utilizando códec G.711 sin compresión).",
      "Verifica la compatibilidad de paso de fax (protocolo T.38) y el suministro de tensión de línea en gateways analógicos.",
      "Comprueba la cobertura de los operadores locales e instala antenas directivas exteriores MIMO para enlaces celulares 4G/5G.",
    ],
  },
  "Digitalización aplicada a los sectores productivos": {
    title: "Integración de sensórica Modbus, Edge Computing y NAS",
    checks: [
      "Comprueba el soporte de buses de campo industriales (Modbus RTU/TCP, OPC UA y MQTT) y el aislamiento galvánico de puertos serie.",
      "Verifica el rango de temperatura admisible (-20°C a +60°C) y la alimentación continua (9-30V CC) para montaje en armario eléctrico.",
      "Configura volúmenes RAID tolerantes a fallos (RAID 5/6) y caché SSD NVMe en servidores NAS para garantizar alta disponibilidad.",
    ],
  },
  "Infraestructuras de Telecomunicaciones": {
    title: "Planificación de armarios rack y cableado estructurado",
    checks: [
      "Calcula las unidades de altura (U) y la profundidad útil considerando radios de curvatura y espacio para pasahilos.",
      "Verifica la categoría requerida (Cat.6A o Cat.7) y la clasificación europea de reacción al fuego CPR (mínimo Dca/LSZH).",
      "Asegura la continuidad de la toma de tierra en paneles de parcheo apantallados y distribuidores de fibra óptica.",
    ],
  },
  "Equipos y Sistemas de Telecomunicaciones": {
    title: "Selección de conmutación, enrutamiento y fibra óptica",
    checks: [
      "Calcula el presupuesto PoE total (W) sumando los consumos máximos de puntos de acceso, telefonía y cámaras.",
      "Comprueba la longitud de onda y el tipo de fibra (1310 nm monomodo vs 850 nm multimodo) al elegir transceptores SFP+.",
      "Revisa la capacidad de conmutación sin bloqueos y el soporte de enrutamiento estático o dinámico entre VLAN.",
    ],
  },
  "Domótica y Hogar Digital": {
    title: "Diseño de instalaciones domóticas y hogar digital",
    checks: [
      "Prioriza pasarelas multiprotocolo compatibles con estándares abiertos (Zigbee 3.0, Matter y Thread).",
      "Comprueba la intensidad máxima por circuito en relés de carril DIN y la necesidad de neutro en micromódulos empotrables.",
      "Instala los sensores de presencia por ondas milimétricas (mmWave) alejados de fuentes de vibración o ventiladores directos.",
    ],
  },
  "Telefonía y Comunicaciones": {
    title: "Implantación de telefonía IP y comunicaciones móviles",
    checks: [
      "Dimensiona la concurrencia de llamadas (aprox. 100 kbps por llamada simultánea utilizando códec G.711 sin compresión).",
      "Verifica la compatibilidad de paso de fax (protocolo T.38) y el suministro de tensión de línea en gateways analógicos.",
      "Comprueba la cobertura de los operadores locales e instala antenas directivas exteriores MIMO para enlaces celulares 4G/5G.",
    ],
  },
  "Digitalización e Industria Conectada": {
    title: "Integración de sensórica Modbus, Edge Computing y NAS",
    checks: [
      "Comprueba el soporte de buses de campo industriales (Modbus RTU/TCP, OPC UA y MQTT) y el aislamiento galvánico de puertos serie.",
      "Verifica el rango de temperatura admisible (-20°C a +60°C) y la alimentación continua (9-30V CC) para montaje en armario eléctrico.",
      "Configura volúmenes RAID tolerantes a fallos (RAID 5/6) y caché SSD NVMe en servidores NAS para garantizar alta disponibilidad.",
    ],
  },
  Ordenadores: {
    title: "Elegir un equipo para tu trabajo",
    checks: [
      "Compara procesador, memoria y almacenamiento con los requisitos de tus aplicaciones.",
      "Revisa las conexiones publicadas antes de elegir pantalla o periféricos.",
      "Si una ampliación no figura en las especificaciones, solicita confirmación técnica.",
    ],
  },
  Componentes: {
    title: "Comprobar las piezas antes del montaje",
    checks: [
      "Comprueba socket, generación de memoria, formato y espacio de la caja cuando estén declarados.",
      "Valida el conjunto en el configurador; una coincidencia de socket no certifica por sí sola todo el equipo.",
      "No asumas que se incluyen disipador, cables o adaptadores si la ficha no los enumera.",
    ],
  },
  Monitores: {
    title: "Preparar tu espacio de pantalla",
    checks: [
      "Compara resolución, tamaño y frecuencia con tu uso previsto.",
      "Revisa las conexiones de ambos dispositivos y el cable necesario.",
      "Comprueba que tu equipo admite la resolución y frecuencia elegidas antes de comprar.",
    ],
  },
  Almacenamiento: {
    title: "Revisar una ampliación de almacenamiento",
    checks: [
      "Comprueba interfaz y formato de la unidad con la documentación de tu equipo.",
      "Compara capacidad y velocidad declaradas; no deduzcas el rendimiento de una combinación no probada.",
      "No asumas que se incluye una carcasa o adaptador si no aparece en el contenido de caja.",
    ],
  },
  Redes: {
    title: "Elegir conectividad para tu espacio",
    checks: [
      "Revisa el estándar y los puertos declarados junto con los dispositivos que conectarás.",
      "La velocidad y cobertura indicadas son datos de la ficha comercial.",
      "Comprueba la configuración requerida por tu proveedor antes de sustituir un equipo de red.",
    ],
  },
  Telefonía: {
    title: "Elegir un dispositivo y sus accesorios",
    checks: [
      "Compara pantalla, memoria y almacenamiento según las aplicaciones que uses.",
      "No deduzcas compatibilidad con lápices, teclados o cargadores a partir del nombre del producto.",
      "Revisa conexiones y contenido de caja declarado antes de añadir accesorios.",
    ],
  },
};

export function getProductEditorial(category: ProductCategory) {
  return guides[category] ?? null;
}

/** Alternatives use the same category and, for PC parts, the same validated component type. */
export function getProductAlternatives(product: Product, products: readonly Product[], components: readonly PcBuilderCatalogComponent[]) {
  const types = new Set(components.filter((item) => item.productId === product.id).map((item) => item.category));
  return products.filter((item) => item.id !== product.id && item.category === product.category && (types.size ? components.some((part) => part.productId === item.id && types.has(part.category)) : item.category !== "Componentes"))
    .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price) || a.slug.localeCompare(b.slug)).slice(0, 4);
}

/** Partial compatibility evidence; never a guarantee for the whole PC. */
export function getComplementReason(a: PcBuilderCatalogComponent, b: PcBuilderCatalogComponent): string | null {
  if (a.productId === b.productId) return null;
  if (a.category === "cpu" && b.category === "motherboard" && a.socket && b.socket && a.socket === b.socket && a.memoryGenerations && b.memoryGeneration && a.memoryGenerations.includes(b.memoryGeneration)) return `Socket ${a.socket} y generación de memoria coincidentes`;
  if (a.category === "motherboard" && b.category === "memory" && a.memoryGeneration && b.generation && a.memoryGeneration === b.generation && b.capacityGb !== undefined && a.maxMemoryGb !== undefined && b.capacityGb <= a.maxMemoryGb) return `${b.generation}, ${b.capacityGb} GB dentro del máximo declarado`;
  if (a.category === "cpu" && b.category === "cooler" && a.socket && b.supportedSockets?.includes(a.socket)) return `Refrigeración con socket ${a.socket} declarado`;
  if ((a.category === "motherboard" && b.category === "cpu") || (a.category === "memory" && b.category === "motherboard") || (a.category === "cooler" && b.category === "cpu")) return getComplementReason(b, a);
  return null;
}

export function getProductComplements(product: Product, products: readonly Product[], components: readonly PcBuilderCatalogComponent[]) {
  const own = components.filter((item) => item.productId === product.id);
  return products.flatMap((candidate) => {
    const matches = components.filter((part) => part.productId === candidate.id).flatMap((part) => own.flatMap((current) => {
      const reason = getComplementReason(current, part);
      return reason ? [{ variantTitle: current.variantTitle, relatedVariantTitle: part.variantTitle, reason }] : [];
    }));
    return matches.length ? [{ product: candidate, matches }] : [];
  }).slice(0, 3);
}
