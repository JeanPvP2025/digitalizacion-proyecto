import { describe, expect, it } from "vitest";
import { canModerateReviews } from "@/lib/reviews/authorization";
import { reviewModerationSchema, reviewSubmissionSchema } from "@/lib/reviews/contracts";

const validSubmission = {
  productId: "nodria-laptop",
  orderItemId: "10000000-0000-4000-8000-000000000001",
  rating: 4,
  title: "Buena compra",
  body: "Llegó en el plazo previsto y cumple con lo que necesitaba.",
};

describe("review contracts", () => {
  it("accepts a verified-purchase review payload", () => {
    expect(reviewSubmissionSchema.safeParse(validSubmission).success).toBe(true);
  });

  it("rejects caller-selected identity and invalid ratings", () => {
    expect(reviewSubmissionSchema.safeParse({ ...validSubmission, authorId: "someone-else" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...validSubmission, rating: 6 }).success).toBe(false);
  });

  it("allows only final moderation decisions", () => {
    expect(reviewModerationSchema.safeParse({ status: "published" }).success).toBe(true);
    expect(reviewModerationSchema.safeParse({ status: "pending" }).success).toBe(false);
  });
});

describe("review moderation authorization", () => {
  it("accepts the explicitly authorized super admin role only", () => {
    expect(canModerateReviews(["super_admin"])).toBe(true);
    expect(canModerateReviews(["catalog_manager"])).toBe(false);
    expect(canModerateReviews(["support_agent"])).toBe(false);
    expect(canModerateReviews([])).toBe(false);
  });
});
