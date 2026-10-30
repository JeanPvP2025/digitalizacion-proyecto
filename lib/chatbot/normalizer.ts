/**
 * NODRIA Chatbot Text Normalizer
 * Pure deterministic NLP utilities: accent stripping, tokenization,
 * entity extraction (budget, ports, PoE, brands), synonym resolution,
 * and typo-tolerant Levenshtein distance calculation.
 */

export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,:;()\[\]{}"'\\\/_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Standard Levenshtein distance implementation for short token typo matching */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const val = a[i] === b[j] ? row[j] : Math.min(row[j], row[j + 1], prev) + 1;
      row[j] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/** Checks whether a query word is a close typo of target word within acceptable distance */
export function isTypoMatch(queryWord: string, targetWord: string): boolean {
  if (queryWord === targetWord) return true;
  if (Math.abs(queryWord.length - targetWord.length) > 2) return false;
  if (targetWord.length <= 4) {
    return levenshteinDistance(queryWord, targetWord) <= 1;
  }
  return levenshteinDistance(queryWord, targetWord) <= 2;
}

export const COMMON_TYPOS: Record<string, string> = {
  swich: "switch",
  swicht: "switch",
  suitch: "switch",
  swiches: "switches",
  ruter: "router",
  roter: "router",
  routers: "router",
  enrutador: "router",
  enrutadores: "router",
  ubikiti: "ubiquiti",
  unifi: "ubiquiti",
  cysco: "cisco",
  cisko: "cisco",
  microtik: "mikrotik",
  shely: "shelly",
  zeegbee: "zigbee",
  zigbe: "zigbee",
  mater: "matter",
  thred: "thread",
  voip: "voip",
  televes: "televes",
  fluke: "fluke",
  sinology: "synology",
  sinologi: "synology",
  grandstrem: "grandstream",
  grandtream: "grandstream",
  yelink: "yealink",
  teltonika: "teltonika",
  modbus: "modbus",
  pasarela: "gateway",
  gateway: "gateway",
  gateways: "gateway",
  servidor: "servidor",
  centralita: "centralita",
  pbx: "centralita",
};

export const SYNONYMS: Record<string, string> = {
  // Networking
  conmutador: "switch",
  conmutadores: "switch",
  switches: "switch",
  router: "router",
  routers: "router",
  enrutador: "router",
  enrutadores: "router",
  ap: "access_point",
  punto_acceso: "access_point",
  puntos_acceso: "access_point",
  wifi: "wifi",
  inalambrico: "wifi",
  inalambrica: "wifi",
  transceptor: "sfp",
  transceptores: "sfp",
  sfp: "sfp",
  "sfp+": "sfp",
  // Fiber & Cabling
  fibra: "fibra",
  ftth: "fibra",
  monomodo: "fibra",
  multimodo: "fibra",
  cable: "cable",
  cableado: "cable",
  latiguillo: "cable",
  patchcord: "cable",
  bobina: "cable",
  cat6: "cat6a",
  cat6a: "cat6a",
  cat7: "cat7",
  patch_panel: "panel_parcheo",
  panel_parcheo: "panel_parcheo",
  rack: "rack",
  racks: "rack",
  armario: "rack",
  mural: "rack",
  // Smart home & IoT
  domotica: "domotica",
  iot: "domotica",
  automatizar: "domotica",
  automatizacion: "domotica",
  smart_home: "domotica",
  zigbee: "zigbee",
  matter: "matter",
  thread: "thread",
  rele: "rele",
  reles: "rele",
  actuador: "rele",
  sensor: "sensor",
  sensores: "sensor",
  sonda: "sensor",
  videoportero: "videoportero",
  termostato: "termostato",
  // Telephony
  centralita: "centralita",
  ip_pbx: "centralita",
  sip: "telefono_ip",
  voip: "voip",
  telefono: "telefono_ip",
  telefonos: "telefono_ip",
  dect: "telefono_dect",
  // Industrial & Digitization
  industrial: "industrial",
  nas: "nas",
  almacenamiento: "nas",
  edge: "edge_server",
  servidor: "edge_server",
  modbus: "modbus",
  escaner: "lector_codigo",
  lector: "lector_codigo",
  zebra: "zebra",
  // PC Builder
  procesador: "cpu",
  cpu: "cpu",
  grafica: "gpu",
  gpu: "gpu",
  placa: "motherboard",
  motherboard: "motherboard",
  ram: "ram",
  memoria: "ram",
  fuente: "psu",
  psu: "psu",
  caja: "case",
  chasis: "case",
  refrigeracion: "cooler",
  cooler: "cooler",
  disipador: "cooler",
  ssd: "storage",
  disco: "storage",
};

export const BRANDS = [
  "legrand",
  "schneider",
  "schneider electric",
  "televes",
  "fluke",
  "fluke networks",
  "ubiquiti",
  "cisco",
  "mikrotik",
  "aqara",
  "fibaro",
  "shelly",
  "grandstream",
  "yealink",
  "patton",
  "teltonika",
  "advantech",
  "phoenix contact",
  "phoenix",
  "moxa",
  "synology",
  "kingston",
  "samsung",
  "zebra",
  "intel",
  "amd",
  "asus",
  "msi",
  "gigabyte",
  "corsair",
  "be quiet",
  "noctua",
];

export type ExtractedEntities = {
  budgetEur?: number;
  portCount?: number;
  poeRequired?: boolean;
  brand?: string;
  wifiStandard?: string;
  categorySlug?: string;
  productType?: string;
  tokens: string[];
};

/** Extracts structured slots and entities from normalized query text */
export function extractEntities(rawText: string): ExtractedEntities {
  const normalized = normalizeText(rawText);
  const entities: ExtractedEntities = {
    tokens: [],
  };

  // 1. Budget extraction: e.g. "200 euros", "200€", "presupuesto de 150", "hasta 300", "menos de 500"
  const budgetMatch =
    normalized.match(/(?:presupuesto(?:\s+de)?|hasta|menos\s+de|maximo\s+de|por|tengo)\s+(\d{2,5})\s*(?:€|euros?|eur)?/) ??
    normalized.match(/(\d{2,5})\s*(?:€|euros?|eur)\b/);
  if (budgetMatch && budgetMatch[1]) {
    const val = parseInt(budgetMatch[1], 10);
    if (!Number.isNaN(val) && val > 0 && val <= 50000) {
      entities.budgetEur = val;
    }
  }

  // 2. Port count extraction: e.g. "24 puertos", "24p", "switch de 8", "16 bocas"
  const portsMatch =
    normalized.match(/(\d{1,2})\s*(?:puertos?|bocas?|p\b)/) ??
    normalized.match(/(?:de|con)\s+(\d{1,2})\s+puertos?/);
  if (portsMatch && portsMatch[1]) {
    const ports = parseInt(portsMatch[1], 10);
    if ([4, 5, 8, 10, 16, 24, 28, 48, 52].includes(ports)) {
      entities.portCount = ports;
    }
  }

  // 3. PoE requirement: "poe", "poe+", "poe++", "con poe", "alimentacion poe"
  if (/\bpoe\+{0,2}\b/.test(normalized) || /\bcon poe\b/.test(normalized)) {
    entities.poeRequired = true;
  }

  // 4. Wi-Fi standard: "wifi 6", "wifi 6e", "wifi 7", "wi-fi 6", "wi fi 7"
  const wifiMatch = normalized.match(/(?:wi\s*fi|wifi)\s*(6e|6|7)/i);
  if (wifiMatch && wifiMatch[1]) {
    entities.wifiStandard = `Wi-Fi ${wifiMatch[1].toUpperCase()}`;
  }

  // 5. Brand extraction
  for (const brand of BRANDS) {
    if (new RegExp(`\\b${brand}\\b`).test(normalized)) {
      entities.brand = brand;
      break;
    }
  }

  // 6. Tokenization and Canonical Synonym Resolution
  const words = normalized.split(/\s+/).filter(Boolean);
  const resolvedTokens: string[] = [];
  for (const word of words) {
    // Check direct typos
    const corrected = COMMON_TYPOS[word] ?? word;
    // Check synonyms
    const canonical = SYNONYMS[corrected] ?? corrected;
    resolvedTokens.push(canonical);

    // Map to primary product types if not set yet
    if (!entities.productType) {
      if (["switch", "router", "access_point", "sfp", "fibra", "cable", "rack", "panel_parcheo", "domotica", "zigbee", "matter", "rele", "sensor", "videoportero", "centralita", "telefono_ip", "nas", "edge_server", "modbus", "cpu", "gpu", "ram", "motherboard", "psu", "case", "cooler", "storage"].includes(canonical)) {
        entities.productType = canonical;
      }
    }
  }
  entities.tokens = resolvedTokens;

  return entities;
}
