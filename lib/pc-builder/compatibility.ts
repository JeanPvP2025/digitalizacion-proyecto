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
  StorageFixture,
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
  const storage = byCategory(selectedComponents, "storage") as
    | StorageFixture
    | undefined;
  const cooler = byCategory(selectedComponents, "cooler") as
    | CoolerFixture
    | undefined;

  if (cpu && motherboard && cpu.socket !== motherboard.socket) {
    issues.push({
      code: "socket-mismatch",
      severity: "error",
      message: `El socket del procesador (${cpu.socket}) no coincide con el de la placa base (${motherboard.socket}).`,
    });
  }

  if (motherboard && memory && motherboard.memoryGeneration !== memory.generation) {
    issues.push({
      code: "memory-generation-mismatch",
      severity: "error",
      message: `La placa base usa ${motherboard.memoryGeneration} y la memoria seleccionada es ${memory.generation}.`,
    });
  }

  if (
    cpu &&
    motherboard &&
    !cpu.memoryGenerations.includes(motherboard.memoryGeneration)
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
    memory.capacityGb > motherboard.maxMemoryGb
  ) {
    issues.push({
      code: "memory-capacity-exceeded",
      severity: "error",
      message: `La memoria suma ${memory.capacityGb} GB y supera el máximo declarado de ${motherboard.maxMemoryGb} GB de la placa base.`,
    });
  }

  if (
    motherboard &&
    pcCase &&
    !pcCase.supportedFormFactors.includes(motherboard.formFactor)
  ) {
    issues.push({
      code: "case-form-factor-mismatch",
      severity: "error",
      message: `La caja no admite el formato ${motherboard.formFactor} de la placa base.`,
    });
  }

  if (gpu && pcCase && gpu.lengthMm > pcCase.maxGpuLengthMm) {
    issues.push({
      code: "gpu-too-long",
      severity: "error",
      message: `La gráfica mide ${gpu.lengthMm} mm y la caja admite hasta ${pcCase.maxGpuLengthMm} mm.`,
    });
  }

  if (cpu && cooler && !cooler.supportedSockets.includes(cpu.socket)) {
    issues.push({
      code: "cooler-socket-mismatch",
      severity: "error",
      message: `La refrigeración seleccionada no declara compatibilidad con el socket ${cpu.socket}.`,
    });
  }

  if (!gpu && cpu && !cpu.integratedGraphics) {
    issues.push({
      code: "graphics-may-be-required",
      severity: "error",
      message:
        "No has seleccionado una gráfica dedicada y este procesador no declara gráficos integrados en la ficha demo.",
    });
  }

  const hasPowerEstimate = Boolean(cpu && motherboard && memory && pcCase);
  const estimatedDrawW = hasPowerEstimate
    ? (cpu?.estimatedPowerW ?? 0) +
      (motherboard?.estimatedPowerW ?? 0) +
      (memory?.estimatedPowerW ?? 0) +
      (pcCase?.estimatedPowerW ?? 0) +
      (gpu?.estimatedPowerW ?? 0) +
      (storage?.estimatedPowerW ?? 0) +
      (cooler?.estimatedPowerW ?? 0)
    : null;
  const recommendedPsuW =
    estimatedDrawW === null
      ? null
      : roundUpToStep(
          estimatedDrawW * HEADROOM_MULTIPLIER,
          PSU_RECOMMENDATION_STEP_W,
        );

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
      "Estimación orientativa: se suman las potencias declaradas para CPU, placa, memoria, caja y piezas opcionales. La recomendación de fuente añade un 20% y redondea al siguiente tramo de 50 W. El consumo real depende de componentes, carga y configuración; checkout vuelve a validar disponibilidad y precio.",
  };
}
