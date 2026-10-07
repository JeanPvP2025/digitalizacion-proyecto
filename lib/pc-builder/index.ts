import { checkBuildCompatibility as checkCatalogueCompatibility } from "./compatibility";
import { pcBuilderComponents } from "./fixtures";
import type { PcBuildSelection, PcBuilderComponent } from "./types";

/** Legacy fixture default retained for existing demo callers and tests. */
export function checkBuildCompatibility(selection: PcBuildSelection, components: readonly PcBuilderComponent[] = pcBuilderComponents) {
  return checkCatalogueCompatibility(selection, components);
}

export { optionalPcBuilderCategories, pcBuilderCategories, requiredPcBuilderCategories } from "./compatibility";
export { mapPcBuilderRows } from "./catalog-mapping";
export { pcBuilderComponents } from "./fixtures";
export type {
  CaseFixture,
  CompatibilityIssue,
  CompatibilitySeverity,
  CoolerFixture,
  CpuFixture,
  GpuFixture,
  MemoryFixture,
  MemoryGeneration,
  MotherboardFixture,
  MotherboardFormFactor,
  PcBuildCompatibility,
  PcBuildSelection,
  PcBuildStatus,
  PcBuilderCatalog,
  PcBuilderCatalogComponent,
  PcBuilderCategory,
  PcBuilderComponent,
  PsuFixture,
  StorageFixture,
} from "./types";
