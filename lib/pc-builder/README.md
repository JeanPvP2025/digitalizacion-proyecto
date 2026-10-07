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

The implemented checks cover CPU/motherboard socket, CPU and board memory generation, memory capacity, motherboard/case form factor, GPU/case length, cooler/CPU socket, missing dedicated graphics for a CPU without integrated graphics, and estimated draw against PSU capacity/headroom. The current attribute contract does not validate BIOS revisions/QVL, GPU/PSU power connectors, radiator/cooler clearance, or all storage-to-board protocols. The UI states this limit and the cart remains disabled pending checkout integration; catalog ownership must add those attributes and matching rules before describing a build as fully verified.

The current demo seed contains no individual PC parts with this structured contract. Its SSD uses generic `capacity` and `interface` labels but has no `pc_builder` metadata, while the old fictional examples have no product/variant rows. Those examples remain exported only for the legacy local-demo checkout and its existing tests; the interactive configurator never reads them. Therefore the current catalog correctly yields an empty PC Builder and cannot produce a valid purchasable build. Stock is protected and is not read here; checkout must recheck current variant availability and price. Guarded builds are stored in this browser under `nodria.pc-builds.v2` as variant IDs. The cart action remains disabled until checkout accepts and validates those selected variant IDs.
