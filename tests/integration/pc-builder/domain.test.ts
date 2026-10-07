import { describe, expect, it } from "vitest";
import { checkBuildCompatibility, pcBuilderCategories } from "@/lib/pc-builder/compatibility";
import { mapPcBuilderRows, type PcBuilderCatalogRows } from "@/lib/pc-builder/catalog-mapping";
import type { PcBuildSelection, PcBuilderCategory } from "@/lib/pc-builder/types";

const categoryId = "category-components";
const productId = (n: number) => `product-${n}`;
const variantId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const attributesByCategory: Record<PcBuilderCategory, Record<string, unknown>> = {
  cpu: { category: "cpu", socket: "AM5", memory_generations: ["DDR5"], estimated_power_w: 120, integrated_graphics: true },
  motherboard: { category: "motherboard", socket: "AM5", form_factor: "ATX", memory_generation: "DDR5", max_memory_gb: 192, estimated_power_w: 50 },
  memory: { category: "memory", generation: "DDR5", capacity_gb: 32, kit_modules: 2, speed_mt_per_s: 6000, estimated_power_w: 10 },
  case: { category: "case", supported_form_factors: ["ATX", "microATX"], max_gpu_length_mm: 340, estimated_power_w: 25 },
  gpu: { category: "gpu", length_mm: 304, estimated_power_w: 220 },
  psu: { category: "psu", capacity_w: 650, efficiency_label: "80+ Gold" },
  storage: { category: "storage", capacity_tb: 2, interface: "NVMe PCIe 4.0", estimated_power_w: 7 },
  cooler: { category: "cooler", supported_sockets: ["AM5"], estimated_power_w: 12 },
};

function catalogRows(categories: readonly PcBuilderCategory[] = pcBuilderCategories): PcBuilderCatalogRows {
  return {
    products: categories.map((_, index) => ({
      id: productId(index + 1), slug: `component-${index + 1}`, name: `Pieza ${index + 1}`,
      brand: "NODRIA", summary: "Ficha con atributos PC Builder de prueba.", is_published: true,
    })),
    categories: [{ id: categoryId, slug: "componentes", is_active: true }],
    productCategories: categories.map((_, index) => ({ product_id: productId(index + 1), category_id: categoryId })),
    variants: categories.map((category, index) => ({
      id: variantId(index + 1), product_id: productId(index + 1), sku: `NOD-PC-${index + 1}`,
      title: "Única", attributes: { pc_builder: attributesByCategory[category] },
      current_price: "100.00", currency: "EUR", is_active: true,
    })),
  };
}

function buildSelection() {
  return Object.fromEntries(pcBuilderCategories.map((category) => {
    const index = pcBuilderCategories.indexOf(category);
    return [category, variantId(index + 1)];
  })) as PcBuildSelection;
}

describe("PC Builder catalogue contract and compatibility", () => {
  it("maps only published, active EUR variants with complete structured attributes", () => {
    const rows = catalogRows();
    rows.products.push({ id: "hidden", slug: "hidden", name: "No publicada", brand: "NODRIA", summary: "", is_published: false });
    rows.productCategories.push({ product_id: "hidden", category_id: categoryId });
    rows.variants.push({ id: variantId(20), product_id: "hidden", sku: "NOD-HIDDEN", title: "Única", attributes: { pc_builder: attributesByCategory.cpu }, current_price: 1, currency: "EUR", is_active: true });
    rows.variants.push({ id: variantId(21), product_id: productId(1), sku: "NOD-USD", title: "USD", attributes: { pc_builder: attributesByCategory.cpu }, current_price: 1, currency: "USD", is_active: true });
    rows.variants.push({ id: variantId(22), product_id: productId(2), sku: "NOD-OLD", title: "Inactiva", attributes: { pc_builder: attributesByCategory.motherboard }, current_price: 1, currency: "EUR", is_active: false });

    const result = mapPcBuilderRows(rows);
    expect(result.components).toHaveLength(pcBuilderCategories.length);
    expect(result.components.map((component) => component.variantId)).toEqual(pcBuilderCategories.map((_, index) => variantId(index + 1)));
    expect(result.components[0]).toMatchObject({ id: variantId(1), variantId: variantId(1), productId: productId(1), category: "cpu", priceEur: 100 });
    expect(result.omittedVariants).toBe(1);
  });

  it("omits free-text and incomplete compatibility data instead of inferring values", () => {
    const rows = catalogRows(["storage"]);
    rows.variants[0].attributes = { capacity: "2 TB", interface: "NVMe PCIe 4.0 ×4" };
    const genericSpecs = mapPcBuilderRows(rows);
    expect(genericSpecs).toEqual({ components: [], omittedVariants: 1 });

    rows.variants[0].attributes = { pc_builder: { ...attributesByCategory.storage, estimated_power_w: undefined } };
    expect(mapPcBuilderRows(rows)).toEqual({ components: [], omittedVariants: 1 });
  });

  it("requires an eligible active product category before exposing a variant", () => {
    const rows = catalogRows(["cpu"]);
    rows.categories[0].slug = "ordenadores";
    expect(mapPcBuilderRows(rows)).toEqual({ components: [], omittedVariants: 0 });

    rows.categories[0].slug = "componentes";
    rows.categories[0].is_active = false;
    expect(mapPcBuilderRows(rows)).toEqual({ components: [], omittedVariants: 0 });
  });

  it("checks compatibility using selected variant attributes", () => {
    const components = mapPcBuilderRows(catalogRows()).components;
    const result = checkBuildCompatibility(buildSelection(), components);
    expect(result.status).toBe("compatible");
    expect(result.selectedComponents.map((component) => component.variantId)).toEqual(pcBuilderCategories.map((_, index) => variantId(index + 1)));
    expect(result.estimatedDrawW).toBe(444);
    expect(result.recommendedPsuW).toBe(550);
  });

  it("blocks incompatible and incomplete combinations", () => {
    const components = mapPcBuilderRows(catalogRows()).components.map((component) => component.category === "motherboard"
      ? { ...component, socket: "LGA1851" }
      : component);
    const selection = buildSelection();
    expect(checkBuildCompatibility(selection, components).status).toBe("incompatible");

    const incomplete = { ...selection, memory: null };
    const validComponents = mapPcBuilderRows(catalogRows()).components;
    expect(checkBuildCompatibility(incomplete, validComponents)).toMatchObject({ status: "incomplete", missingCategories: ["memory"] });
  });

  it("blocks a processor without integrated graphics when no GPU is selected", () => {
    const components = mapPcBuilderRows(catalogRows()).components.map((component) => component.category === "cpu"
      ? { ...component, integratedGraphics: false }
      : component);
    const selection = { ...buildSelection(), gpu: null };
    const result = checkBuildCompatibility(selection, components);
    expect(result.status).toBe("incompatible");
    expect(result.errors.map((issue) => issue.code)).toContain("graphics-may-be-required");
  });
});
