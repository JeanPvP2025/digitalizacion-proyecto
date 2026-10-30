import { extractEntities, normalizeText, type ExtractedEntities } from "./normalizer";
import type { ChatbotIntent, IntentMatchResult } from "./types";

type PatternRule = {
  intent: ChatbotIntent;
  weight: number;
  patterns: RegExp[];
  entityExtractor?: (raw: string, normalized: string, entities: ExtractedEntities) => Record<string, unknown>;
};

const RULES: PatternRule[] = [
  // 1. Identity & capabilities
  {
    intent: "identity_inquiry",
    weight: 95,
    patterns: [
      /\b(?:quien eres|como te llamas|eres (?:una? )?(?:ia|inteligencia artificial|persona|humano|robot|asistente)|que eres)\b/,
      /\b(?:presentate|de donde eres|cual es tu nombre|tienes ia|usas ia)\b/,
    ],
  },
  // 2. Greeting & Farewell
  {
    intent: "greeting",
    weight: 85,
    patterns: [
      /\b(?:hola|buenos dias|buenas tardes|buenas noches|buenas|que tal|saludos|hey|inicio|empezar)\b/,
    ],
  },
  {
    intent: "farewell",
    weight: 94,
    patterns: [
      /\b(?:adios|hasta luego|chao|nos vemos|hasta pronto|me voy)\b/,
    ],
  },
  {
    intent: "gratitude",
    weight: 92,
    patterns: [
      /\b(?:gracias|muchas gracias|te lo agradezco|mil gracias|perfecto gracias|gracias por la ayuda)\b/,
    ],
  },
  // 3. Clear / Reset
  {
    intent: "clear_conversation",
    weight: 95,
    patterns: [
      /\b(?:reiniciar|borrar chat|empezar de nuevo|limpiar chat|resetear?|nueva conversacion)\b/,
    ],
  },
  // 4. Help & Menu
  {
    intent: "help_menu",
    weight: 85,
    patterns: [
      /\b(?:ayuda|que puedes hacer|en que me puedes ayudar|opciones|menu principal|que opciones tienes)\b/,
    ],
  },
  // 5. PC Builder Pro Compatibility & Assistance
  {
    intent: "pc_builder_compatibility",
    weight: 93,
    patterns: [
      /\b(?:compatible|incompatibl|compatibilidad|entra en la caja|soporta ram|cuanta fuente|lga1700|am5|ddr4|ddr5)\b/,
      /\b(?:es compatible|son compatibles|que significa incompatible|cuantos vatios|cuanta fuente|vatios de fuente|potencia de fuente)\b/,
    ],
  },
  {
    intent: "pc_builder_inquiry",
    weight: 90,
    patterns: [
      /\b(?:pc builder|configurador|montar pc|montar un ordenador|configurar ordenador|crear pc|armar pc|piezas de pc)\b/,
      /\b(?:que es pc builder|como configuro un ordenador|como montar mi pc)\b/,
    ],
  },
  // 6. Product Comparison
  {
    intent: "compare_request",
    weight: 92,
    patterns: [
      /\b(?:compara|comparar|comparativa|diferencia entre|diferencias entre|cual es mejor entre|frente a|vs)\b/,
    ],
  },
  // 7. Product Recommendation
  {
    intent: "recommend_request",
    weight: 88,
    patterns: [
      /\b(?:recomienda|recomiendame|recomendar|cual me recomiendas|que me recomiendas|cual comprar|asesor|sugerencia|consejo)\b/,
      /\b(?:necesito mejorar|para mi oficina|para mi casa|tengo \d+ euros|presupuesto de \d+)\b/,
      /\b(?:cual es el mejor|los mejores|que equipo me viene mejor)\b/,
    ],
  },
  // 8. Order Status & Shopping Help
  {
    intent: "order_inquiry",
    weight: 90,
    patterns: [
      /\b(?:mi pedido|mis pedidos|estado de mi pedido|donde esta mi pedido|consultar pedido|rastrear pedido|seguimiento de pedido)\b/,
      /\b(?:como ver mi pedido|numero de pedido|comprobar mi compra)\b/,
    ],
  },
  {
    intent: "shipping_inquiry",
    weight: 88,
    patterns: [
      /\b(?:envio|envios|cuanto tarda|plazo de entrega|gastos de envio|cuando llega|transporte|agencia de transporte)\b/,
      /\b(?:enviais a|entrega a domicilio)\b/,
    ],
  },
  {
    intent: "warranty_returns_inquiry",
    weight: 88,
    patterns: [
      /\b(?:garantia|devolucion|devoluciones|devolver|rma|desistimiento|reparacion|cuantos anos de garantia)\b/,
      /\b(?:como devolver|plazo de devolucion)\b/,
    ],
  },
  {
    intent: "payment_methods_inquiry",
    weight: 88,
    patterns: [
      /\b(?:metodos de pago|forma de pago|como se paga|pagar con tarjeta|tarjeta|transferencia|checkout simulado|cargo en cuenta)\b/,
      /\b(?:como funciona el pago|se cobra de verdad)\b/,
    ],
  },
  {
    intent: "contact_support_inquiry",
    weight: 85,
    patterns: [
      /\b(?:soporte|atencion al cliente|contacto|contactar|hablar con alguien|humano|telefono|email de soporte|abrir ticket)\b/,
      /\b(?:formulario de contacto|servicio tecnico)\b/,
    ],
  },
  // 9. Categories
  {
    intent: "category_browse",
    weight: 82,
    patterns: [
      /\b(?:categorias|que categorias teneis|catalogo|areas de la tienda|que vendeis|que productos ofreceis)\b/,
      /\b(?:infraestructuras de telecomunicaciones|elementos de sistemas|hogar digital|telefonia fija y movil|digitalizacion productiva)\b/,
    ],
  },
  // 10. Technical FAQs
  {
    intent: "technical_faq",
    weight: 80,
    patterns: [
      /\b(?:que es (?:poe|zigbee|matter|thread|modbus|sfp|voip|ftth|cat6a|cat7|edge|nas|vlan))\b/,
      /\b(?:diferencia entre (?:monomodo y multimodo|cat6 y cat7|wifi 6 y wifi 7|zigbee y matter))\b/,
      /\b(?:para que sirve (?:un rack|un patch panel|un transceptor|una cabecera|un rele din))\b/,
      /\b(?:longitud maxima (?:de ethernet|cable de red)|potencia poe)\b/,
    ],
  },
  // 11. Affirmation / Negation
  {
    intent: "affirmation",
    weight: 70,
    patterns: [
      /^(?:si|claro|por favor|de acuerdo|correcto|perfecto|adelante|ok|vale|eso es)$/,
    ],
  },
  {
    intent: "negation",
    weight: 70,
    patterns: [
      /^(?:no|negativo|cancelar|para nada|ninguno|tampoco|no gracias)$/,
    ],
  },
  // 12. Search Product (Catch variations like "busco switch", "quiero router", "teneis cables")
  {
    intent: "search_product",
    weight: 75,
    patterns: [
      /\b(?:busco|necesito|quiero|comprar|teneis|tienen|muestrame|ver|ensename|precio de|stock de)\b/,
      /\b(?:router|switch|cable|fibra|rack|panel|ap|punto de acceso|camara|videoportero|rele|sensor|centralita|telefono|dect|nas|servidor|modbus|zebra|sfp)\b/,
      /\b(?:legrand|schneider|televes|fluke|ubiquiti|cisco|mikrotik|aqara|fibaro|shelly|grandstream|yealink|patton|teltonika|synology|kingston|samsung)\b/,
    ],
  },
];

/**
 * Classifies an incoming customer query deterministically.
 * Combines pattern matching, keyword presence, entity extraction and rule confidence.
 */
export function classifyIntent(queryText: string): IntentMatchResult {
  const normalized = normalizeText(queryText);
  const entities = extractEntities(queryText);

  if (!normalized) {
    return {
      intent: "unknown",
      confidence: 0,
      entities,
    };
  }

  let bestIntent: ChatbotIntent = "unknown";
  let highestScore = 0;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        if (rule.weight > highestScore) {
          highestScore = rule.weight;
          bestIntent = rule.intent;
        }
      }
    }
  }

  // If a clear product type or brand was extracted and no specific intent was triggered,
  // classify as search_product with high confidence
  if (bestIntent === "unknown" && (entities.productType || entities.brand || entities.budgetEur)) {
    bestIntent = "search_product";
    highestScore = 75;
  }

  return {
    intent: bestIntent,
    confidence: highestScore,
    entities: {
      ...entities,
      rawQuery: queryText,
    },
  };
}
