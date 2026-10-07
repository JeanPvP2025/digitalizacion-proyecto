import { describe, expect, it } from "vitest";
import { checkBuildCompatibility } from "../../lib/pc-builder";

describe("checkBuildCompatibility", () => {
  it("marks an empty build incomplete and reports the required categories", () => {
    const result = checkBuildCompatibility({});

    expect(result.status).toBe("incomplete");
    expect(result.missingCategories).toEqual([
      "cpu",
      "motherboard",
      "memory",
      "case",
      "psu",
    ]);
    expect(result.estimatedDrawW).toBeNull();
    expect(result.recommendedPsuW).toBeNull();
  });

  it("accepts compatible required parts and calculates the PSU estimate", () => {
    const result = checkBuildCompatibility({
      cpu: "cpu-vector-7-9700",
      motherboard: "mb-aurora-b850",
      memory: "ram-lumen-32-ddr5",
      case: "case-prism-atx",
      psu: "psu-lumen-650",
    });

    expect(result.status).toBe("compatible");
    expect(result.errors).toHaveLength(0);
    expect(result.totalPriceEur).toBe(965);
    expect(result.estimatedDrawW).toBe(205);
    expect(result.recommendedPsuW).toBe(250);
  });

  it("reports socket, memory, case-size, and GPU-clearance mismatches", () => {
    const result = checkBuildCompatibility({
      cpu: "cpu-pulse-5-7600",
      motherboard: "mb-aurora-b850",
      memory: "ram-lumen-32-ddr4",
      case: "case-arc-micro",
      psu: "psu-lumen-650",
      gpu: "gpu-forge-890",
    });

    expect(result.status).toBe("incompatible");
    expect(result.errors.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "socket-mismatch",
        "memory-generation-mismatch",
        "cpu-memory-generation-mismatch",
        "case-form-factor-mismatch",
        "gpu-too-long",
      ]),
    );
  });

  it("warns when a PSU covers estimated draw but misses the recommended headroom", () => {
    const result = checkBuildCompatibility({
      cpu: "cpu-coreforge-9-285",
      motherboard: "mb-atelier-z890",
      memory: "ram-lumen-32-ddr5",
      case: "case-prism-atx",
      psu: "psu-lumen-650",
      gpu: "gpu-forge-890",
      storage: "storage-arc-1tb-gen5",
      cooler: "cooler-boreal-240",
    });

    expect(result.status).toBe("review");
    expect(result.estimatedDrawW).toBe(647);
    expect(result.recommendedPsuW).toBe(800);
    expect(result.warnings.map((issue) => issue.code)).toContain(
      "psu-headroom-below-guideline",
    );
  });
});
