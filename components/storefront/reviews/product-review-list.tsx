import { Star } from "lucide-react";
import type { PublishedProductReview } from "@/lib/reviews/contracts";

export function ProductReviewList({
  reviews,
  state,
}: {
  reviews: PublishedProductReview[];
  state: "ready" | "empty" | "demo" | "error";
}) {
  if (state === "error") {
    return <p className="reviews-state" role="alert">No se pudieron cargar las opiniones. Vuelve a intentarlo más tarde.</p>;
  }
  if (state === "demo") {
    return <p className="reviews-state" role="status">La demo no guarda opiniones ni muestra reseñas ficticias en esta ficha.</p>;
  }
  if (state === "empty" || reviews.length === 0) {
    return <p className="reviews-state" role="status">Todavía no hay opiniones publicadas para este producto.</p>;
  }

  return (
    <div className="product-reviews-list">
      {reviews.map((review) => (
        <article className="product-review-card" key={review.id}>
          <div className="product-review-rating" aria-label={review.rating + " de 5 estrellas"}>
            {Array.from({ length: review.rating }, (_, index) => <Star key={index} size={14} fill="currentColor" aria-hidden="true" />)}
            <span>{review.rating}/5</span>
          </div>
          <h3>{review.title}</h3>
          <p>{review.body}</p>
          <div className="product-review-meta">
            <span>Compra verificada</span>
            <time dateTime={review.createdAt}>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(review.createdAt))}</time>
          </div>
        </article>
      ))}
    </div>
  );
}
