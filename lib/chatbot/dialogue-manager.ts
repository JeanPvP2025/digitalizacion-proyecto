import type { Product } from "@/lib/catalog";
import type {
  ChatbotConversationContext,
  ChatbotProductRecommendation,
  ChatbotQuickReply,
  ChatbotResponsePayload,
} from "./types";
import { classifyIntent } from "./intents";
import { findKnowledgeEntry, KNOWLEDGE_BASE } from "./knowledge-base";
import { recommendProducts, type RecommendationCriteria } from "./recommendations";
import { buildProductComparison, findComparisonCandidates } from "./comparisons";
import { getPcBuilderAdvice } from "./pc-builder-advisor";

/** Natural conversational greeting variations */
const GREETING_VARIANTS = [
  "¡Hola! 👋 Soy el **Asistente NODRIA**. ¿En qué puedo ayudarte hoy? Puedes pedirme recomendaciones de equipamiento, consultar especificaciones técnicas, comparar modelos o resolver dudas sobre tu compra.",
  "¡Buenas! Bienvenido a NODRIA. Estoy a tu disposición para ayudarte a encontrar productos de telecomunicaciones, guiarte en PC Builder PRO o responder a tus preguntas técnicas.",
  "Hola, un placer saludarte. Como asistente virtual de NODRIA, te puedo orientar sobre redes, fibra óptica, domótica, telefonía IP o componentes informáticos. ¿Qué necesitas?",
];

/** Natural gratitude responses */
const GRATITUDE_VARIANTS = [
  "¡De nada! Es un placer ayudarte. Si necesitas cualquier otra consulta técnica o recomendación, aquí estaré.",
  "¡A ti! Que tengas un excelente día. Si te surge cualquier otra duda sobre equipamiento o pedidos, escríbeme cuando quieras.",
  "¡Encantado de ser de ayuda! Recuerda que puedes tramitar tu pedido directamente o contactar con nuestro equipo de soporte si necesitas asesoría personalizada.",
];

/** Natural farewell responses */
const FAREWELL_VARIANTS = [
  "¡Hasta pronto! Gracias por visitar NODRIA. Si necesitas algo más adelante, aquí me encontrarás. ¡Que tengas un gran día!",
  "¡Adiós! Ha sido un placer atenderte. ¡Buen trabajo con tus proyectos de telecomunicaciones e informática!",
];

export function getInitialWelcomeMessage(currentPath?: string): ChatbotResponsePayload {
  const initialReplies: ChatbotQuickReply[] = [];

  // Context-aware suggestions depending on user location
  if (currentPath?.includes("/configurador")) {
    initialReplies.push(
      { label: "Compatibilidad socket", payload: "¿Cómo sé si el procesador es compatible con el socket y la placa?" },
      { label: "Cálculo de fuente", payload: "¿Cuántos vatios de fuente necesito?" },
      { label: "DDR4 vs DDR5", payload: "¿Qué diferencia hay entre DDR4 y DDR5?" },
      { label: "Ver productos de red", payload: "Ver catálogo de telecomunicaciones" }
    );
    return {
      text: "¡Hola! Veo que estás en **PC Builder PRO**. Puedo ayudarte a verificar la compatibilidad entre procesador y placa, calcular la potencia necesaria de tu fuente de alimentación o resolver dudas sobre memoria RAM y chasis.",
      quickReplies: initialReplies,
    };
  }

  if (currentPath?.includes("/carrito") || currentPath?.includes("/checkout")) {
    initialReplies.push(
      { label: "¿Cómo se paga?", payload: "¿Cómo funciona el proceso de pago simulado?" },
      { label: "Plazos de envío", payload: "¿Cuánto tardan los envíos?" },
      { label: "Garantía de 3 años", payload: "¿Qué garantía tienen los productos?" },
      { label: "Contactar soporte", payload: "Quiero contactar con soporte" }
    );
    return {
      text: "¡Hola! Estás revisando tu pedido. Si tienes dudas sobre plazos de entrega, garantía de 3 años o el proceso de checkout simulado de NODRIA, pregúntame.",
      quickReplies: initialReplies,
    };
  }

  // Default welcome
  initialReplies.push(
    { label: "Buscar productos", payload: "Buscar productos en la tienda" },
    { label: "Recomendarme un equipo", payload: "Recomiéndame un equipo" },
    { label: "Comparar productos", payload: "Comparar productos" },
    { label: "PC Builder PRO", payload: "¿Qué es PC Builder PRO?" },
    { label: "Consultar mi pedido", payload: "¿Cómo consulto el estado de mi pedido?" },
    { label: "Contactar con soporte", payload: "Quiero contactar con soporte técnico" }
  );

  return {
    text: GREETING_VARIANTS[0],
    quickReplies: initialReplies,
  };
}

/**
 * Core deterministic dialogue manager for NODRIA.
 * Coordinates intent recognition, slot filling, flows, comparisons and knowledge.
 */
export function handleDialogueTurn(
  userQuery: string,
  context: ChatbotConversationContext = {},
  catalog: Product[] = []
): ChatbotResponsePayload {
  const intentResult = classifyIntent(userQuery);
  const { intent, entities } = intentResult;

  // New merged context
  const nextContext: ChatbotConversationContext = {
    ...context,
    unrecognizedCount: context.unrecognizedCount ?? 0,
    recentProductSlugs: context.recentProductSlugs ? [...context.recentProductSlugs] : [],
  };

  // Slot-filling updates
  if (entities.budgetEur) nextContext.budgetEur = entities.budgetEur;
  if (entities.portCount) nextContext.portCount = entities.portCount;
  if (entities.poeRequired !== undefined) nextContext.poeRequired = entities.poeRequired;
  if (entities.brand) nextContext.preferredBrand = entities.brand;
  if (entities.productType) nextContext.activeTopic = entities.productType;
  if (entities.sortPreference) nextContext.sortPreference = entities.sortPreference;

  // 1. CLEAR / RESET CONVERSATION
  if (intent === "clear_conversation") {
    return {
      text: "He reiniciado la conversación y restablecido los filtros. ¿En qué puedo orientarte ahora?",
      quickReplies: [
        { label: "Buscar productos", payload: "Buscar productos" },
        { label: "Recomendarme equipo", payload: "Recomiéndame un equipo" },
        { label: "PC Builder PRO", payload: "¿Qué es PC Builder PRO?" },
      ],
      contextUpdate: {
        activeTopic: undefined,
        activeFamily: undefined,
        budgetEur: undefined,
        portCount: undefined,
        poeRequired: undefined,
        preferredBrand: undefined,
        flow: undefined,
        recentProductSlugs: [],
        unrecognizedCount: 0,
      },
    };
  }

  // Reset unrecognized counter whenever a confident recognized intent is encountered
  if (intent !== "unknown") {
    nextContext.unrecognizedCount = 0;
  }

  // 2. GREETINGS & FAREWELLS
  if (intent === "greeting") {
    const greetingText = GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)];
    return {
      text: greetingText,
      quickReplies: [
        { label: "Buscar productos", payload: "Buscar productos" },
        { label: "Recomendar switch", payload: "Recomiéndame un switch" },
        { label: "PC Builder PRO", payload: "¿Qué es PC Builder PRO?" },
        { label: "Ver categorías", payload: "Ver categorías de la tienda" },
      ],
      contextUpdate: nextContext,
    };
  }

  if (intent === "farewell") {
    const farewellText = FAREWELL_VARIANTS[Math.floor(Math.random() * FAREWELL_VARIANTS.length)];
    return {
      text: farewellText,
      quickReplies: [{ label: "Reiniciar chat", payload: "Reiniciar chat" }],
      contextUpdate: nextContext,
    };
  }

  if (intent === "gratitude") {
    const gratText = GRATITUDE_VARIANTS[Math.floor(Math.random() * GRATITUDE_VARIANTS.length)];
    return {
      text: gratText,
      quickReplies: [
        { label: "Ver catálogo", payload: "Ver categorías de la tienda" },
        { label: "Ver carrito", payload: "Quiero ver mi carrito" },
      ],
      contextUpdate: nextContext,
    };
  }

  // 3. IDENTITY INQUIRY
  if (intent === "identity_inquiry") {
    const entry = KNOWLEDGE_BASE.find((k) => k.id === "identity_who_are_you");
    return {
      text: entry?.content ?? "Soy el **Asistente NODRIA**, el asistente virtual automatizado de nuestra tienda tecnológica.",
      quickReplies: entry?.quickReplies,
      contextUpdate: nextContext,
    };
  }

  // 4. HELP MENU
  if (intent === "help_menu") {
    return {
      text:
        "Como Asistente NODRIA puedo ayudarte en las siguientes tareas:\n\n" +
        "1. **Búsqueda y recomendación:** Pídeme por ejemplo *'Recomiéndame un switch de 24 puertos con PoE'* o *'Tengo 300 € para domótica'*.\n" +
        "2. **Comparativa técnica:** Escribe *'Compara UDM SE con MikroTik RB5009'* o compara productos recientemente vistos.\n" +
        "3. **PC Builder PRO:** Asesoría sobre compatibilidad de sockets (AM5/LGA1700), tipo de RAM (DDR4/DDR5) y cálculo de potencia de fuentes.\n" +
        "4. **Dudas técnicas:** Pregúntame sobre fibra monomodo vs multimodo, Cat.6A vs Cat.7, estándares PoE o protocolos Zigbee/Matter.\n" +
        "5. **Pedidos y envíos:** Información sobre plazos de entrega, garantía de 3 años y cómo revisar tus pedidos.",
      quickReplies: [
        { label: "Recomendar switch", payload: "Recomiéndame un switch" },
        { label: "PC Builder PRO", payload: "Asesor PC Builder PRO" },
        { label: "¿Qué es PoE?", payload: "¿Qué es PoE y cuántos vatios entrega?" },
        { label: "Plazos de envío", payload: "¿Cuánto tardan los envíos?" },
      ],
      contextUpdate: nextContext,
    };
  }

  // 5. GUIDED FLOWS INTERACTION
  if (nextContext.flow) {
    const flow = nextContext.flow;

    // Step 1 of recommendation flow: User answered with criteria
    if (flow.type === "recommend_switch") {
      const criteria: RecommendationCriteria = {
        productType: "switch",
        budgetEur: nextContext.budgetEur,
        portCount: nextContext.portCount,
        poeRequired: nextContext.poeRequired,
        brand: nextContext.preferredBrand,
      };

      const result = recommendProducts(catalog, criteria);
      nextContext.flow = undefined; // flow completed
      if (result.products.length > 0) {
        const newSlugs = result.products.map((p) => p.product.slug);
        nextContext.recentProductSlugs = Array.from(new Set([...newSlugs, ...(nextContext.recentProductSlugs ?? [])])).slice(0, 5);
      }

      return {
        text: result.summary,
        products: result.products,
        quickReplies: result.quickReplies,
        contextUpdate: nextContext,
      };
    }
  }

  // 6. PC BUILDER PRO INQUIRIES
  if (intent === "pc_builder_inquiry" || intent === "pc_builder_compatibility") {
    const advice = getPcBuilderAdvice(userQuery);
    return {
      text: `### ${advice.title}\n\n${advice.explanation}`,
      quickReplies: advice.quickReplies,
      contextUpdate: nextContext,
    };
  }

  // 7. PRODUCT COMPARISON REQUEST
  if (intent === "compare_request") {
    let candidateProducts = findComparisonCandidates(userQuery, catalog, nextContext.activeTopic);

    // If query didn't explicitly name 2 products, use recent products from context
    if (candidateProducts.length < 2 && nextContext.recentProductSlugs && nextContext.recentProductSlugs.length >= 2) {
      const recent = nextContext.recentProductSlugs
        .map((slug) => catalog.find((p) => p.slug === slug))
        .filter((p): p is Product => Boolean(p));
      if (recent.length >= 2) {
        const count = entities.ordinalCount ?? 2;
        candidateProducts = recent.slice(0, count);
      }
    }

    if (candidateProducts.length >= 2) {
      const comparison = buildProductComparison(candidateProducts);
      nextContext.recentProductSlugs = candidateProducts.map((p) => p.slug);
      return {
        text: comparison.summary,
        comparison: comparison.table,
        quickReplies: comparison.quickReplies,
        contextUpdate: nextContext,
      };
    }

    // If only 1 or 0 products found, ask user to specify
    return {
      text:
        "Para realizar una comparativa técnica detallada, indícame los dos modelos o marcas que deseas contrastar (por ejemplo: *'Compara UniFi Dream Machine SE con MikroTik RB5009'* o *'Compara switch Cisco con Ubiquiti'*).",
      quickReplies: [
        { label: "Compara UDM SE vs RB5009", payload: "Compara UDM SE con MikroTik RB5009" },
        { label: "Compara switches 24p", payload: "Compara switches de 24 puertos" },
        { label: "Ver catálogo", payload: "Ver categorías de la tienda" },
      ],
      contextUpdate: nextContext,
    };
  }

  // 8. PRODUCT RECOMMENDATION OR SEARCH
  if (intent === "recommend_request" || intent === "search_product") {
    // Check if user specifically requested the cheapest among recent candidates
    if (entities.sortPreference === "cheapest" && nextContext.recentProductSlugs && nextContext.recentProductSlugs.length > 1) {
      const recent = nextContext.recentProductSlugs
        .map((slug) => catalog.find((p) => p.slug === slug))
        .filter((p): p is Product => Boolean(p));
      if (recent.length >= 2) {
        recent.sort((a, b) => a.price - b.price);
        const cheapest = recent[0];
        const nextPrice = recent[1].price;
        const diff = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(nextPrice - cheapest.price);
        const recItem: ChatbotProductRecommendation = {
          product: {
            id: cheapest.id,
            slug: cheapest.slug,
            sku: cheapest.sku,
            name: cheapest.name,
            brand: cheapest.brand,
            price: cheapest.price,
            stock: cheapest.stock,
            image: cheapest.image,
            imageAlt: cheapest.imageAlt,
            summary: cheapest.summary,
            category: cheapest.category,
            keySpecs: cheapest.specifications.slice(0, 3),
          },
          reason: `Opción más accesible (ahorras ${diff} frente a la alternativa de ${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(nextPrice)}).`,
        };
        nextContext.recentProductSlugs = [cheapest.slug];
        return {
          text: `Dentro de las opciones que estábamos revisando, la más económica es **${cheapest.name}** de ${cheapest.brand} por **${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cheapest.price)}**:`,
          products: [recItem],
          quickReplies: [
            { label: "Ver carrito", payload: "Quiero ver mi carrito" },
            { label: "Volver a comparar", payload: "Comparar productos" },
            { label: "Recomendar otro", payload: "Recomiéndame otro equipo" },
          ],
          contextUpdate: nextContext,
        };
      }
    }

    // If user says "recomiéndame un switch" without specs, initiate a guided mini-flow
    if (entities.productType === "switch" && !entities.portCount && !entities.budgetEur && entities.poeRequired === undefined) {
      nextContext.flow = {
        type: "recommend_switch",
        step: 1,
        slots: {},
      };
      return {
        text:
          "Con mucho gusto te oriento para elegir el switch adecuado. Para afinar la recomendación:\n\n" +
          "• ¿Cuántos puertos necesitas aproximadamente? (ej. 8, 16, 24 o 48 puertos)\n" +
          "• ¿Necesitas alimentación **PoE** para puntos de acceso Wi-Fi o cámaras?\n" +
          "• ¿Tienes algún límite de presupuesto aproximado?",
        quickReplies: [
          { label: "8 puertos con PoE", payload: "Switch 8 puertos con PoE" },
          { label: "24 puertos con PoE", payload: "Switch 24 puertos PoE" },
          { label: "Menos de 200 €", payload: "Switch de menos de 200 euros" },
          { label: "Ver todos los switches", payload: "Ver todos los switches disponibles" },
        ],
        contextUpdate: nextContext,
      };
    }

    const budgetWasIncreased = Boolean(
      context.budgetEur &&
      entities.budgetEur &&
      entities.budgetEur > context.budgetEur
    );

    // Execute recommendation / search
    const criteria: RecommendationCriteria = {
      productType: entities.productType ?? nextContext.activeTopic,
      budgetEur: entities.budgetEur ?? nextContext.budgetEur,
      portCount: entities.portCount ?? nextContext.portCount,
      poeRequired: entities.poeRequired ?? nextContext.poeRequired,
      brand: entities.brand ?? nextContext.preferredBrand,
      sortPreference: entities.sortPreference ?? nextContext.sortPreference,
      query: userQuery,
    };

    const recResult = recommendProducts(catalog, criteria);
    if (recResult.products.length > 0) {
      const newSlugs = recResult.products.map((p) => p.product.slug);
      nextContext.recentProductSlugs = Array.from(new Set([...newSlugs, ...(nextContext.recentProductSlugs ?? [])])).slice(0, 5);
    }

    let responseText = recResult.summary;
    if (budgetWasIncreased && entities.budgetEur) {
      const budgetFormatted = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(entities.budgetEur);
      responseText = `¡Excelente! Al ampliar tu presupuesto a **${budgetFormatted}**, he actualizado las opciones disponibles:\n\n${recResult.summary}`;
    }

    return {
      text: responseText,
      products: recResult.products,
      quickReplies: recResult.quickReplies,
      contextUpdate: nextContext,
    };
  }

  // 9. CATEGORY BROWSING
  if (intent === "category_browse") {
    return {
      text:
        "NODRIA organiza su catálogo especializado en cinco categorías técnicas oficiales de telecomunicaciones:\n\n" +
        "1. **[Técnicas y procesos en infraestructuras de telecomunicaciones](/categorias/tecnicas-procesos-infraestructuras-telecomunicaciones)**: Racks 19\", fibra monomodo OS2/OM4, bobinas Cat.6A/Cat.7 y certificación Fluke.\n" +
        "2. **[Elementos de sistemas de telecomunicaciones](/categorias/elementos-sistemas-telecomunicaciones)**: Switches gestionables L2+/L3, routers de borde, transceptores SFP+ y Wi-Fi 6E/7.\n" +
        "3. **[Sistemas integrados y hogar digital](/categorias/sistemas-integrados-hogar-digital)**: Hubs Zigbee/Matter/Thread, relés para carril DIN Shelly Pro, climatización y sensores.\n" +
        "4. **[Sistemas de telefonía fija y móvil](/categorias/sistemas-telefonia-fija-movil)**: Centralitas IP-PBX físicas, teléfonos IP ejecutivos, DECT y routers industriales 4G/5G.\n" +
        "5. **[Digitalización aplicada a los sectores productivos](/categorias/digitalizacion-aplicada-sectores-productivos)**: Gateways IoT, servidores Edge fanless, NAS Synology y lectores Zebra.\n\n" +
        "Además, dispones de **[PC Builder PRO](/configurador)** para configurar ordenadores a medida.",
      quickReplies: [
        { label: "Ver Infraestructuras", payload: "Ver infraestructuras de telecomunicaciones" },
        { label: "Ver Equipos y Redes", payload: "Ver elementos de sistemas" },
        { label: "Ver Hogar Digital", payload: "Ver domótica y hogar digital" },
        { label: "PC Builder PRO", payload: "Ir a PC Builder PRO" },
      ],
      contextUpdate: nextContext,
    };
  }

  // 10. TECHNICAL FAQS & STORE POLICIES
  const kbEntry = findKnowledgeEntry(userQuery);
  if (kbEntry) {
    return {
      text: kbEntry.content,
      quickReplies: kbEntry.quickReplies,
      contextUpdate: nextContext,
    };
  }

  // 11. FALLBACK / UNRECOGNIZED QUERY (Escalation to Support)
  nextContext.unrecognizedCount = (nextContext.unrecognizedCount || 0) + 1;

  if (nextContext.unrecognizedCount >= 2) {
    return {
      text:
        "Disculpa, no he conseguido interpretar tu consulta con total certeza.\n\n" +
        "Como **asistente virtual automatizado**, estoy especializado en búsquedas de catálogo, especificaciones técnicas de telecomunicaciones, compatibilidad en PC Builder PRO y condiciones comerciales de la tienda.\n\n" +
        "Para consultas técnicas avanzadas, presupuestos a medida o incidencias particulares, te invito a contactar con nuestro equipo en **[Soporte Técnico](/soporte)**.",
      quickReplies: [
        { label: "Abrir Soporte Técnico", payload: "Quiero ir a soporte" },
        { label: "Ver categorías", payload: "Ver categorías de la tienda" },
        { label: "Reiniciar conversación", payload: "Reiniciar chat" },
      ],
      contextUpdate: nextContext,
    };
  }

  return {
    text:
      "No estoy seguro de haber entendido tu solicitud. Puedes preguntarme por tipos de producto (ej. *'switches PoE'*, *'fibra monomodo'*, *'cables Cat.6A'*), " +
      "pedir una recomendación con presupuesto, consultar compatibilidad en PC Builder PRO o revisar información sobre envíos y garantías.",
    quickReplies: [
      { label: "Recomendar equipo", payload: "Recomiéndame un equipo" },
      { label: "PC Builder PRO", payload: "¿Qué es PC Builder PRO?" },
      { label: "¿Qué es PoE?", payload: "¿Qué es PoE y cuántos vatios entrega?" },
      { label: "Ver categorías", payload: "Ver categorías de la tienda" },
    ],
    contextUpdate: nextContext,
  };
}
