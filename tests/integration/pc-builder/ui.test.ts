import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PcBuilder } from "@/components/storefront/pc-builder";

describe("PC Builder empty catalogue UI", () => {
  it("explains the local-demo restriction and keeps incomplete selections out of the cart", () => {
    const markup = renderToStaticMarkup(createElement(PcBuilder, {
      catalog: { source: "demo", components: [], omittedVariants: 0 },
    }));

    expect(markup).toContain("El catálogo demo no contiene piezas PC con variant IDs.");
    expect(markup).toContain("No se ofrecen fichas ficticias como compatibles o comprables");
    expect(markup).toContain("Añadir al carrito se habilita con un montaje completo y compatible del catálogo conectado.");
    expect(markup).toContain("No incluye todavía BIOS/QVL, conectores de energía ni todos los espacios físicos.");
    expect(markup).toContain(">0 variantes</span>");
    expect(markup).toContain("Esta pieza no está disponible");
    expect(markup.match(/aria-label="[1-8]\. /g)).toHaveLength(8);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="builder-cart-restriction"/);
    expect(markup).toContain("Guardar montaje</button>");
  });

  it("shows an error state with a retry action when the catalogue read fails", () => {
    const markup = renderToStaticMarkup(createElement(PcBuilder, {
      catalog: { source: "error", components: [], omittedVariants: 0, message: "No se pudo leer el catálogo." },
    }));

    expect(markup).toContain("No se pudo leer el catálogo.");
    expect(markup).toContain("Volver a intentar");
  });
});
