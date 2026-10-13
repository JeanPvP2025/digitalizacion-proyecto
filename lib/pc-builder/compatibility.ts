import type {
  CaseFixture,
  CompatibilityIssue,
  CpuFixture,
  CoolerFixture,
  GpuFixture,
  MemoryFixture,
  MotherboardFixture,
  PcBuildCompatibility,
  PcBuildSelection,
  PcBuilderCategory,
  PcBuilderComponent,
  PsuFixture,
} from "./types";

export const pcBuilderCategories: readonly PcBuilderCategory[] = [
  "cpu", "motherboard", "memory", "case", "psu",
  "gpu", "storage", "cooler",
];

export const requiredPcBuilderCategories: readonly PcBuilderCategory[] = pcBuilderCategories.slice(0, 5);
export const optionalPcBuilderCategories: readonly PcBuilderCategory[] = pcBuilderCategories.slice(5);

const HEADROOM_MULTIPLIER = 1.2;
const PSU_RECOMMENDATION_STEP_W = 50;

const displayCategory: Record<PcBuilderCategory, string> = {
  cpu: "el procesador",
  motherboard: "la placa base",
  memory: "la memoria RAM",
  case: "la caja",
  gpu: "la gráfica",
  psu: "la fuente de alimentación",
  storage: "el almacenamiento",
  cooler: "la refrigeración",
};

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function byCategory<Category extends PcBuilderCategory>(
  components: readonly PcBuilderComponent[],
  category: Category,
): Extract<PcBuilderComponent, { category: Category }> | undefined {
  return components.find((component) => component.category === category) as
    | Extract<PcBuilderComponent, { category: Category }>
    | undefined;
}

/**
 * Checks catalogue components using only their typed `pc_builder` attributes.
 * It does not authorize a purchase; checkout must validate the selected
 * variant IDs and current price/stock on the server. Consumers must pass the
 * server-loaded catalogue explicitly, including an empty list.
 */
export function checkBuildCompatibility(
  selection: PcBuildSelection,
  components: readonly PcBuilderComponent[],
): PcBuildCompatibility {
  const issues: CompatibilityIssue[] = [];
  const selectedComponents: PcBuilderComponent[] = [];
  const missingCategories: PcBuilderCategory[] = [];

  const componentsById = new Map(components.map((component) => [component.variantId ?? component.id, component]));

  for (const category of requiredPcBuilderCategories) {
    const selectedId = selection[category];
    if (!selectedId) {
      missingCategories.push(category);
      issues.push({
        code: `missing-${category}`,
        severity: "warning",
        message: `Selecciona ${displayCategory[category]} para completar la configuración.`,
      });
      continue;
    }

    const component = componentsById.get(selectedId);
    if (!component || component.category !== category) {
      missingCategories.push(category);
      issues.push({
        code: `invalid-${category}`,
        severity: "error",
        message: `La selección de ${displayCategory[category]} no corresponde a una pieza disponible.`,
      });
      continue;
    }
    selectedComponents.push(component);
  }

  for (const category of optionalPcBuilderCategories) {
    const selectedId = selection[category];
    if (!selectedId) continue;

    const component = componentsById.get(selectedId);
    if (!component || component.category !== category) {
      issues.push({
        code: `invalid-${category}`,
        severity: "error",
        message: `La selección de ${displayCategory[category]} no corresponde a una pieza disponible.`,
      });
      continue;
    }
    selectedComponents.push(component);
  }

  const cpu = byCategory(selectedComponents, "cpu") as CpuFixture | undefined;
  const motherboard = byCategory(selectedComponents, "motherboard") as
    | MotherboardFixture
    | undefined;
  const memory = byCategory(selectedComponents, "memory") as MemoryFixture | undefined;
  const pcCase = byCategory(selectedComponents, "case") as CaseFixture | undefined;
  const gpu = byCategory(selectedComponents, "gpu") as GpuFixture | undefined;
  const psu = byCategory(selectedComponents, "psu") as PsuFixture | undefined;
  const cooler = byCategory(selectedComponents, "cooler") as
    | CoolerFixture
    | undefined;

  if (cpu && motherboard) {
    if (cpu.socket && motherboard.socket && cpu.socket !== motherboard.socket) {
      issues.push({ code: "socket-mismatch", severity: "error", message: `El socket del procesador (${cpu.socket}) no coincide con el de la placa base (${motherboard.socket}).` });
    } else if (!cpu.socket || !motherboard.socket) {
      issues.push({ code: "socket-unverified", severity: "warning", message: "La ficha de CPU o placa base no publica el socket; revisa la compatibilidad manualmente." });
    }
  }

  if (motherboard && memory) {
    if (motherboard.memoryGeneration && memory.generation && motherboard.memoryGeneration !== memory.generation) {
      issues.push({ code: "memory-generation-mismatch", severity: "error", message: `La placa base usa ${motherboard.memoryGeneration} y la memoria seleccionada es ${memory.generation}.` });
    } else if (!motherboard.memoryGeneration || !memory.generation) {
      issues.push({ code: "memory-generation-unverified", severity: "warning", message: "La generación de memoria no está publicada en una de las fichas seleccionadas." });
    }
  }

  if (
    cpu &&
    motherboard &&
    cpu.memoryGenerations && motherboard.memoryGeneration && !cpu.memoryGenerations.includes(motherboard.memoryGeneration)
  ) {
    issues.push({
      code: "cpu-memory-generation-mismatch",
      severity: "error",
      message: `La compatibilidad de memoria declarada para el procesador no incluye ${motherboard.memoryGeneration}.`,
    });
  }

  if (
    motherboard &&
    memory &&
    memory.capacityGb !== undefined && motherboard.maxMemoryGb !== undefined && memory.capacityGb > motherboard.maxMemoryGb
  ) {
    issues.push({
      code: "memory-capacity-exceeded",
      severity: "error",
      message: `La memoria suma ${memory.capacityGb} GB y supera el máximo declarado de ${motherboard.maxMemoryGb} GB de la placa base.`,
    });
  }
  if (motherboard && memory && motherboard.maxMemoryGb === undefined) {
    issues.push({ code: "memory-capacity-unverified", severity: "warning", message: "La placa base no publica su capacidad máxima de memoria en la ficha consultada." });
  }

  if (motherboard && pcCase) {
    if (motherboard.formFactor && pcCase.supportedFormFactors && !pcCase.supportedFormFactors.includes(motherboard.formFactor)) {
      issues.push({ code: "case-form-factor-mismatch", severity: "error", message: `La caja no admite el formato ${motherboard.formFactor} de la placa base.` });
    } else if (!motherboard.formFactor || !pcCase.supportedFormFactors) {
      issues.push({ code: "case-form-factor-unverified", severity: "warning", message: "Una de las fichas no publica el formato de placa o los formatos admitidos por la caja." });
    }
  }

  if (gpu && pcCase) {
    if (gpu.lengthMm !== undefined && pcCase.maxGpuLengthMm !== undefined && gpu.lengthMm > pcCase.maxGpuLengthMm) {
      issues.push({ code: "gpu-too-long", severity: "error", message: `La gráfica mide ${gpu.lengthMm} mm y la caja admite hasta ${pcCase.maxGpuLengthMm} mm.` });
    } else if (gpu.lengthMm === undefined || pcCase.maxGpuLengthMm === undefined) {
      issues.push({ code: "gpu-clearance-unverified", severity: "warning", message: "No se puede verificar el espacio de la gráfica: falta una dimensión publicada de GPU o caja." });
    }
  }

  if (cpu && cooler) {
    if (cpu.socket && cooler.supportedSockets && !cooler.supportedSockets.includes(cpu.socket)) {
      issues.push({ code: "cooler-socket-mismatch", severity: "error", message: `La refrigeración seleccionada no declara compatibilidad con el socket ${cpu.socket}.` });
    } else if (!cpu.socket || !cooler.supportedSockets) {
      issues.push({ code: "cooler-socket-unverified", severity: "warning", message: "La ficha de la refrigeración o del procesador no permite verificar el socket." });
    }
  }

  if (!gpu && cpu && cpu.integratedGraphics === false) {
    issues.push({
      code: "graphics-may-be-required",
      severity: "error",
      message:
        "No has seleccionado una gráfica dedicada y el procesador no declara gráficos integrados en la ficha consultada.",
    });
  }

  const powerComponents = selectedComponents.filter((component) => component.category !== "psu");
  const hasPowerEstimate = Boolean(cpu && motherboard && memory && pcCase &&
    powerComponents.every((component) => "estimatedPowerW" in component && component.estimatedPowerW !== undefined));
  const estimatedDrawW = hasPowerEstimate
    ? powerComponents.reduce((total, component) => total + ("estimatedPowerW" in component ? component.estimatedPowerW ?? 0 : 0), 0)
    : null;
  const recommendedPsuW =
    estimatedDrawW === null
      ? null
      : roundUpToStep(
          estimatedDrawW * HEADROOM_MULTIPLIER,
          PSU_RECOMMENDATION_STEP_W,
        );

  if (cpu && motherboard && memory && pcCase && estimatedDrawW === null) {
    issues.push({ code: "power-estimate-unavailable", severity: "warning", message: "Las fichas no publican datos de potencia para todas las piezas seleccionadas; no se calcula consumo ni fuente recomendada." });
  }

  if (psu && estimatedDrawW !== null && recommendedPsuW !== null) {
    if (psu.capacityW < estimatedDrawW) {
      issues.push({
        code: "psu-below-estimated-draw",
        severity: "error",
        message: `La fuente ofrece ${psu.capacityW} W, por debajo de la estimación orientativa de consumo de ${estimatedDrawW} W.`,
      });
    } else if (psu.capacityW < recommendedPsuW) {
      issues.push({
        code: "psu-headroom-below-guideline",
        severity: "warning",
        message: `La fuente cubre la estimación orientativa de ${estimatedDrawW} W, pero no alcanza los ${recommendedPsuW} W recomendados como regla práctica con margen del 20%.`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const status = errors.length
    ? "incompatible"
    : missingCategories.length
      ? "incomplete"
      : warnings.length
        ? "review"
        : "compatible";

  return {
    status,
    selectedComponents,
    missingCategories,
    totalPriceEur: selectedComponents.reduce(
      (total, component) => total + component.priceEur,
      0,
    ),
    estimatedDrawW,
    recommendedPsuW,
    issues,
    errors,
    warnings,
    estimateNote:
      "Solo se comparan atributos publicados por las fichas del fabricante o comercio. Si un dato necesario no aparece, se muestra como no verificado y requiere comprobación manual. La potencia de CPU/GPU publicada no equivale al consumo exacto de un equipo. NODRIA no vende estos productos ni valida stock o compatibilidad completa.",
  };
}
