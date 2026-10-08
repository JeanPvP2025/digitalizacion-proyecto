/** Curated equivalences, not product recommendations or invented attributes. */
const groups = [
  ["ordenador", "ordenadores", "computer", "computers", "pc"],
  ["portatil", "portatiles", "laptop", "laptops", "notebook", "notebooks"],
  ["sobremesa", "desktop", "desktops"],
  ["monitor", "monitores", "monitors", "display", "displays"],
  ["redes", "network", "networking"],
  ["telefonia", "phone", "phones", "telefono", "telefonos", "smartphone", "smartphones"],
  ["almacenamiento", "storage"],
  ["componentes", "components", "componente", "component"],
  ["procesador", "procesadores", "processor", "processors", "cpu"],
  ["grafica", "graficas", "graphics", "gpu"],
  ["memoria", "memory", "ram"],
  ["placa", "motherboard", "motherboards"],
  ["fuente", "psu"],
  ["caja", "chasis", "case"],
  ["refrigeracion", "cooling", "cooler"],
  ["inalambrico", "inalambrica", "wireless"],
  ["pantalla", "screen"],
  ["resolucion", "resolution"],
  ["frecuencia", "refresh"],
  ["conexiones", "puertos", "ports", "conectividad", "connectivity"],
  ["nucleos", "cores"],
  ["pulgadas", "inch", "inches"],
] as const;

const concepts = new Map<string, string>();
for (const group of groups) for (const word of group) concepts.set(word, group[0]);

const stopWords = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "con", "para", "y", "the", "with", "for", "and"]);

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/\s+/g, " ").trim();
}

export function searchTokens(value: string): string[] {
  const normalized = normalizeSearchText(value)
    .replace(/\b(?:solid[ -]state[ -]drive|unidad de estado solido|disco de estado solido)\b/g, "ssd")
    .replace(/\b(?:hard[ -](?:disk|drive)|disco duro)\b/g, "hdd")
    .replace(/\b(?:tarjeta grafica|graphics card|video card)\b/g, "gpu")
    .replace(/\b(?:placa base|placa madre)\b/g, "motherboard")
    .replace(/\b(?:fuente de alimentacion|power supply)\b/g, "psu")
    .replace(/\bwi[\s-]?fi\b/g, "wifi")
    .replace(/\busb[\s-]?c\b/g, "usbc")
    .replace(/\b(wifi|rtx|gtx|rx)(?=\d)/g, "$1 ")
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(gb|tb|mb|ghz|mhz|hz|w)\b/g, (_, amount: string, unit: string) => amount.replace(",", ".") + unit);
  return [...new Set((normalized.match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? []).filter((word) => !stopWords.has(word)))];
}

export function searchConcept(word: string): string {
  return concepts.get(word) ?? word;
}

/** One insertion/deletion/substitution or adjacent transposition; never fuzz numbers/SKUs. */
export function isSearchTypo(query: string, candidate: string): boolean {
  if (!/^[a-z]{5,24}$/.test(query) || !/^[a-z]{5,24}$/.test(candidate) || Math.abs(query.length - candidate.length) > 1) return false;
  if (query === candidate) return false;
  let index = 0;
  while (query[index] === candidate[index] && index < Math.min(query.length, candidate.length)) index++;
  if (query.length === candidate.length) {
    return query.slice(index + 1) === candidate.slice(index + 1)
      || (query[index] === candidate[index + 1] && query[index + 1] === candidate[index] && query.slice(index + 2) === candidate.slice(index + 2));
  }
  const [shorter, longer] = query.length < candidate.length ? [query, candidate] : [candidate, query];
  return shorter.slice(index) === longer.slice(index + 1);
}
