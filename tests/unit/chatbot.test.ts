import { describe, expect, it } from "vitest";
import { demoProducts } from "@/lib/catalog";
import {
  normalizeText,
  levenshteinDistance,
  isTypoMatch,
  extractEntities,
  COMMON_TYPOS,
} from "@/lib/chatbot/normalizer";
import { classifyIntent } from "@/lib/chatbot/intents";
import { findKnowledgeEntry, KNOWLEDGE_BASE } from "@/lib/chatbot/knowledge-base";
import { recommendProducts, extractProductPorts, hasProductPoE } from "@/lib/chatbot/recommendations";
import { buildProductComparison, findComparisonCandidates } from "@/lib/chatbot/comparisons";
import { getPcBuilderAdvice } from "@/lib/chatbot/pc-builder-advisor";
import { handleDialogueTurn, getInitialWelcomeMessage } from "@/lib/chatbot/dialogue-manager";
import { processChatbotMessage } from "@/lib/chatbot";

describe("Chatbot Normalizer & Entity Extraction", () => {
  it("normalizes text by stripping accents, lowercasing, and removing punctuation", () => {
    expect(normalizeText("¿Qué categorías tenéis? ¡Hola!")).toBe("que categorias teneis hola");
    expect(normalizeText("  SWITCH   de 24 PUERTOS!!  ")).toBe("switch de 24 puertos");
  });

  it("calculates Levenshtein distance accurately", () => {
    expect(levenshteinDistance("switch", "swich")).toBe(1);
    expect(levenshteinDistance("router", "ruter")).toBe(1);
    expect(levenshteinDistance("ubiquiti", "ubikiti")).toBe(2);
    expect(levenshteinDistance("same", "same")).toBe(0);
  });

  it("identifies typo matches within tolerance", () => {
    expect(isTypoMatch("swich", "switch")).toBe(true);
    expect(isTypoMatch("ruter", "router")).toBe(true);
    expect(isTypoMatch("totalmente_diferente", "switch")).toBe(false);
  });

  it("corrects common typos into canonical terms", () => {
    expect(COMMON_TYPOS["swich"]).toBe("switch");
    expect(COMMON_TYPOS["ruter"]).toBe("router");
    expect(COMMON_TYPOS["microtik"]).toBe("mikrotik");
    expect(COMMON_TYPOS["shely"]).toBe("shelly");
    expect(COMMON_TYPOS["zeegbee"]).toBe("zigbee");
  });

  it("extracts budget slot correctly", () => {
    const e1 = extractEntities("Tengo un presupuesto de 250 euros para un switch");
    expect(e1.budgetEur).toBe(250);

    const e2 = extractEntities("busco router por menos de 150€");
    expect(e2.budgetEur).toBe(150);

    const e3 = extractEntities("hasta 400 eur");
    expect(e3.budgetEur).toBe(400);
  });

  it("extracts port count and PoE requirements", () => {
    const entities = extractEntities("Necesito un switch de 24 puertos con PoE+");
    expect(entities.portCount).toBe(24);
    expect(entities.poeRequired).toBe(true);
    expect(entities.productType).toBe("switch");
  });

  it("extracts brand and Wi-Fi standard", () => {
    const entities = extractEntities("Puntos de acceso Ubiquiti con Wi-Fi 7");
    expect(entities.brand).toBe("ubiquiti");
    expect(entities.wifiStandard).toBe("Wi-Fi 7");
  });
});

describe("Chatbot Intent Classification", () => {
  it("classifies identity inquiry with strict transparency", () => {
    const r1 = classifyIntent("¿Quién eres?");
    expect(r1.intent).toBe("identity_inquiry");

    const r2 = classifyIntent("¿Eres una inteligencia artificial?");
    expect(r2.intent).toBe("identity_inquiry");
  });

  it("classifies greetings, farewells and gratitude", () => {
    expect(classifyIntent("Hola, buenos días").intent).toBe("greeting");
    expect(classifyIntent("Hasta luego, gracias").intent).toBe("farewell");
    expect(classifyIntent("Muchas gracias por la ayuda").intent).toBe("gratitude");
  });

  it("classifies PC Builder inquiries and compatibility", () => {
    expect(classifyIntent("¿Qué es PC Builder PRO?").intent).toBe("pc_builder_inquiry");
    expect(classifyIntent("¿Cómo sé si el procesador es compatible con la placa?").intent).toBe(
      "pc_builder_compatibility"
    );
    expect(classifyIntent("¿Cuántos vatios de fuente necesito para mi gráfica?").intent).toBe(
      "pc_builder_compatibility"
    );
  });

  it("classifies product comparisons", () => {
    const r = classifyIntent("Compara UniFi UDM con MikroTik RB5009");
    expect(r.intent).toBe("compare_request");
  });

  it("classifies order and checkout questions", () => {
    expect(classifyIntent("¿Dónde está mi pedido?").intent).toBe("order_inquiry");
    expect(classifyIntent("¿Cómo funciona el pago simulado?").intent).toBe("payment_methods_inquiry");
    expect(classifyIntent("¿Cuánto tardan los envíos?").intent).toBe("shipping_inquiry");
    expect(classifyIntent("¿Qué garantía tienen los productos?").intent).toBe("warranty_returns_inquiry");
    expect(classifyIntent("Quiero contactar con soporte técnico").intent).toBe("contact_support_inquiry");
  });

  it("classifies category browsing", () => {
    expect(classifyIntent("¿Qué categorías tenéis en el catálogo?").intent).toBe("category_browse");
  });
});

describe("Chatbot Technical Knowledge Base", () => {
  it("finds PoE standards entry and explains wattage", () => {
    const entry = findKnowledgeEntry("¿Qué es PoE y cuántos vatios entrega?");
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe("faq_poe_standards");
    expect(entry?.content).toContain("802.3af");
    expect(entry?.content).toContain("802.3bt");
  });

  it("finds fiber optic OS2 vs OM4 explanation", () => {
    const entry = findKnowledgeEntry("Diferencia entre monomodo y multimodo");
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe("faq_fiber_os2_vs_om4");
    expect(entry?.content).toContain("OS2");
    expect(entry?.content).toContain("OM4");
  });

  it("finds Zigbee vs Matter vs Thread", () => {
    const entry = findKnowledgeEntry("Diferencia entre Zigbee y Matter");
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe("faq_zigbee_matter_thread");
    expect(entry?.content).toContain("IPv6");
  });

  it("confirms NO AI statement in identity entry", () => {
    const entry = KNOWLEDGE_BASE.find((e) => e.id === "identity_who_are_you");
    expect(entry).toBeDefined();
    expect(entry?.content).toContain("No utilizo inteligencia artificial generativa");
    expect(entry?.content).toContain("motor determinista");
  });
});

describe("Chatbot Product Recommendations", () => {
  it("extracts ports and PoE from real catalog products", () => {
    const switch24 = demoProducts.find((p) => p.name.includes("24"));
    if (switch24) {
      const ports = extractProductPorts(switch24);
      expect(ports).toBe(24);
      expect(hasProductPoE(switch24)).toBe(true);
    }
  });

  it("recommends switches with PoE within budget", () => {
    const result = recommendProducts(demoProducts, {
      productType: "switch",
      poeRequired: true,
      budgetEur: 600,
    });

    expect(result.products.length).toBeGreaterThan(0);
    const top = result.products[0];
    expect(top.product.price).toBeLessThanOrEqual(600);
    expect(top.reason).toBeDefined();
    expect(top.product.keySpecs).toBeDefined();
  });

  it("handles brand filtering (e.g. Ubiquiti)", () => {
    const result = recommendProducts(demoProducts, {
      brand: "ubiquiti",
    });

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.every((p) => p.product.brand.toLowerCase().includes("ubiquiti"))).toBe(true);
  });
});

describe("Chatbot Product Comparisons", () => {
  it("finds candidate products from a comparison query", () => {
    const candidates = findComparisonCandidates("compara unifi con mikrotik", demoProducts);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });

  it("builds a structured comparison table with verdict and specs", () => {
    const p1 = demoProducts[0];
    const p2 = demoProducts[1];
    const comp = buildProductComparison([p1, p2]);

    expect(comp.table.title).toContain("Comparativa técnica");
    expect(comp.table.products).toHaveLength(2);
    expect(comp.table.attributes).toContain("Precio");
    expect(comp.table.attributes).toContain("Fabricante");
    expect(comp.table.verdict).toBeDefined();
    expect(comp.quickReplies.length).toBeGreaterThan(0);
  });
});

describe("PC Builder Advisor", () => {
  it("explains socket AM5 vs LGA1700 compatibility", () => {
    const advice = getPcBuilderAdvice("¿Qué placa necesito para un Ryzen AM5?");
    expect(advice.title).toContain("Socket");
    expect(advice.explanation).toContain("AM5");
    expect(advice.explanation).toContain("DDR5");
  });

  it("explains PSU wattage formula with 20% headroom", () => {
    const advice = getPcBuilderAdvice("¿Cuántos vatios de fuente necesito?");
    expect(advice.title).toContain("Fuente");
    expect(advice.explanation).toContain("1.20");
  });
});

describe("Dialogue Manager & Multi-Turn State", () => {
  it("provides path-aware welcome message for /configurador", () => {
    const welcome = getInitialWelcomeMessage("/configurador");
    expect(welcome.text).toContain("PC Builder PRO");
    expect(welcome.quickReplies?.some((qr) => qr.payload.includes("socket"))).toBe(true);
  });

  it("provides path-aware welcome message for /carrito", () => {
    const welcome = getInitialWelcomeMessage("/carrito");
    expect(welcome.text).toContain("pedido");
    expect(welcome.quickReplies?.some((qr) => qr.payload.includes("pago"))).toBe(true);
  });

  it("manages multi-turn slot filling for switch recommendations", () => {
    // Turn 1: user asks for switch without criteria
    const turn1 = handleDialogueTurn("Recomiéndame un switch", {}, demoProducts);
    expect(turn1.text).toContain("¿Cuántos puertos necesitas");
    expect(turn1.contextUpdate?.flow?.type).toBe("recommend_switch");

    // Turn 2: user answers with ports and poe
    const turn2 = handleDialogueTurn(
      "24 puertos con PoE",
      turn1.contextUpdate || {},
      demoProducts
    );
    expect(turn2.products).toBeDefined();
    expect(turn2.products!.length).toBeGreaterThan(0);
    expect(turn2.contextUpdate?.flow).toBeUndefined(); // flow completed
  });

  it("escalates gracefully to support after repeated unrecognized queries", () => {
    const turn1 = handleDialogueTurn("palabraextrañainexistente12345", {}, demoProducts);
    expect(turn1.contextUpdate?.unrecognizedCount).toBe(1);

    const turn2 = handleDialogueTurn("otraconsultasincomprender999", turn1.contextUpdate || {}, demoProducts);
    expect(turn2.contextUpdate?.unrecognizedCount).toBe(2);
    expect(turn2.text).toContain("Soporte Técnico");
    expect(turn2.quickReplies?.some((qr) => qr.payload.includes("soporte"))).toBe(true);
  });

  it("resets conversation on clear_conversation intent", () => {
    const turn = handleDialogueTurn("reiniciar chat", { budgetEur: 300, portCount: 24 }, demoProducts);
    expect(turn.text).toContain("reiniciado");
    expect(turn.contextUpdate?.budgetEur).toBeUndefined();
    expect(turn.contextUpdate?.portCount).toBeUndefined();
  });
});

describe("processChatbotMessage Entry Point", () => {
  it("processes empty message by returning welcome", () => {
    const result = processChatbotMessage({ message: "" });
    expect(result.text).toContain("Asistente NODRIA");
    expect(result.quickReplies).toBeDefined();
  });

  it("processes queries using default demoProducts if catalog is omitted", () => {
    const result = processChatbotMessage({ message: "¿Qué es PoE?" });
    expect(result.text).toContain("Power over Ethernet");
  });
});
