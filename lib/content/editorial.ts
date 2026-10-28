import type { Metadata } from "next";
import type { CatalogData } from "@/lib/catalog-mapping";
import { createPublicPageMetadata, getPublicSiteUrl } from "@/lib/content/public-seo";

export type EditorialCollection = "blog" | "guias";
export type EditorialSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  checklist?: readonly string[];
};
export type EditorialArticle = {
  collection: EditorialCollection;
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  takeaway: string;
  sections: readonly EditorialSection[];
  productSlugs: readonly string[];
  categorySlugs: readonly string[];
  related: readonly string[];
};

export const editorialCollections = {
  blog: {
    title: "Ideas para decidir mejor",
    label: "Blog",
    description: "Comparativas y criterios para pensar una compra tecnológica. El contenido es orientativo y no incluye pruebas de rendimiento ni ofertas de NODRIA.",
  },
  guias: {
    title: "Una buena decisión empieza aquí",
    label: "Guías",
    description: "Guías prácticas para ordenar requisitos, revisar fichas técnicas de fabricantes y preparar un equipo.",
  },
} as const;

/** Curated plain text: no user HTML, CMS, prices, benchmarks or stock snapshots. */
export const editorialArticles: readonly EditorialArticle[] = [
  {
    collection: "guias", slug: "elegir-portatil-trabajo-estudio",
    title: "Cómo elegir un portátil para trabajar y estudiar",
    description: "Convierte tus tareas, desplazamientos y accesorios en una lista de requisitos antes de comparar ordenadores.",
    category: "Ordenadores", author: "Redacción NODRIA · equipo ficticio",
    publishedAt: "2026-10-01", updatedAt: "2026-10-08",
    takeaway: "Elige a partir de tus tareas y de los requisitos de tus aplicaciones; una cifra aislada no resume la experiencia de uso.",
    productSlugs: [], categorySlugs: [],
    related: ["portatil-o-sobremesa", "elegir-monitor-escritorio"],
    sections: [
      { id: "rutina", title: "1. Describe una semana de uso", paragraphs: [
        "Antes de abrir una ficha, escribe dónde trabajas y qué haces. Preparar apuntes en una biblioteca, editar un proyecto en casa y presentar documentos en una sala son situaciones distintas. Cuenta los desplazamientos, las aplicaciones que necesitas y los accesorios que ya tienes. Una lista breve de tareas concretas resulta más útil que pedir un portátil para todo.",
        "Separa lo imprescindible de lo cómodo. Si tu curso exige un programa concreto, consulta sus requisitos publicados para la versión que utilizarás. Si trabajas con herramientas de empresa, pide al responsable de sistemas que confirme sistema operativo y permisos. No deduzcas esa compatibilidad del nombre comercial del procesador o de una etiqueta de gama.",
      ] },
      { id: "ficha", title: "2. Lee la ficha como una lista de comprobación", paragraphs: [
        "Anota memoria, almacenamiento, pantalla y conexiones en columnas separadas. Después marca qué datos necesitas confirmar. El espacio que ocupan tus proyectos actuales puede ayudarte a plantear una necesidad de almacenamiento, pero no sustituye una política de copias. Comprueba también si las ampliaciones que imaginas están documentadas para la variante exacta del equipo.",
        "En el catálogo actual no hay referencias de portátiles. No hemos medido autonomía, temperatura, ruido ni comportamiento de ningún ordenador. Si esos factores deciden una compra, busca documentación del fabricante y pruebas independientes del modelo exacto, con condiciones de ensayo identificadas.",
      ], checklist: ["Aplicaciones y sistema operativo necesarios.", "Peso y dimensiones aceptables para tus desplazamientos.", "Conexiones para pantalla, cargador y accesorios.", "Capacidad de almacenamiento y plan de copia separado."] },
      { id: "presupuesto", title: "3. Compara el puesto completo", paragraphs: [
        "Define un presupuesto que incluya lo que falta en tu mesa: monitor, teclado, adaptadores o bolsa, si los necesitas. Escribe por qué cada elemento sería necesario y evita añadir accesorios por inercia. Comprueba conexiones en ambos extremos antes de dar por válido un cable que ya tienes.",
        "Termina con dos candidatos y una razón para elegir cada uno. Si no puedes explicar qué problema resuelve una diferencia, vuelve a tus tareas iniciales. Revisa la ficha vigente y la variante antes del carrito: esta guía no fija precios ni disponibilidad. La comparación entre portátil y sobremesa puede ayudarte si la movilidad sigue siendo una duda.",
      ] },
    ],
  },
  {
    collection: "guias", slug: "elegir-monitor-escritorio",
    title: "Cómo elegir un monitor que encaje en tu escritorio",
    description: "Una guía para revisar espacio, resolución, conexiones y ajustes sin confundir una ficha técnica con una prueba de uso.",
    category: "Monitores", author: "Redacción NODRIA · equipo ficticio",
    publishedAt: "2026-10-02", updatedAt: "2026-10-08",
    takeaway: "Comprueba primero mesa, conexiones y tareas; después valora las diferencias de pantalla que puedas justificar.",
    productSlugs: [], categorySlugs: [],
    related: ["elegir-portatil-trabajo-estudio", "renovar-equipos-oficina"],
    sections: [
      { id: "mesa", title: "1. Mide el espacio que vas a usar", paragraphs: [
        "Mide el ancho y el fondo útiles de la mesa, contando teclado, documentos y otros objetos. Las pulgadas describen una diagonal, no el espacio que ocupa el conjunto con su peana. Busca dimensiones completas y comprueba cómo quedaría el cableado. Si tienes un brazo de monitor, revisa su documentación y la del modelo antes de asumir que pueden montarse juntos.",
        "Piensa también en la disposición de tus ventanas. Puedes dibujar en papel una jornada con documentos, correo y videollamadas para decidir qué necesitas ver a la vez. Si vas a usar dos pantallas, incluye ambas en el plano. El objetivo es detectar limitaciones del puesto antes de elegir por una imagen promocional.",
      ] },
      { id: "conexiones", title: "2. Comprueba el recorrido de la señal", paragraphs: [
        "Escribe la salida del ordenador, el cable previsto y la entrada del monitor. Confirma en la documentación de cada elemento qué combinación admite la resolución y frecuencia que quieres utilizar. Un conector con la forma correcta no resuelve por sí solo todas las condiciones de funcionamiento; tampoco conviene asumir que cualquier adaptador conserva todas las funciones.",
        "Si quieres cargar un portátil desde la pantalla, comprueba que ambos equipos y el cable contemplan esa función y sus requisitos. No hay referencias de monitor verificadas en el catálogo actual. Esta guía no certifica una combinación concreta ni garantiza prestaciones fuera de lo que indiquen las fichas.",
      ], checklist: ["Dimensiones de pantalla y peana frente a la mesa.", "Salida del equipo, entrada del monitor y cable necesario.", "Ajustes de soporte documentados para el modelo.", "Funciones de carga o accesorios, solo si están confirmadas."] },
      { id: "criterios", title: "3. Relaciona cada especificación con una tarea", paragraphs: [
        "Anota si tu prioridad es leer texto, trabajar con varias ventanas o revisar imágenes. No conviertas una cifra de resolución, frecuencia o color en una clasificación universal. Para trabajos donde el color sea crítico, pide información sobre el flujo completo y las condiciones de validación; esta demo no incluye mediciones de precisión ni calibración de paneles.",
        "Prepara una tabla sencilla con requisitos cumplidos, pendientes y prescindibles. Si dos modelos cumplen lo esencial, considera el espacio disponible y los accesorios antes de añadir más especificaciones. Consulta la ficha actual del catálogo para ver datos del ejemplo y vuelve a esta lista cuando prepares el puesto junto al ordenador.",
      ] },
    ],
  },
  {
    collection: "guias", slug: "preparar-configuracion-pc",
    title: "Prepara tu configuración de PC antes de añadir piezas",
    description: "Ordena requisitos y revisiones de compatibilidad para explorar el configurador de hardware sin tratar sus reglas como una certificación técnica.",
    category: "Componentes", author: "Redacción NODRIA · equipo ficticio",
    publishedAt: "2026-10-03", updatedAt: "2026-10-08",
    takeaway: "Una configuración requiere revisar el conjunto y sus variantes; una comprobación parcial no certifica un montaje real.",
    productSlugs: ["ssd-kingston-nv3-1tb-m-2-2230-pcie-4-0-nvme-6000mb-s-3d-nand-gaming-0ete5", "samsung-990-pro-1tb-disco-ssd-7450mb-s-nvme-pcie-4-0-m-2-gen4-1vopo"], categorySlugs: ["digitalizacion-industria-conectada"],
    related: ["portatil-o-sobremesa", "elegir-monitor-escritorio"],
    sections: [
      { id: "objetivo", title: "1. Define el objetivo y lo que ya tienes", paragraphs: [
        "Escribe las aplicaciones, el tipo de proyectos y las conexiones que necesita tu equipo. Consulta los requisitos de esas aplicaciones y decide qué componentes pretendes conservar. Anota sus referencias exactas: una familia comercial puede incluir distintas versiones. Separa también monitor y accesorios del presupuesto de la torre para poder comparar el coste del puesto completo.",
        "Decide qué aspectos necesitan validación externa antes de comprar. El configurador compara un conjunto limitado de atributos publicados para modelos reales. Un estado favorable solo corresponde a esas reglas y no es una prueba de estabilidad, refrigeración, consumo o rendimiento de un ordenador montado.",
      ] },
      { id: "conjunto", title: "2. Revisa las dependencias entre piezas", paragraphs: [
        "Construye una lista de comprobaciones para procesador, placa, memoria, caja, almacenamiento y alimentación. Busca en la documentación de cada referencia los requisitos aplicables y deja señalado lo que no puedas confirmar. Evita interpretar un dato ausente como una compatibilidad aprobada. Si necesitas versiones específicas de firmware o accesorios adicionales, añádelos a la revisión.",
        "Para almacenamiento, distingue la capacidad que necesitas de la compatibilidad del dispositivo. Comprueba interfaz, formato y ubicaciones disponibles en la placa o caja elegidas. Las referencias enlazadas muestran datos del modelo publicado; no demuestran que funcione en cualquier equipo ni aportan ensayos de velocidad o resistencia.",
      ], checklist: ["Referencia exacta y variante de cada pieza.", "Compatibilidades documentadas y datos todavía pendientes.", "Espacio físico, conexiones y accesorios necesarios.", "Presupuesto del conjunto, incluido el puesto exterior."] },
      { id: "revision", title: "3. Guarda una decisión explicable", paragraphs: [
        "Resume por qué has elegido cada componente y qué pendiente impediría cerrar la compra. Si una pieza cambia, vuelve a revisar sus dependencias en lugar de dar por vigente la comprobación anterior. Una configuración guardada es un punto de partida: precio, publicación y disponibilidad pertenecen al catálogo actual y se revisan en el flujo de compra.",
        "El catálogo reúne componentes y SSD, no ordenadores premontados. Puedes explorar reglas parciales en el configurador desde la categoría de componentes. Para un montaje real, pide una revisión técnica de todas las referencias; aquí no se presta un servicio de montaje ni se procesa dinero real.",
      ] },
    ],
  },
  {
    collection: "blog", slug: "portatil-o-sobremesa",
    title: "Portátil o sobremesa: compara tu rutina, no una etiqueta",
    description: "Una comparación por escenarios para decidir si tu próximo puesto necesita movilidad o una instalación fija.",
    category: "Comparativas", author: "Redacción NODRIA · equipo ficticio",
    publishedAt: "2026-10-04", updatedAt: "2026-10-08",
    takeaway: "La movilidad y la organización del puesto son preguntas previas a cualquier comparación de modelos.",
    productSlugs: [], categorySlugs: [],
    related: ["elegir-portatil-trabajo-estudio", "preparar-configuracion-pc"],
    sections: [
      { id: "escenarios", title: "Dos formas de organizar el trabajo", paragraphs: [
        "Imagina dos personas con las mismas aplicaciones. Una alterna oficina, casa y biblioteca; la otra trabaja siempre en una mesa con periféricos preparados. Aunque sus tareas se parezcan, sus restricciones no coinciden. Antes de comparar procesadores o memorias, escribe cuántas veces necesitas trasladar el equipo y qué condiciones hay en cada lugar.",
        "Un portátil puede ser un candidato cuando necesitas llevar el mismo equipo contigo. Un sobremesa puede encajar cuando buscas una instalación fija. Son criterios de selección, no resultados de una prueba. La autonomía, el ruido, la capacidad de ampliación y el rendimiento dependen de las referencias concretas y deben comprobarse con información específica del modelo.",
      ] },
      { id: "coste", title: "Compara lo que necesitas tener preparado", paragraphs: [
        "Haz dos presupuestos con la misma lista de tareas y revisa qué falta en cada escenario. Cuenta pantalla, teclado, cámara, conexiones o adaptadores solo cuando los necesites. Si ya tienes accesorios, comprueba que se puedan utilizar con el candidato y anota qué documentación respalda esa conclusión. Así evitas una comparación entre una torre sola y un puesto portátil completo.",
        "Considera cómo guardarás y recuperarás tus archivos, especialmente si alternas equipos. Decide qué datos deben estar disponibles en cada lugar y cómo comprobarás tus copias. No presupongas que cambiar de formato resuelve la continuidad del trabajo. Anota también las aplicaciones y licencias cuya instalación debe confirmar el responsable correspondiente.",
      ], checklist: ["¿Necesito desplazar el mismo equipo durante la semana?", "¿Qué accesorios y conexiones hay en cada lugar?", "¿Puedo verificar las aplicaciones en ambos candidatos?", "¿He contado el puesto completo en los dos presupuestos?"] },
      { id: "ejemplos", title: "Cómo usar los ejemplos del catálogo", paragraphs: [
        "El catálogo actual no contiene ordenadores premontados. Usa esta comparación como lista de criterios y consulta los modelos concretos cuando estén disponibles. Esta redacción no ha realizado pruebas de productividad, autonomía o acústica ni declara un ganador técnico.",
        "Si la movilidad es imprescindible, continúa con la guía de portátil. Si quieres entender el conjunto de piezas, revisa la preparación de una configuración de PC. La decisión queda mejor fundada cuando puedes señalar qué necesidad cubre y qué dato sigue pendiente. Los precios y las variantes se consultan en la ficha vigente, sin convertir este artículo en una oferta permanente.",
      ] },
    ],
  },
  {
    collection: "blog", slug: "planificar-red-hogar",
    title: "Antes de cambiar el router, dibuja tu red doméstica",
    description: "Un método para describir ubicación, dispositivos y síntomas antes de explorar productos de red, sin promesas de velocidad o cobertura.",
    category: "Conectividad", author: "Redacción NODRIA · equipo ficticio",
    publishedAt: "2026-10-05", updatedAt: "2026-10-08",
    takeaway: "Describe el problema y las condiciones de uso antes de asumir que un nuevo dispositivo lo resolverá.",
    productSlugs: ["ubiquiti-dream-machine-special-edition-udm-se", "mikrotik-routerboard-rb5009ug-s-in"], categorySlugs: ["equipos-sistemas-telecomunicaciones"],
    related: ["renovar-equipos-oficina", "elegir-portatil-trabajo-estudio"],
    sections: [
      { id: "mapa", title: "Empieza por un mapa y un síntoma concreto", paragraphs: [
        "Dibuja las habitaciones, la ubicación actual del router y los lugares donde utilizas cada equipo. Marca dónde hay cable y dónde dependes de una conexión inalámbrica. No necesitas un plano profesional: interesa localizar las condiciones del problema. Es distinto perder conexión en un punto concreto que no poder acceder desde ningún dispositivo.",
        "Registra qué ocurre, cuándo empezó y si afecta a uno o varios equipos. Anota si la conexión se recupera al cambiar de lugar y qué cambios recientes has hecho. Estos datos ayudan a preparar una consulta de soporte; por sí solos no identifican una causa técnica. Evita comprar a partir de una única medición que no puedas repetir bajo condiciones comparables.",
      ] },
      { id: "requisitos", title: "Revisa el servicio y tus dispositivos", paragraphs: [
        "Consulta al proveedor las condiciones de tu conexión y los requisitos para sustituir o añadir equipos. Comprueba en la documentación qué funciones necesitas conservar y qué dispositivos vas a conectar. Una etiqueta comercial del router no confirma que todas esas funciones estén disponibles ni que el proveedor permita cualquier configuración.",
        "Prepara una lista de puertos y formas de conexión requeridas. Si exploras una red con varios puntos, revisa cómo se comunican y qué compatibilidad exige el sistema concreto. No infieras cobertura de la superficie de la vivienda ni rendimiento real de una cifra de velocidad máxima. Este artículo no contiene una medición del entorno ni un estudio de instalación.",
      ], checklist: ["Síntoma, lugares afectados y equipos implicados.", "Condiciones del proveedor y funciones que debo conservar.", "Puertos, cableado y documentación de compatibilidad.", "Preguntas sin resolver antes de elegir un dispositivo."] },
      { id: "catalogo", title: "Explora la ficha sin convertirla en una garantía", paragraphs: [
        "El catálogo actual no tiene productos de red verificados. Cuando compares uno, revisa estándar, puertos y otros atributos de la ficha exacta. Una ficha comercial no es una medición de tu vivienda ni un ensayo independiente; ningún producto garantiza por sí solo velocidad, alcance o solución de un problema.",
        "Cuando tengas tu lista de requisitos, compara solo las funciones documentadas y conserva los pendientes. Si no puedes determinar el origen del problema, prepara una consulta con tu mapa y los síntomas para un servicio técnico real. NODRIA permite explorar un flujo de soporte simulado; no configura redes reales. La planificación de una oficina exige además una revisión de usuarios, permisos y continuidad.",
      ] },
    ],
  },
  {
    collection: "blog", slug: "renovar-equipos-oficina",
    title: "Renovar equipos de oficina sin perder el contexto",
    description: "Organiza perfiles de uso, periféricos y validaciones pendientes antes de preparar una solicitud B2B corporativa.",
    category: "Empresas", author: "Redacción NODRIA · equipo ficticio",
    publishedAt: "2026-10-06", updatedAt: "2026-10-08",
    takeaway: "Una solicitud útil describe puestos y restricciones; una lista de unidades por sí sola deja demasiadas decisiones abiertas.",
    productSlugs: ["cisco-catalyst-1000-48-puertos-gigabit-poe-plus", "grandstream-ucm6302-centralita-ip-pbx"], categorySlugs: ["telefonia-comunicaciones", "equipos-sistemas-telecomunicaciones"],
    related: ["elegir-monitor-escritorio", "planificar-red-hogar"],
    sections: [
      { id: "perfiles", title: "Agrupa puestos por tareas verificables", paragraphs: [
        "Empieza con un inventario sencillo: equipo actual, aplicaciones, accesorios y lugar de trabajo. Agrupa puestos que comparten necesidades sin asumir que toda la organización utiliza lo mismo. Un puesto de atención, uno de diseño y uno itinerante pueden requerir revisiones diferentes. Pide a cada responsable una descripción breve de las tareas que no deben interrumpirse.",
        "Añade restricciones de sistemas, instalaciones y permisos con ayuda de las personas responsables. Los requisitos de las aplicaciones y las políticas internas deben confirmarse fuera de una ficha comercial. Si un dato no está disponible, regístralo como pendiente. No lo conviertas en una característica supuesta del equipo ni en una promesa de la solicitud.",
      ] },
      { id: "puesto", title: "Cuenta el puesto y la transición", paragraphs: [
        "Por cada grupo, anota número de unidades y accesorios necesarios. Revisa pantallas, cámaras, conexiones y cableado que se van a conservar. Incluye quién validará cada combinación y con qué información. Una propuesta puede quedar incompleta si solo contabiliza ordenadores y omite los elementos que las personas necesitan para empezar a trabajar.",
        "Prepara también la transición: qué archivos deben conservarse, quién verificará las copias y cómo se comprobará el acceso a las aplicaciones. Define una revisión de aceptación que corresponda a tus tareas y decide quién puede aprobarla. Este artículo ofrece una plantilla de planificación; no estima tiempos de despliegue ni garantiza continuidad operativa.",
      ], checklist: ["Perfiles de uso, número de puestos y ubicación.", "Aplicaciones, permisos y restricciones confirmados.", "Accesorios existentes y conexiones pendientes de validar.", "Responsables de transición y criterios de aceptación."] },
      { id: "solicitud", title: "Convierte la lista en una solicitud clara", paragraphs: [
        "Resume objetivo, grupos de puestos y preguntas pendientes antes de explorar el formulario de empresas. Utiliza cantidades y contactos profesionales en NODRIA: todas las organizaciones, propuestas, pedidos y pagos son simulados para demostración operativa. El portal permite recorrer un proceso comercial y de presupuestación corporativa.",
        "El catálogo reúne equipamiento de telecomunicaciones, redes, telefonía IP y digitalización. Consulta las fichas de cada fabricante y valida tus requisitos antes de crear una solicitud.",
      ] },
    ],
  },
];

export function getEditorialArticles(collection: EditorialCollection) {
  return editorialArticles.filter((article) => article.collection === collection)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getEditorialArticle(collection: EditorialCollection, slug: string) {
  return editorialArticles.find((article) => article.collection === collection && article.slug === slug);
}

export function editorialPath(article: Pick<EditorialArticle, "collection" | "slug">): string {
  return `/${article.collection}/${article.slug}`;
}

/** Route/date contract for the integration lead's sitemap; never writes the global sitemap. */
export function getEditorialSitemapEntries() {
  return [
    ...(["blog", "guias"] as const).map((collection) => ({ path: `/${collection}`, lastModified: "2026-10-08" })),
    ...editorialArticles.map((article) => ({ path: editorialPath(article), lastModified: article.updatedAt })),
  ];
}

export function getRelatedEditorial(article: EditorialArticle) {
  return article.related.flatMap((slug) => {
    const related = editorialArticles.find((candidate) => candidate.slug === slug);
    return related ? [related] : [];
  });
}

/** Optional PDP integration contract; only references curated content, never mutates products. */
export function getEditorialForProduct(productSlug: string) {
  return editorialArticles.filter((article) => article.productSlugs.includes(productSlug));
}

export function resolveEditorialCommerce(article: EditorialArticle, catalog: CatalogData) {
  if (catalog.source === "error") return { products: [], categories: [], unavailable: true };
  return {
    products: catalog.products.filter((product) => article.productSlugs.includes(product.slug)),
    categories: catalog.categories.filter((category) => article.categorySlugs.includes(category.slug)),
    unavailable: false,
  };
}

export function formatEditorialDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" })
    .format(new Date(`${date}T12:00:00Z`));
}

export function editorialReadingMinutes(article: EditorialArticle) {
  const text = article.sections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.checklist ?? [])]).join(" ");
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

export function createEditorialMetadata(collection: EditorialCollection, article?: EditorialArticle): Metadata {
  const title = article?.title ?? editorialCollections[collection].title;
  const description = article?.description ?? editorialCollections[collection].description;
  const base = createPublicPageMetadata(title, description);
  const origin = getPublicSiteUrl();
  const url = origin ? new URL(article ? editorialPath(article) : `/${collection}`, origin).href : undefined;
  return {
    ...base,
    ...(url ? { alternates: { canonical: url } } : { robots: { index: false, follow: false } }),
    ...(article ? { authors: [{ name: article.author }] } : {}),
    openGraph: {
      ...base.openGraph,
      ...(url ? { url } : {}),
      ...(article ? {
        type: "article", publishedTime: `${article.publishedAt}T12:00:00Z`,
        modifiedTime: `${article.updatedAt}T12:00:00Z`, authors: [article.author], section: article.category,
      } : {}),
    },
  };
}
