import { describe, expect, it } from "vitest";
import { checkBuildCompatibility, pcBuilderCategories } from "../../lib/pc-builder/compatibility";
import type { PcBuildSelection, PcBuilderComponent } from "../../lib/pc-builder/types";

const testParts: PcBuilderComponent[] = [
  { id: "test-cpu-am5", category: "cpu", name: "CPU fixture AM5", manufacturer: "Test fixture", priceEur: 369, description: "Test only", socket: "AM5", memoryGenerations: ["DDR5"], estimatedPowerW: 120, integratedGraphics: true },
  { id: "test-cpu-lga", category: "cpu", name: "CPU fixture LGA", manufacturer: "Test fixture", priceEur: 579, description: "Test only", socket: "LGA1851", memoryGenerations: ["DDR5"], estimatedPowerW: 180, integratedGraphics: true },
  { id: "test-cpu-ddr4", category: "cpu", name: "CPU fixture DDR4", manufacturer: "Test fixture", priceEur: 219, description: "Test only", socket: "LGA1700", memoryGenerations: ["DDR4"], estimatedPowerW: 75, integratedGraphics: false },
  { id: "test-board-am5", category: "motherboard", name: "Board fixture AM5", manufacturer: "Test fixture", priceEur: 229, description: "Test only", socket: "AM5", formFactor: "ATX", memoryGeneration: "DDR5", maxMemoryGb: 192, estimatedPowerW: 50 },
  { id: "test-board-lga", category: "motherboard", name: "Board fixture LGA", manufacturer: "Test fixture", priceEur: 349, description: "Test only", socket: "LGA1851", formFactor: "ATX", memoryGeneration: "DDR5", maxMemoryGb: 192, estimatedPowerW: 50 },
  { id: "test-ram-ddr5", category: "memory", name: "RAM fixture DDR5", manufacturer: "Test fixture", priceEur: 129, description: "Test only", generation: "DDR5", capacityGb: 32, kitModules: 2, speedMtPerS: 6000, estimatedPowerW: 10 },
  { id: "test-ram-ddr4", category: "memory", name: "RAM fixture DDR4", manufacturer: "Test fixture", priceEur: 99, description: "Test only", generation: "DDR4", capacityGb: 32, kitModules: 2, speedMtPerS: 3600, estimatedPowerW: 10 },
  { id: "test-case-atx", category: "case", name: "Case fixture ATX", manufacturer: "Test fixture", priceEur: 89, description: "Test only", supportedFormFactors: ["ATX", "microATX"], maxGpuLengthMm: 360, estimatedPowerW: 25 },
  { id: "test-case-small", category: "case", name: "Case fixture small", manufacturer: "Test fixture", priceEur: 70, description: "Test only", supportedFormFactors: ["microATX", "Mini-ITX"], maxGpuLengthMm: 270, estimatedPowerW: 25 },
  { id: "test-psu-650", category: "psu", name: "PSU fixture 650W", manufacturer: "Test fixture", priceEur: 149, description: "Test only", capacityW: 650, efficiencyLabel: "80+ Gold" },
  { id: "test-gpu-300", category: "gpu", name: "GPU fixture 300mm", manufacturer: "Test fixture", priceEur: 450, description: "Test only", lengthMm: 300, estimatedPowerW: 360 },
  { id: "test-storage", category: "storage", name: "Storage fixture", manufacturer: "Test fixture", priceEur: 100, description: "Test only", capacityTb: 2, interface: "NVMe PCIe 4.0", estimatedPowerW: 7 },
  { id: "test-cooler", category: "cooler", name: "Cooler fixture", manufacturer: "Test fixture", priceEur: 120, description: "Test only", supportedSockets: ["AM5", "LGA1851"], estimatedPowerW: 12 },
];

describe("checkBuildCompatibility", () => {
  it("marks an empty build incomplete and reports the required categories", () => {
    const result = checkBuildCompatibility({}, []);

    expect(result.status).toBe("incomplete");
    expect(result.missingCategories).toEqual(["cpu", "motherboard", "memory", "case", "psu"]);
    expect(result.estimatedDrawW).toBeNull();
    expect(result.recommendedPsuW).toBeNull();
  });

  it("checks compatible part attributes and calculates PSU headroom", () => {
    const result = checkBuildCompatibility({
      cpu: "test-cpu-am5", motherboard: "test-board-am5", memory: "test-ram-ddr5",
      case: "test-case-atx", psu: "test-psu-650",
    }, testParts);

    expect(result.status).toBe("compatible");
    expect(result.errors).toHaveLength(0);
    expect(result.totalPriceEur).toBe(965);
    expect(result.estimatedDrawW).toBe(205);
    expect(result.recommendedPsuW).toBe(250);
  });

  it("reports socket, memory, case-size, and GPU-clearance mismatches", () => {
    const result = checkBuildCompatibility({
      cpu: "test-cpu-ddr4", motherboard: "test-board-am5", memory: "test-ram-ddr4",
      case: "test-case-small", psu: "test-psu-650", gpu: "test-gpu-300",
    }, testParts);

    expect(result.status).toBe("incompatible");
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "socket-mismatch", "memory-generation-mismatch", "cpu-memory-generation-mismatch",
      "case-form-factor-mismatch", "gpu-too-long",
    ]));
  });

  it("warns when a PSU covers draw but misses the recommended headroom", () => {
    const selection: PcBuildSelection = {
      cpu: "test-cpu-lga", motherboard: "test-board-lga", memory: "test-ram-ddr5",
      case: "test-case-atx", psu: "test-psu-650", gpu: "test-gpu-300",
      storage: "test-storage", cooler: "test-cooler",
    };
    const result = checkBuildCompatibility(selection, testParts);

    expect(result.status).toBe("review");
    expect(result.estimatedDrawW).toBe(644);
    expect(result.recommendedPsuW).toBe(800);
    expect(result.warnings.map((issue) => issue.code)).toContain("psu-headroom-below-guideline");
    expect(pcBuilderCategories).toHaveLength(8);
  });
});
