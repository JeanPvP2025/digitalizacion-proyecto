import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PcBuilder } from "@/components/storefront/pc-builder";

describe("PC Builder empty catalogue UI", () => {
  it("explains the local-demo restriction and leaves selection and cart controls disabled", () => {
    const markup = renderToStaticMarkup(createElement(PcBuilder, {
      catalog: { source: "demo", components: [], omittedVariants: 0 },
    }));

    expect(markup).toContain("El catálogo demo no contiene piezas PC con variant IDs.");
    expect(markup).toContain("No se ofrecen fichas ficticias como compatibles o comprables");
    expect(markup).toContain("El puente al carrito espera el contrato de checkout por variant ID.");
    expect(markup).toContain("El catálogo no incluye todavía reglas para BIOS/QVL");
    expect(markup.match(/<select[^>]*disabled=""/g)).toHaveLength(8);
    expect(markup).toContain("Añadir componentes</button>");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="builder-cart-restriction"/);
    expect(markup).toContain("Guardar selección</button>");
  });

  it("shows an error state with a retry action when the catalogue read fails", () => {
    const markup = renderToStaticMarkup(createElement(PcBuilder, {
      catalog: { source: "error", components: [], omittedVariants: 0, message: "No se pudo leer el catálogo." },
    }));

    expect(markup).toContain("No se pudo leer el catálogo.");
    expect(markup).toContain("Volver a intentar");
  });
});
