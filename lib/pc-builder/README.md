# PC Builder catalogue contract

The configurator reads only active EUR `product_variants` whose product is published and belongs to an active `Componentes` or `Almacenamiento` category. It does not infer compatibility from free-text `product_specifications` or display names.

Each sellable variant must have a complete `attributes.pc_builder` object. `category` is one of `cpu`, `motherboard`, `memory`, `case`, `gpu`, `psu`, `storage` or `cooler`; its category-specific values are:

| Category | Required attributes |
|---|---|
| `cpu` | `socket`, `memory_generations` (`DDR4`/`DDR5`), `estimated_power_w`, `integrated_graphics` |
| `motherboard` | `socket`, `form_factor` (`E-ATX`/`ATX`/`microATX`/`Mini-ITX`), `memory_generation`, `max_memory_gb`, `estimated_power_w` |
| `memory` | `generation`, `capacity_gb`, `kit_modules`, `speed_mt_per_s`, `estimated_power_w` |
| `case` | `supported_form_factors`, `max_gpu_length_mm`, `estimated_power_w` |
| `gpu` | `length_mm`, `estimated_power_w` |
| `psu` | `capacity_w`, `efficiency_label` (`80+ Bronze`/`80+ Gold`/`80+ Platinum`) |
| `storage` | `capacity_tb`, `interface` (`NVMe PCIe 4.0`/`NVMe PCIe 5.0`), `estimated_power_w` |
| `cooler` | `supported_sockets`, `estimated_power_w` |

Example:

```json
{
  "pc_builder": {
    "category": "cpu",
    "socket": "AM5",
    "memory_generations": ["DDR5"],
    "estimated_power_w": 120,
    "integrated_graphics": true
  }
}
```

An omitted or malformed required field excludes that variant; the UI reports the resulting unavailable category. The PSU estimate sums the declared CPU, motherboard, memory, case and optional-component power values, then applies the documented 20% headroom. The configurator never substitutes a fixture or estimates a missing socket, memory type, clearance, power value, product price, stock or `variantId`.

The implemented checks cover CPU/motherboard socket, CPU and board memory generation, memory capacity, motherboard/case form factor, GPU/case length, cooler/CPU socket, missing dedicated graphics for a CPU without integrated graphics, and estimated draw against PSU capacity/headroom. The current attribute contract does not validate BIOS revisions/QVL, GPU/PSU power connectors, radiator/cooler clearance, or all storage-to-board protocols. The UI states this limit: a build that passes is compatible only according to the listed rules, not fully certified. When a complete connected catalog build passes, the selected variant IDs can be added to the cart and checkout revalidates price and stock.

The checked-in base seed and explicit local-demo mode contain no individual purchasable PC parts with this structured contract. The additive catalog-depth migration adds 32 fictional parts (four per component category) with typed `pc_builder` attributes; this is available only after the migration is applied to the connected Supabase project. The 32 products are still demo data, not real stock or compatibility certification. The old component fixtures remain exported only for legacy unit tests; the interactive configurator never reads them. Stock is protected and is not read here; checkout must recheck current variant availability and price. Guarded builds are stored in this browser under `nodria.pc-builds.v2` as variant IDs.
