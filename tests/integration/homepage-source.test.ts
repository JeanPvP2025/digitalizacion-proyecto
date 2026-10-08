import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", props),
}));

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import HomePage, { dynamic } from "@/app/(store)/page";
import { demoProducts } from "@/lib/catalog";

const connectedProduct = {
  id: "db-only-314", slug: "routeur-connecte-314", sku: "NOD-DB-314",
  name: "Router ficticio conectado 314", brand: "Marca ficticia", summary: "Ficha desde DB",
  description: "Fixture de frontera conectado", image_url: "https://other-host.test/product.png",
  image_alt: "Router ficticio", badge: null, is_featured: true, is_published: true,
};

function connectedRows(products = [connectedProduct]) {
  return {
    products,
    categories: [{ id: "category-db", slug: "redes", name: "Redes", description: "Redes de prueba", sort_order: 1, is_active: true }],
    product_categories: products.map((product) => ({ product_id: product.id, category_id: "category-db" })),
    product_variants: products.map((product) => ({ id: `variant-${product.id}`, product_id: product.id, sku: product.sku, title: "Demo", current_price: 314, compare_at_price: null, currency: "EUR", is_active: true })),
    product_specifications: [],
  };
}

function client(rows: Record<string, unknown>, error = false) {
  return {
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query), in: vi.fn(() => query),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({
          data: rows[table] ?? [], error: error && table === "products" ? { message: "read failed" } : null,
        }).then(resolve),
      };
      return query;
    }),
  };
}

async function renderHome() { return renderToStaticMarkup(await HomePage()); }
function expectNoFixtures(markup: string) {
  for (const product of demoProducts) {
    expect(markup).not.toContain(product.name);
    expect(markup).not.toContain(`/producto/${product.slug}`);
  }
}

beforeEach(() => {
  mocks.createClient.mockReset();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56201");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fictitious-test-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("homepage active-source boundary", () => {
  it("reads connected data for the hero and cards even when DEMO_MODE is enabled", async () => {
    const otherProduct = { ...connectedProduct, id: "db-only-315", slug: "routeur-connecte-315", name: "Router ficticio conectado 315" };
    const supabase = client(connectedRows([connectedProduct, otherProduct]));
    mocks.createClient.mockReturnValue(supabase);
    const markup = await renderHome();
    expect(markup).toContain(connectedProduct.name);
    expect(markup).toContain(otherProduct.name);
    expect(markup).toContain('href="/producto/routeur-connecte-314"');
    expect(markup).toContain('src="https://other-host.test/product.png"');
    expect(markup).toContain('href="/categorias/redes"');
    expect(markup).toContain("Catálogo conectado");
    expect(markup).toContain("Disponibilidad por confirmar");
    expect(markup).not.toContain("Stock demo");
    expect(markup).not.toContain("Añadir al carrito");
    expectNoFixtures(markup);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(supabase.from.mock.calls.filter(([table]) => table === "products")).toHaveLength(1);
    expect(dynamic).toBe("force-dynamic");
  });

  it("keeps a connected empty catalogue empty, with no fixture fallback or empty category links", async () => {
    mocks.createClient.mockReturnValue(client(connectedRows([])));
    const markup = await renderHome();
    expect(markup).toContain("Aún no hay productos publicados");
    expect(markup).toContain("No hay categorías con productos");
    expect(markup).not.toContain('href="/categorias/redes"');
    expect(markup).not.toContain('class="product-card"');
    expectNoFixtures(markup);
  });

  it("renders connected read errors with a fresh-request recovery action and zero fixture products", async () => {
    mocks.createClient.mockReturnValue(client({}, true));
    const markup = await renderHome();
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('action="/"');
    expect(markup).toContain('method="get"');
    expect(markup).toContain("Volver a intentar cargar la portada");
    expect(markup).not.toContain('class="product-card"');
    expectNoFixtures(markup);
  });

  it.each(["production", "development"])("does not use fixtures without an active source in %s", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const markup = await renderHome();
    expect(markup).toContain("El catálogo no está disponible");
    expectNoFixtures(markup);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("uses fixtures only for explicit local demo, deriving all destinations from those fixtures", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const markup = await renderHome();
    expect(markup).toContain("Catálogo local de demostración");
    expect(markup).toContain("Tu espacio de trabajo, pieza a pieza");
    expect(markup).toContain("Más ideas por descubrir");
    expect(markup).not.toContain("Novedades y otras ideas");
    const destinations = [...markup.matchAll(/href="(\/producto\/[^"?#]+)"/g)].map((match) => match[1]);
    expect(new Set(destinations).size).toBe(demoProducts.length);
    expect(destinations.every((href) => demoProducts.some(({ slug }) => href === `/producto/${slug}`))).toBe(true);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
