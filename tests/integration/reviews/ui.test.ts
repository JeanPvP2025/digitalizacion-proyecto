import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductReviewList } from "@/components/storefront/reviews/product-review-list";

const mocks = vi.hoisted(() => ({
  getCatalogData: vi.fn(),
  getServerDataMode: vi.fn(),
  getServerAuthState: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  listPublishedProductReviews: vi.fn(),
  listReviewableOrderItems: vi.fn(),
}));

vi.mock("@/lib/catalog-repository", () => ({ getCatalogData: mocks.getCatalogData }));
vi.mock("@/lib/server/data-mode", () => ({ getServerDataMode: mocks.getServerDataMode }));
vi.mock("@/lib/supabase/auth", () => ({ getServerAuthState: mocks.getServerAuthState }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/reviews/data", () => ({
  listPublishedProductReviews: mocks.listPublishedProductReviews,
  listReviewableOrderItems: mocks.listReviewableOrderItems,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import ProductReviewsPage from "@/app/(store)/producto/[slug]/opiniones/page";
import ProductReviewsLoading from "@/app/(store)/producto/[slug]/opiniones/loading";

const product = {
  id: "product-1",
  slug: "laptop-nodria",
  name: "Laptop NODRIA",
  brand: "NODRIA",
  category: "Informática",
  sku: "NOD-LAP-1",
  summary: "Portátil de prueba",
  image: "",
  imageAlt: "",
  badge: "",
  featured: false,
  price: 999,
  rating: 0,
  reviewCount: 0,
  stock: 0,
  specifications: [],
};

const publishedReview = {
  id: "review-1",
  rating: 4,
  title: "Buena compra",
  body: "Llegó en el plazo previsto y cumple con lo que necesitaba.",
  createdAt: "2026-10-07T09:00:00.000Z",
};

async function renderOpinionsPage() {
  const page = await ProductReviewsPage({ params: Promise.resolve({ slug: product.slug }) });
  return renderToStaticMarkup(page);
}

function configureConnectedCatalog() {
  mocks.getCatalogData.mockResolvedValue({ source: "supabase", products: [product], categories: [] });
  mocks.getServerDataMode.mockReturnValue("supabase");
  mocks.createSupabaseServerClient.mockResolvedValue({});
  mocks.listPublishedProductReviews.mockResolvedValue({ ok: true, data: { reviews: [], total: 0 } });
  mocks.getServerAuthState.mockResolvedValue({ kind: "signed-out" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCatalogData.mockResolvedValue({ source: "demo", products: [product], categories: [] });
  mocks.getServerDataMode.mockReturnValue("local-demo");
});

describe("product reviews UI", () => {
  it("renders a truthful empty state instead of placeholder ratings", () => {
    const markup = renderToStaticMarkup(createElement(ProductReviewList, { reviews: [], state: "empty" }));
    expect(markup).toContain("Todavía no hay opiniones publicadas");
    expect(markup).not.toContain("5/5");
  });

  it("renders rating and verified-purchase context from persisted review data", () => {
    const markup = renderToStaticMarkup(createElement(ProductReviewList, {
      state: "ready",
      reviews: [{
        id: "review-1",
        rating: 3,
        title: "Correcto",
        body: "Cumple lo descrito y llegó en el plazo que indicaba la tienda.",
        createdAt: "2026-10-07T09:00:00.000Z",
      }],
    }));
    expect(markup).toContain("3/5");
    expect(markup).toContain("Compra verificada");
    expect(markup).toContain("Correcto");
  });

  it("announces loading while opinions and purchase eligibility are checked", () => {
    const markup = renderToStaticMarkup(createElement(ProductReviewsLoading));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Cargando opiniones");
  });

  it("keeps the demo read-only and states that it does not persist opinions", async () => {
    const markup = await renderOpinionsPage();
    expect(markup).toContain("La demo no guarda opiniones");
    expect(markup).not.toContain("Enviar opinión");
    expect(mocks.listPublishedProductReviews).not.toHaveBeenCalled();
  });

  it("shows published reviews and the form only for a signed-in eligible buyer", async () => {
    configureConnectedCatalog();
    mocks.getServerAuthState.mockResolvedValue({ kind: "signed-in", user: { id: "customer-1" }, supabase: {} });
    mocks.listPublishedProductReviews.mockResolvedValue({ ok: true, data: { reviews: [publishedReview], total: 1 } });
    mocks.listReviewableOrderItems.mockResolvedValue({ ok: true, data: [{
      id: "order-item-1",
      orderNumber: "NOD-2026-0101",
      productName: product.name,
      variantTitle: "16 GB / 512 GB",
    }] });

    const markup = await renderOpinionsPage();
    expect(markup).toContain("1 opinión publicada");
    expect(markup).toContain("Buena compra");
    expect(markup).toContain("Compra entregada");
    expect(markup).toContain("NOD-2026-0101");
  });

  it("does not show the form when the signed-in buyer has no eligible delivered line", async () => {
    configureConnectedCatalog();
    mocks.getServerAuthState.mockResolvedValue({ kind: "signed-in", user: { id: "customer-1" }, supabase: {} });
    mocks.listReviewableOrderItems.mockResolvedValue({ ok: true, data: [] });

    const markup = await renderOpinionsPage();
    expect(markup).toContain("No hay compras entregadas de este producto disponibles");
    expect(markup).not.toContain('name="orderItemId"');
  });

  it("keeps a public empty state when no published reviews exist", async () => {
    configureConnectedCatalog();
    const markup = await renderOpinionsPage();
    expect(markup).toContain("Todavía no hay opiniones publicadas");
    expect(markup).toContain("Iniciar sesión");
    expect(markup).toContain("0 opiniones publicadas");
  });

  it("exposes a recoverable error when published reviews cannot be loaded", async () => {
    configureConnectedCatalog();
    mocks.listPublishedProductReviews.mockResolvedValue({ ok: false });
    const markup = await renderOpinionsPage();
    expect(markup).toContain("No se pudieron cargar las opiniones");
    expect(markup).toContain('role="alert"');
  });

  it("exposes an eligibility error instead of offering an unverified submission", async () => {
    configureConnectedCatalog();
    mocks.getServerAuthState.mockResolvedValue({ kind: "signed-in", user: { id: "customer-1" }, supabase: {} });
    mocks.listReviewableOrderItems.mockResolvedValue({ ok: false });

    const markup = await renderOpinionsPage();
    expect(markup).toContain("No se pudo comprobar la compra elegible");
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('name="orderItemId"');
  });
});
