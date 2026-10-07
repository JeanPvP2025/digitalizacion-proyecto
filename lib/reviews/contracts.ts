import { z } from "zod";

export const reviewSubmissionSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  orderItemId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(20).max(2000),
}).strict();

export const reviewModerationSchema = z.object({
  status: z.enum(["published", "rejected"]),
  note: z.string().trim().max(1000).optional(),
}).strict();

export const reviewIdSchema = z.uuid();

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
export type ReviewDecision = z.infer<typeof reviewModerationSchema>;

export type PublishedProductReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
};

export type ReviewableOrderItem = {
  id: string;
  orderNumber: string;
  productName: string;
  variantTitle: string;
};

export type PendingProductReview = PublishedProductReview & {
  productId: string;
  productName: string;
  status: "pending";
};
