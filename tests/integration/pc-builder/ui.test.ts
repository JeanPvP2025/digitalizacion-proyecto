import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PcBuilder } from "@/components/storefront/pc-builder";

describe("PC Builder empty catalogue UI", () => {
  it("explains that an empty catalogue has no component cards to review", () => {
    const markup = renderToStaticMarkup(createElement(PcBuilder, {
      catalog: { source: "demo", components: [], omittedVariants: 0 },
    }));

    expect(markup).toContain("Modelos y precios del catálogo NODRIA");
    expect(markup).toContain("El pago se aprobará automáticamente en esta demostración");
    expect(markup).toContain("No incluye BIOS/QVL, conectores de energía ni todos los espacios físicos.");
    expect(markup).toContain(">0 referencias</span>");
    expect(markup).toContain("Esta pieza no está disponible");
    expect(markup.match(/aria-label="[1-8]\. /g)).toHaveLength(8);
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
