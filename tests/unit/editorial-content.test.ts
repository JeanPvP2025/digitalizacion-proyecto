import { describe, expect, it } from "vitest";
import {
  editorialArticles,
  editorialPath,
  getEditorialArticle,
  getEditorialArticles,
  getRelatedEditorial,
  resolveEditorialCommerce,
} from "@/lib/content/editorial";

describe("curated editorial content", () => {
  it("has unique route identities and all related links resolve", () => {
    const paths = editorialArticles.map(editorialPath);
    expect(new Set(paths).size).toBe(paths.length);
    for (const article of editorialArticles) {
      for (const related of getRelatedEditorial(article)) {
        expect(getEditorialArticle(related.collection, related.slug)).toBeDefined();
      }
    }
  });

  it("keeps collection pages scoped to their route", () => {
    expect(getEditorialArticles("blog").every((article) => article.collection === "blog")).toBe(true);
    expect(getEditorialArticles("guias").every((article) => article.collection === "guias")).toBe(true);
    expect(getEditorialArticles("blog").length).toBeGreaterThan(0);
    expect(getEditorialArticles("guias").length).toBeGreaterThan(0);
  });

  it("does not offer stale catalog links when the active catalog failed", () => {
    const article = editorialArticles[0];
    const commerce = resolveEditorialCommerce(article, { source: "error", products: [], categories: [], message: "unavailable" });
    expect(commerce).toEqual({ products: [], categories: [], unavailable: true });
  });
});
