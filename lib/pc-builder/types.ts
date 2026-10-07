export type PcBuilderCategory =
  | "cpu"
  | "motherboard"
  | "memory"
  | "case"
  | "gpu"
  | "psu"
  | "storage"
  | "cooler";

export type MemoryGeneration = "DDR4" | "DDR5";

export type MotherboardFormFactor = "E-ATX" | "ATX" | "microATX" | "Mini-ITX";

type PcComponentBase<Category extends PcBuilderCategory> = {
  id: string;
  category: Category;
  name: string;
  manufacturer: string;
  priceEur: number;
  description: string;
};

export type CpuFixture = PcComponentBase<"cpu"> & {
  socket: string;
  memoryGenerations: readonly MemoryGeneration[];
  estimatedPowerW: number;
  integratedGraphics: boolean;
};

export type MotherboardFixture = PcComponentBase<"motherboard"> & {
  socket: string;
  formFactor: MotherboardFormFactor;
  memoryGeneration: MemoryGeneration;
  maxMemoryGb: number;
};

export type MemoryFixture = PcComponentBase<"memory"> & {
  generation: MemoryGeneration;
  capacityGb: number;
  kitModules: number;
  speedMtPerS: number;
  estimatedPowerW: number;
};

export type CaseFixture = PcComponentBase<"case"> & {
  supportedFormFactors: readonly MotherboardFormFactor[];
  maxGpuLengthMm: number;
};

export type GpuFixture = PcComponentBase<"gpu"> & {
  lengthMm: number;
  estimatedPowerW: number;
};

export type PsuFixture = PcComponentBase<"psu"> & {
  capacityW: number;
  efficiencyLabel: "80+ Bronze" | "80+ Gold" | "80+ Platinum";
};

export type StorageFixture = PcComponentBase<"storage"> & {
  capacityTb: number;
  interface: "NVMe PCIe 4.0" | "NVMe PCIe 5.0";
  estimatedPowerW: number;
};

export type CoolerFixture = PcComponentBase<"cooler"> & {
  supportedSockets: readonly string[];
  estimatedPowerW: number;
};

export type PcBuilderComponent =
  | CpuFixture
  | MotherboardFixture
  | MemoryFixture
  | CaseFixture
  | GpuFixture
  | PsuFixture
  | StorageFixture
  | CoolerFixture;

/** Selected fixture IDs, grouped by their component category. */
export type PcBuildSelection = Partial<Record<PcBuilderCategory, string | null>>;

export type CompatibilitySeverity = "error" | "warning";

export type CompatibilityIssue = {
  code: string;
  severity: CompatibilitySeverity;
  message: string;
};

export type PcBuildStatus = "compatible" | "review" | "incomplete" | "incompatible";

export type PcBuildCompatibility = {
  status: PcBuildStatus;
  selectedComponents: PcBuilderComponent[];
  missingCategories: PcBuilderCategory[];
  totalPriceEur: number;
  estimatedDrawW: number | null;
  recommendedPsuW: number | null;
  issues: CompatibilityIssue[];
  errors: CompatibilityIssue[];
  warnings: CompatibilityIssue[];
  estimateNote: string;
};
