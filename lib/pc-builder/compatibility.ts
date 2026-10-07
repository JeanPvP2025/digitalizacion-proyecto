import {
  pcBuilderComponents,
  requiredPcBuilderCategories,
} from "./fixtures";
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

const OTHER_COMPONENTS_POWER_W = 75;
const HEADROOM_MULTIPLIER = 1.2;
const PSU_RECOMMENDATION_STEP_W = 50;

const componentsById = new Map<string, PcBuilderComponent>(
  pcBuilderComponents.map((component) => [component.id, component]),
);

const displayCategory: Record<PcBuilderCategory, string> = {
  cpu: "procesador",
  motherboard: "placa base",
  memory: "memoria RAM",
  case: "caja",
  gpu: "gráfica",
  psu: "fuente de alimentación",
  storage: "almacenamiento",
  cooler: "refrigeración",
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
 * Checks the selected demo fixtures and returns issues plus rule-of-thumb
 * totals. This is a display/domain helper, not an authority for a real purchase.
 */
export function checkBuildCompatibility(
  selection: PcBuildSelection,
): PcBuildCompatibility {
  const issues: CompatibilityIssue[] = [];
  const selectedComponents: PcBuilderComponent[] = [];
  const missingCategories: PcBuilderCategory[] = [];

  for (const category of requiredPcBuilderCategories) {
    const selectedId = selection[category];
    if (!selectedId) {
      missingCategories.push(category);
      issues.push({
        code: `missing-${category}`,
        severity: "warning",
        message: `Selecciona un ${displayCategory[category]} para completar la configuración.`,
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

  for (const category of ["gpu", "storage", "cooler"] as const) {
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
      severity: "warning",
      message:
        "No has seleccionado una gráfica dedicada y este procesador no declara gráficos integrados en la ficha demo.",
    });
  }

  const hasPowerEstimate = Boolean(cpu && motherboard && memory);
  const estimatedDrawW = hasPowerEstimate
    ? OTHER_COMPONENTS_POWER_W +
      (cpu?.estimatedPowerW ?? 0) +
      (gpu?.estimatedPowerW ?? 0) +
      (memory?.estimatedPowerW ?? 0) +
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
      "El consumo es una regla práctica: suma estimaciones de CPU, GPU y piezas opcionales, más 75 W para placa y ventiladores. El objetivo de fuente aplica un 20% de margen y se redondea al siguiente tramo de 50 W. El consumo real varía según componentes, carga y configuración.",
  };
}
