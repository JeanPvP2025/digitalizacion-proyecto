import type {
  CaseFixture,
  CoolerFixture,
  CpuFixture,
  GpuFixture,
  MemoryFixture,
  MotherboardFixture,
  MotherboardFormFactor,
  PcBuilderCatalogComponent,
  PcBuilderCategory,
  PsuFixture,
  StorageFixture,
} from "./types";

export type PcBuilderProductRow = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  summary: string;
  is_published: boolean;
};

export type PcBuilderCategoryRow = {
  id: string;
  slug: string;
  is_active: boolean;
};

export type PcBuilderProductCategoryRow = {
  product_id: string;
  category_id: string;
};

export type PcBuilderVariantRow = {
  id: string;
  product_id: string;
  sku: string;
  title: string;
  attributes: unknown;
  current_price: number | string;
  currency: string;
  is_active: boolean;
};

export type PcBuilderCatalogRows = {
  products: PcBuilderProductRow[];
  categories: PcBuilderCategoryRow[];
  productCategories: PcBuilderProductCategoryRow[];
  variants: PcBuilderVariantRow[];
};

const categoryOrder: PcBuilderCategory[] = [
  "cpu", "motherboard", "memory", "case", "psu", "gpu", "storage", "cooler",
];
const memoryGenerations = ["DDR4", "DDR5"] as const;
const formFactors: readonly MotherboardFormFactor[] = ["E-ATX", "ATX", "microATX", "Mini-ITX"];
const efficiencyLabels = ["80+ Bronze", "80+ Gold", "80+ Platinum"] as const;
const storageInterfaces = ["NVMe PCIe 4.0", "NVMe PCIe 5.0"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

function isMemoryGeneration(value: unknown): value is (typeof memoryGenerations)[number] {
  return memoryGenerations.includes(value as (typeof memoryGenerations)[number]);
}

function isFormFactor(value: unknown): value is MotherboardFormFactor {
  return formFactors.includes(value as MotherboardFormFactor);
}

function isCategory(value: unknown): value is PcBuilderCategory {
  return typeof value === "string" && categoryOrder.includes(value as PcBuilderCategory);
}

function parseVariantComponent(
  variant: PcBuilderVariantRow,
  product: PcBuilderProductRow,
): PcBuilderCatalogComponent | null {
  if (!isUuid(variant.id) || !nonEmptyString(variant.product_id) || !nonEmptyString(variant.sku) ||
      !nonEmptyString(variant.title) || !nonEmptyString(product.slug) || !nonEmptyString(product.name) ||
      !nonEmptyString(product.brand) || !Number.isFinite(Number(variant.current_price)) || Number(variant.current_price) < 0) {
    return null;
  }

  const root = isRecord(variant.attributes) ? variant.attributes : null;
  const builder = root && isRecord(root.pc_builder) ? root.pc_builder : null;
  if (!builder || !isCategory(builder.category)) return null;

  const base = {
    id: variant.id,
    variantId: variant.id,
    productId: product.id,
    productSlug: product.slug,
    sku: variant.sku,
    variantTitle: variant.title,
    name: product.name,
    manufacturer: product.brand,
    priceEur: Number(variant.current_price),
    description: product.summary,
  };

  switch (builder.category) {
    case "cpu": {
      if (!nonEmptyString(builder.socket) || !stringArray(builder.memory_generations) ||
          !builder.memory_generations.every(isMemoryGeneration) || !positiveNumber(builder.estimated_power_w) ||
          typeof builder.integrated_graphics !== "boolean") return null;
      return { ...base, category: "cpu", socket: builder.socket, memoryGenerations: builder.memory_generations,
        estimatedPowerW: builder.estimated_power_w, integratedGraphics: builder.integrated_graphics } satisfies CpuFixture;
    }
    case "motherboard": {
      if (!nonEmptyString(builder.socket) || !isFormFactor(builder.form_factor) ||
          !isMemoryGeneration(builder.memory_generation) || !positiveNumber(builder.max_memory_gb) ||
          !positiveNumber(builder.estimated_power_w)) return null;
      return { ...base, category: "motherboard", socket: builder.socket, formFactor: builder.form_factor,
        memoryGeneration: builder.memory_generation, maxMemoryGb: builder.max_memory_gb,
        estimatedPowerW: builder.estimated_power_w } satisfies MotherboardFixture;
    }
    case "memory": {
      if (!isMemoryGeneration(builder.generation) || !positiveNumber(builder.capacity_gb) ||
          !positiveNumber(builder.kit_modules) || !positiveNumber(builder.speed_mt_per_s) ||
          !positiveNumber(builder.estimated_power_w)) return null;
      return { ...base, category: "memory", generation: builder.generation, capacityGb: builder.capacity_gb,
        kitModules: builder.kit_modules, speedMtPerS: builder.speed_mt_per_s,
        estimatedPowerW: builder.estimated_power_w } satisfies MemoryFixture;
    }
    case "case": {
      if (!stringArray(builder.supported_form_factors) || !builder.supported_form_factors.every(isFormFactor) ||
          !positiveNumber(builder.max_gpu_length_mm) || !positiveNumber(builder.estimated_power_w)) return null;
      return { ...base, category: "case", supportedFormFactors: builder.supported_form_factors,
        maxGpuLengthMm: builder.max_gpu_length_mm, estimatedPowerW: builder.estimated_power_w } satisfies CaseFixture;
    }
    case "gpu": {
      if (!positiveNumber(builder.length_mm) || !positiveNumber(builder.estimated_power_w)) return null;
      return { ...base, category: "gpu", lengthMm: builder.length_mm,
        estimatedPowerW: builder.estimated_power_w } satisfies GpuFixture;
    }
    case "psu": {
      if (!positiveNumber(builder.capacity_w) || !efficiencyLabels.includes(builder.efficiency_label as (typeof efficiencyLabels)[number])) return null;
      return { ...base, category: "psu", capacityW: builder.capacity_w,
        efficiencyLabel: builder.efficiency_label as (typeof efficiencyLabels)[number] } satisfies PsuFixture;
    }
    case "storage": {
      if (!positiveNumber(builder.capacity_tb) || !storageInterfaces.includes(builder.interface as (typeof storageInterfaces)[number]) ||
          !positiveNumber(builder.estimated_power_w)) return null;
      return { ...base, category: "storage", capacityTb: builder.capacity_tb,
        interface: builder.interface as (typeof storageInterfaces)[number],
        estimatedPowerW: builder.estimated_power_w } satisfies StorageFixture;
    }
    case "cooler": {
      if (!stringArray(builder.supported_sockets) || !positiveNumber(builder.estimated_power_w)) return null;
      return { ...base, category: "cooler", supportedSockets: builder.supported_sockets,
        estimatedPowerW: builder.estimated_power_w } satisfies CoolerFixture;
    }
  }
}

/**
 * Only published products in the active Componentes or Almacenamiento
 * catalogue categories and with a complete `attributes.pc_builder` contract
 * become selectable. Display specifications are deliberately not parsed into
 * compatibility rules because their values are not a stable data contract.
 */
export function mapPcBuilderRows(rows: PcBuilderCatalogRows) {
  const activeCategoryIds = new Set(rows.categories
    .filter((category) => category.is_active && ["componentes", "almacenamiento"].includes(category.slug))
    .map((category) => category.id));
  const productsWithEligibleCategory = new Set(rows.productCategories
    .filter((link) => activeCategoryIds.has(link.category_id))
    .map((link) => link.product_id));
  const products = new Map(rows.products
    .filter((product) => product.is_published && productsWithEligibleCategory.has(product.id))
    .map((product) => [product.id, product]));

  const components: PcBuilderCatalogComponent[] = [];
  let omittedVariants = 0;
  for (const variant of rows.variants) {
    if (!variant.is_active || !products.has(variant.product_id)) continue;
    if (variant.currency !== "EUR") {
      omittedVariants += 1;
      continue;
    }
    const component = parseVariantComponent(variant, products.get(variant.product_id)!);
    if (!component) {
      omittedVariants += 1;
      continue;
    }
    components.push(component);
  }

  components.sort((left, right) => categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category) ||
    left.name.localeCompare(right.name, "es"));
  return { components, omittedVariants };
}
