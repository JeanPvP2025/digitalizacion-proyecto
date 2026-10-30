/**
 * NODRIA Chatbot Knowledge Base
 * Deterministic technical reference and commercial FAQ repository.
 * Zero AI / Zero LLM. Pure structured technical rules and answers.
 */

import { normalizeText } from "./normalizer";

export type KnowledgeEntry = {
  id: string;
  category: "networking" | "cabling" | "smart_home" | "telephony" | "industry" | "pc_builder" | "shopping" | "support" | "identity";
  title: string;
  keywords: string[];
  patterns: RegExp[];
  content: string;
  quickReplies?: Array<{ label: string; payload: string }>;
  suggestedAction?: {
    type: "navigate" | "search" | "pc_builder" | "support";
    payload: string;
  };
};

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // --- IDENTIDAD Y ASISTENTE ---
  {
    id: "identity_who_are_you",
    category: "identity",
    title: "¿Quién es el Asistente NODRIA?",
    keywords: ["quien", "eres", "asistente", "nodria", "ia", "inteligencia", "artificial", "humano", "robot"],
    patterns: [
      /\b(?:quien eres|que eres|como te llamas|eres (?:una? )?(?:ia|humano|persona|robot))\b/,
      /\b(?:eres inteligencia artificial|usas ia|de que estas hecho)\b/,
    ],
    content:
      "Soy el **Asistente NODRIA**, el asistente virtual automatizado de nuestra tienda tecnológica.\n\n" +
      "Estoy programado para ayudarte a elegir equipamiento técnico, verificar compatibilidades en PC Builder PRO, orientarte en tu proceso de compra y resolver dudas sobre las especificaciones de nuestro catálogo oficial.",
    quickReplies: [
      { label: "Ver categorías", payload: "¿Qué categorías tenéis?" },
      { label: "Recomendar equipo", payload: "Recomiéndame un equipo" },
      { label: "PC Builder PRO", payload: "¿Qué es PC Builder PRO?" },
    ],
  },

  // --- NETWORKING & CABLING ---
  {
    id: "faq_poe_standards",
    category: "networking",
    title: "Estándares PoE (PoE, PoE+, PoE++)",
    keywords: ["poe", "poe+", "poe++", "802.3af", "802.3at", "802.3bt", "potencia", "vatios", "alimentacion"],
    patterns: [
      /\b(?:que es poe|diferencia entre poe y poe\+|estandares? poe|poe\+\+|802\.3af|802\.3at|802\.3bt|cuantos vatios entrega poe)\b/,
    ],
    content:
      "**Power over Ethernet (PoE)** permite transmitir datos y alimentación eléctrica a través del mismo cable de red Ethernet (par trenzado):\n\n" +
      "• **PoE estándar (IEEE 802.3af):** Suministra hasta **15.4 W** por puerto (mínimo garantizado en dispositivo: 12.95 W). Adecuado para teléfonos IP básicos y cámaras estándar.\n" +
      "• **PoE+ (IEEE 802.3at):** Suministra hasta **30 W** por puerto (garantizado: 25.5 W). Ideal para puntos de acceso Wi-Fi 6 y cámaras PTZ.\n" +
      "• **PoE++ (IEEE 802.3bt):**\n" +
      "  - *Tipo 3:* Hasta **60 W** por puerto.\n" +
      "  - *Tipo 4:* Hasta **90 W - 100 W** por puerto.\n" +
      "  Imprescindible para puntos de acceso Wi-Fi 7 de alto rendimiento, pantallas interactivas y equipos de videoconferencia avanzada.",
    quickReplies: [
      { label: "Ver switches PoE", payload: "Busco switch con PoE" },
      { label: "Puntos de acceso Wi-Fi", payload: "Ver puntos de acceso Wi-Fi" },
    ],
  },
  {
    id: "faq_fiber_os2_vs_om4",
    category: "cabling",
    title: "Fibra óptica: Monomodo (OS2) vs Multimodo (OM4)",
    keywords: ["fibra", "monomodo", "multimodo", "os2", "om3", "om4", "distancia", "alcance", "nucleo"],
    patterns: [
      /\b(?:diferencia entre monomodo y multimodo|monomodo vs multimodo|fibra os2|fibra om4|cuando usar monomodo)\b/,
    ],
    content:
      "La principal diferencia reside en el diámetro del núcleo óptico y la distancia de propagación:\n\n" +
      "• **Monomodo (OS2 - 9/125 µm):** Núcleo extremadamente estrecho (9 micras) donde la luz viaja en un único haz láser recto. " +
      "Permite alcances desde **2 km hasta decenas de kilómetros** sin dispersión modal. Es el estándar obligatorio para enlaces troncales entre sedes, enlaces de campus y despliegues FTTH.\n\n" +
      "• **Multimodo (OM4 - 50/125 µm):** Núcleo más ancho (50 micras) iluminado mediante VCSEL (láser de emisión superficial). " +
      "Optimizado para distancias cortas (hasta **400 metros a 10 Gbps** o **100 metros a 40/100 Gbps**) dentro de un mismo CPD o armario rack. Sus transceptores son más económicos.",
    quickReplies: [
      { label: "Ver mangueras OS2", payload: "Fibra monomodo OS2" },
      { label: "Ver transceptores SFP+", payload: "Transceptores SFP+" },
    ],
  },
  {
    id: "faq_cat6a_vs_cat7",
    category: "cabling",
    title: "Cableado de cobre: Cat.6A vs Cat.7",
    keywords: ["cat6", "cat6a", "cat7", "frecuencia", "mhz", "10gbps", "parcheo", "rj45", "apantallamiento"],
    patterns: [
      /\b(?:diferencia entre cat6a? y cat7|cat6a vs cat7|cuando poner cat7|frecuencia cat6a)\b/,
    ],
    content:
      "Comparativa técnica de cableado de par trenzado para redes 10 Gigabit:\n\n" +
      "• **Cat.6A (ANSI/TIA-568 e ISO/IEC 11801):** Opera a **500 MHz** y garantiza enlaces de **10 Gbps hasta los 100 metros completos**. Utiliza conectores estándar RJ45, lo que simplifica la instalación y el conexionado en paneles de parcheo.\n\n" +
      "• **Cat.7 (ISO/IEC 11801 Clase F):** Opera a **600 MHz** con apantallamiento individual por par y malla global (S/FTP). Aunque ofrece un margen superior contra la diafonía (crosstalk), el estándar ISO no adoptó el conector RJ45 nativo (utiliza conectores GG45 o TERA). En la práctica industrial, Cat.6A S/FTP es la recomendación preferente para racks estándar.",
    quickReplies: [
      { label: "Ver bobinas de cable", payload: "Bobina cable red" },
      { label: "Paneles de parcheo", payload: "Panel de parcheo" },
    ],
  },
  {
    id: "faq_wifi_standards",
    category: "networking",
    title: "Evolución Wi-Fi: Wi-Fi 6 vs Wi-Fi 6E vs Wi-Fi 7",
    keywords: ["wifi", "wifi 6", "wifi 6e", "wifi 7", "802.11ax", "802.11be", "6 ghz", "bandas", "mlo"],
    patterns: [
      /\b(?:diferencia entre wifi 6 y wifi 7|wifi 6 vs wifi 6e|que aporta wifi 7|vale la pena wifi 7|banda de 6 ghz)\b/,
    ],
    content:
      "Comparativa de generaciones inalámbricas:\n\n" +
      "• **Wi-Fi 6 (802.11ax):** Bandas de **2.4 GHz y 5 GHz**. Introduce OFDMA, MU-MIMO bidireccional y coloración BSS para alta densidad de clientes.\n" +
      "• **Wi-Fi 6E (802.11ax Extended):** Añade la nueva banda limpia de **6 GHz** (canales de hasta 160 MHz libres de interferencias legacy).\n" +
      "• **Wi-Fi 7 (802.11be Extremely High Throughput):** El salto definitivo con canales de hasta **320 MHz**, modulación 4096-QAM y tecnología **MLO (Multi-Link Operation)**, que permite a un mismo dispositivo transmitir y recibir simultáneamente por varias bandas (ej. 5 GHz + 6 GHz), reduciendo la latencia a menos de 5 ms.",
    quickReplies: [
      { label: "Ver APs Wi-Fi 6E y 7", payload: "Puntos de acceso Wi-Fi 6E 7" },
    ],
  },

  // --- SMART HOME & IOT ---
  {
    id: "faq_zigbee_matter_thread",
    category: "smart_home",
    title: "Domótica: Zigbee vs Matter vs Thread",
    keywords: ["zigbee", "matter", "thread", "domotica", "protocolo", "hub", "puente", "mesh", "ipv6"],
    patterns: [
      /\b(?:diferencia entre zigbee y matter|que es matter|que es thread|zigbee o matter|necesito hub)\b/,
    ],
    content:
      "Ecosistemas de automatización y hogar digital:\n\n" +
      "• **Zigbee:** Protocolo inalámbrico de baja potencia en red mallada (Mesh) a 2.4 GHz. Requiere una pasarela o coordinador específico (como el Aqara Hub M3 o Fibaro HC3 Lite) para conectar con la red local.\n\n" +
      "• **Thread:** Es la capa de transporte de red inalámbrica mallada, segura, autorreparable y basada en **IPv6** nativo (6LoWPAN). No requiere pasarelas propietarias, solo un *Thread Border Router*.\n\n" +
      "• **Matter:** Es la capa de aplicación universal (el lenguaje común). Funciona sobre Thread, Wi-Fi o Ethernet. Permite que dispositivos de diferentes marcas (Apple Home, Google Home, Alexa, Home Assistant) se comuniquen localmente sin depender de servidores en la nube.",
    quickReplies: [
      { label: "Ver hubs domóticos", payload: "Hubs domóticos" },
      { label: "Ver relés DIN", payload: "Relés carril DIN" },
    ],
  },
  {
    id: "faq_rele_din_vs_interruptor",
    category: "smart_home",
    title: "Relés de carril DIN vs interruptores convencionales",
    keywords: ["rele", "din", "carril din", "shelly", "cuadro electrico", "interruptor", "smart switch"],
    patterns: [
      /\b(?:que es un rele din|ventajas rele carril din|rele din o pastilla|shelly pro)\b/,
    ],
    content:
      "Los relés para **carril DIN** (como la serie Shelly Pro 4PM) se instalan directamente en el cuadro eléctrico de distribución:\n\n" +
      "• **Seguridad e inmunidad térmica:** Disponen de aislamiento ignífugo certificado y disipación térmica optimizada para cargas continuadas.\n" +
      "• **Conectividad dual:** Suelen incluir puerto **Ethernet RJ45** además de Wi-Fi y Bluetooth, evitando caídas por saturación inalámbrica.\n" +
      "• **Medición de energía independiente:** Monitorean consumo eléctrico (kW/h) en 4 canales con corte automático por sobretensión y sobrecorriente.\n" +
      "• **Centralización:** A diferencia de las pastillas ocultas en cajas de mecanismos, toda la instalación y mantenimiento queda accesible en el cuadro general.",
    quickReplies: [
      { label: "Ver Shelly Pro 4PM", payload: "Shelly Pro 4PM" },
    ],
  },

  // --- TELEFONÍA & VOIP ---
  {
    id: "faq_pbx_fisica_vs_cloud",
    category: "telephony",
    title: "Centralitas IP-PBX: Físicas vs Virtuales en la Nube",
    keywords: ["centralita", "ip-pbx", "cloud", "troncal sip", "voip", "fisica", "grandstream", "asterisk"],
    patterns: [
      /\b(?:centralita fisica o cloud|ventajas centralita fisica|que es ip pbx|ucm6302|troncal sip)\b/,
    ],
    content:
      "Una centralita **IP-PBX física (on-premise)** como la serie Grandstream UCM6300 ofrece ventajas clave frente a servicios en la nube de pago recurrente:\n\n" +
      "• **Sin cuotas mensuales por usuario:** Pagas el hardware una sola vez y no tienes licencias mensuales por extensión o canal.\n" +
      "• **Privacidad y cumplimiento RGPD:** Las grabaciones de llamadas, registros CDR y buzones de voz residen en tu propia red local.\n" +
      "• **Resiliencia operativa:** Continúa operando las comunicaciones internas de planta o sede aunque falle el acceso a Internet exterior.\n" +
      "• **Integración directa:** Admite puertos FXO analógicos para líneas RTB de respaldo, intercomunicadores de acceso e integración con megafonía SIP.",
    quickReplies: [
      { label: "Ver Grandstream UCM6302", payload: "Grandstream UCM6302" },
      { label: "Ver teléfonos IP", payload: "Teléfonos IP PoE" },
    ],
  },

  // --- DIGITALIZACIÓN E INDUSTRIA ---
  {
    id: "faq_edge_server_fanless",
    category: "industry",
    title: "¿Qué es un Servidor Edge Fanless y para qué se usa?",
    keywords: ["edge", "fanless", "industrial", "advantech", "sin ventilador", "polvo", "vibracion", "din"],
    patterns: [
      /\b(?:que es un servidor edge|servidor fanless|para que sirve edge server|advantech uno)\b/,
    ],
    content:
      "Un **servidor Edge Fanless** (sin ventiladores mecánicos) está diseñado para entornos industriales y plantas de producción hostiles:\n\n" +
      "• **Sellado contra polvo y partículas:** Al no tener ventiladores que aspiren aire del ambiente, evita la entrada de polvo metálico, humedad y residuos.\n" +
      "• **Tolerancia a vibraciones y temperatura:** Chasis de aluminio de alta disipación térmica operativa desde -20 °C hasta +60 °C.\n" +
      "• **Procesamiento en el borde (Edge Computing):** Ejecuta algoritmos de visión artificial, filtrado de telemetría IoT y pasarelas de protocolos locales antes de enviar resúmenes a la nube, garantizando tiempo real (<10 ms).",
    quickReplies: [
      { label: "Ver servidores industriales", payload: "Servidores industriales" },
      { label: "Ver gateways IoT", payload: "Gateways IoT" },
    ],
  },
  {
    id: "faq_modbus_rtu_vs_tcp",
    category: "industry",
    title: "Protocolo Industrial: Modbus RTU vs Modbus TCP",
    keywords: ["modbus", "rtu", "tcp", "rs485", "ethernet", "plc", "scada", "moxa"],
    patterns: [
      /\b(?:diferencia entre modbus rtu y modbus tcp|modbus rtu vs tcp|rs485 o ethernet industrial)\b/,
    ],
    content:
      "Comparativa de comunicación industrial en automatización:\n\n" +
      "• **Modbus RTU:** Transmisión serie binaria mediante bus físico **RS-485** de 2 hilos apantallados. Ideal para conectar hasta 32 sensores, variadores y medidores a distancias de hasta 1.200 metros con topología en cadena (Daisy Chain).\n\n" +
      "• **Modbus TCP:** Encapsula las tramas Modbus dentro de paquetes **TCP/IP** estándar a través de Ethernet (puerto 502). Permite velocidades de hasta 1 Gbps, múltiples maestros simultáneos e integración directa en redes LAN y sistemas SCADA modernos.\n\n" +
      "Las pasarelas como la Moxa MGate permiten interconectar buses serie RTU legacy con redes Ethernet TCP.",
    quickReplies: [
      { label: "Ver pasarelas industriales", payload: "Pasarelas industriales" },
    ],
  },

  // --- PC BUILDER PRO ---
  {
    id: "faq_pc_builder_explanation",
    category: "pc_builder",
    title: "¿Qué es PC Builder PRO y cómo funciona?",
    keywords: ["pc builder", "configurador", "montar", "piezas", "compatibilidad", "como funciona"],
    patterns: [
      /\b(?:que es pc builder|como funciona el configurador|como montar mi pc|configurar ordenador)\b/,
    ],
    content:
      "**PC Builder PRO** es el configurador de ordenadores de NODRIA.\n\n" +
      "Te permite seleccionar paso a paso los 8 componentes esenciales de un equipo informático:\n" +
      "1. Procesador (CPU)\n" +
      "2. Placa base (Motherboard)\n" +
      "3. Memoria RAM\n" +
      "4. Tarjeta gráfica (GPU)\n" +
      "5. Almacenamiento SSD M.2\n" +
      "6. Fuente de alimentación (PSU)\n" +
      "7. Caja / Chasis\n" +
      "8. Refrigeración (Cooler)\n\n" +
      "El configurador incluye un **motor de verificación automática de compatibilidad** que comprueba zócalos (ej. AM5 o LGA1700), tipo de RAM (DDR4 vs DDR5), consumo en vatios (TDP) y factor de forma de placa y caja.",
    suggestedAction: {
      type: "pc_builder",
      payload: "/configurador",
    },
    quickReplies: [
      { label: "Ir al configurador", payload: "Quiero ir a PC Builder PRO" },
      { label: "¿Cómo calcula la fuente?", payload: "¿Cuántos vatios de fuente necesito?" },
    ],
  },
  {
    id: "faq_pc_builder_psu_watts",
    category: "pc_builder",
    title: "Cálculo de fuente de alimentación en PC Builder PRO",
    keywords: ["fuente", "vatios", "psu", "tdp", "consumo", "potencia", "cuanta fuente"],
    patterns: [
      /\b(?:cuantos vatios necesito|cuanta fuente|como calcular la fuente|potencia recomendada psu)\b/,
    ],
    content:
      "Para calcular la fuente de alimentación recomendada en PC Builder PRO, sumamos el consumo máximo (TDP) de la CPU y la GPU, añadimos un consumo base de 50 W para placa, RAM y almacenamiento, y aplicamos un **margen de seguridad de al menos el 20%**:\n\n" +
      "• **Fórmula:** `Potencia Mínima = (TDP CPU + TDP GPU + 50W) × 1.20`\n" +
      "• **Ejemplo:** Ryzen 7 7800X3D (120W) + RTX 4070 Ti (285W) = 405W + 50W = 455W × 1.20 = **546W mínimos**. Recomendamos una fuente de **650W a 750W 80 PLUS Gold** para máxima eficiencia.",
    quickReplies: [
      { label: "Abrir PC Builder PRO", payload: "Ir al configurador" },
    ],
  },

  // --- POLÍTICAS DE COMPRA Y SERVICIOS ---
  {
    id: "faq_shopping_checkout_demo",
    category: "shopping",
    title: "¿Cómo funciona el proceso de compra y pago en NODRIA?",
    keywords: ["pago", "checkout", "tarjeta", "cobro", "simulado", "comprar", "pedido", "proceso"],
    patterns: [
      /\b(?:como se paga|se cobra de verdad|checkout simulado|metodos de pago|como comprar)\b/,
    ],
    content:
      "En NODRIA el proceso de compra está optimizado para entornos de demostración y formación académica:\n\n" +
      "• **Checkout seguro y simulado:** El sistema tramita pedidos completos con validación en servidor, cálculo de impuestos e inventario en tiempo real.\n" +
      "• **Protección de datos financieros:** **Nunca solicitamos números reales de tarjeta bancaria**, contraseñas ni datos sensibles de pago. Las transacciones son simulaciones seguras autorizadas.\n" +
      "• Puedes añadir productos al carrito desde la tienda o desde este mismo chat y proceder al checkout en `/carrito`.",
    quickReplies: [
      { label: "Ver mi carrito", payload: "Quiero ver mi carrito" },
      { label: "Plazos de envío", payload: "¿Cuánto tardan los envíos?" },
    ],
  },
  {
    id: "faq_shipping_times",
    category: "shopping",
    title: "Plazos de entrega y costes de envío",
    keywords: ["envio", "envios", "entrega", "plazo", "transporte", "cuanto tarda", "gastos"],
    patterns: [
      /\b(?:cuanto tardan los envios|plazo de entrega|gastos de envio|cuando llega mi pedido)\b/,
    ],
    content:
      "**Política de envíos y logística de NODRIA:**\n\n" +
      "• **Península Ibérica:** Entrega en **24 - 48 horas laborables** mediante transporte urgente con seguimiento.\n" +
      "• **Baleares, Canarias, Ceuta y Melilla:** Entrega en **3 - 5 días laborables**.\n" +
      "• **Portes gratuitos:** En pedidos superiores a **150 €** (IVA no incluido).\n" +
      "• **Material voluminoso:** Los armarios rack de gran formato (42U) se entregan paletizados a pie de calle con cita previa.",
    quickReplies: [
      { label: "Consultar mi pedido", payload: "¿Cómo consulto el estado de mi pedido?" },
      { label: "Garantía y devoluciones", payload: "¿Qué garantía tienen los productos?" },
    ],
  },
  {
    id: "faq_warranty_returns",
    category: "shopping",
    title: "Garantía legal y devoluciones (RMA)",
    keywords: ["garantia", "devolucion", "rma", "desistimiento", "plazo", "anos"],
    patterns: [
      /\b(?:garantia|cuantos anos de garantia|plazo de devolucion|como devolver|derecho de desistimiento)\b/,
    ],
    content:
      "**Garantía y política de devoluciones en NODRIA:**\n\n" +
      "• **3 años de garantía oficial:** Todos los equipos y componentes comercializados cuentan con garantía legal europea de 3 años frente a defectos de fabricación.\n" +
      "• **14 días de desistimiento:** Dispones de 14 días naturales desde la recepción para devolver cualquier producto en su embalaje original y perfecto estado.\n" +
      "• **Tramitación RMA:** Si experimentas una avería, puedes solicitar la apertura de un ticket técnico en `/soporte` para gestionar la recogida y sustitución.",
    quickReplies: [
      { label: "Contactar con soporte", payload: "Quiero contactar con soporte" },
    ],
  },
  {
    id: "faq_order_tracking",
    category: "shopping",
    title: "Seguimiento y estado de pedidos",
    keywords: ["estado", "pedido", "seguimiento", "rastrear", "donde esta", "localizador"],
    patterns: [
      /\b(?:donde esta mi pedido|consultar estado pedido|seguimiento de pedido|como ver mi pedido)\b/,
    ],
    content:
      "**Consulta de pedidos:**\n\n" +
      "Por estricto cumplimiento de privacidad y seguridad, este asistente conversacional **no expone información sensible ni listas de pedidos en el chat público**.\n\n" +
      "Para consultar el estado de tu pedido:\n" +
      "1. Inicia sesión en tu cuenta de cliente de NODRIA.\n" +
      "2. Accede a la sección **[Mi Cuenta / Pedidos](/mi-cuenta)**.\n" +
      "3. Podrás comprobar si tu orden está en preparación, enviada o completada con su respectivo código de seguimiento de mensajería.",
    quickReplies: [
      { label: "Ir a Mi Cuenta", payload: "Ir a mi cuenta" },
      { label: "Contactar con soporte", payload: "Hablar con soporte técnico" },
    ],
  },
  {
    id: "faq_customer_support",
    category: "support",
    title: "Atención al cliente y Soporte Técnico",
    keywords: ["soporte", "contacto", "telefono", "email", "ticket", "horario", "atencion"],
    patterns: [
      /\b(?:atencion al cliente|contacto|hablar con un humano|servicio tecnico|formulario de soporte)\b/,
    ],
    content:
      "**Canales oficiales de Soporte NODRIA:**\n\n" +
      "• **Formulario Web y Tickets:** Disponible 24/7 en la sección **[Soporte Técnico](/soporte)**.\n" +
      "• **Horario de atención técnica:** Lunes a Viernes de **08:30 a 18:30 h**.\n" +
      "• **Tiempo medio de respuesta:** Menos de 4 horas laborables para consultas de preventa y soporte de incidencias.\n" +
      "Si necesitas un presupuesto formal para proyectos o asistencia con un despliegue complejo, indícanoslo en el formulario de soporte.",
    suggestedAction: {
      type: "support",
      payload: "/soporte",
    },
    quickReplies: [
      { label: "Ir a Soporte", payload: "Ir a soporte" },
      { label: "Ver catálogo", payload: "Ver las categorías de la tienda" },
    ],
  },
];

/**
 * Searches the Knowledge Base deterministically using regex patterns and keyword overlap.
 */
export function findKnowledgeEntry(query: string): KnowledgeEntry | null {
  const normalized = normalizeText(query);

  // 1. Try regex pattern match first (high precision)
  for (const entry of KNOWLEDGE_BASE) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normalized)) {
        return entry;
      }
    }
  }

  // 2. Keyword score matching
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  let bestEntry: KnowledgeEntry | null = null;
  let maxScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const word of words) {
      if (entry.keywords.includes(word)) {
        score += 2;
      }
    }
    if (score > maxScore && score >= 4) {
      maxScore = score;
      bestEntry = entry;
    }
  }

  return bestEntry;
}
