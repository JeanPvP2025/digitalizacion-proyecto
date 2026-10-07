import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductReviewList } from "@/components/storefront/reviews/product-review-list";

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
});
