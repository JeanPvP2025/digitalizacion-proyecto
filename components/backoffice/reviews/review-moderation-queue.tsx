"use client";

import { useState } from "react";
import type { PendingProductReview } from "@/lib/reviews/contracts";

export function ReviewModerationQueue({ initialReviews }: { initialReviews: PendingProductReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function moderate(reviewId: string, status: "published" | "rejected") {
    setBusyId(reviewId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/reviews/" + encodeURIComponent(reviewId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "No se pudo guardar la decisión.");
        return;
      }
      setReviews((current) => current.filter((review) => review.id !== reviewId));
      setMessage(status === "published" ? "Opinión publicada." : "Opinión rechazada.");
    } catch {
      setError("No se pudo guardar la decisión. Comprueba la conexión.");
    } finally {
      setBusyId("");
    }
  }

  if (reviews.length === 0) {
    return <p className="review-moderation-empty" role="status">No hay opiniones pendientes de moderación.</p>;
  }

  return (
    <section className="review-moderation-queue" aria-label="Opiniones pendientes">
      {message && <p role="status" className="review-moderation-message">{message}</p>}
      {error && <p role="alert" className="review-moderation-error">{error}</p>}
      {reviews.map((review) => (
        <article className="review-moderation-card" key={review.id}>
          <p className="eyebrow">{review.productName}</p>
          <div className="review-moderation-rating">{review.rating}/5 · compra verificada</div>
          <h2>{review.title}</h2>
          <p>{review.body}</p>
          <time dateTime={review.createdAt}>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))}</time>
          <div className="review-moderation-actions">
            <button className="button button--dark" type="button" disabled={Boolean(busyId)} onClick={() => void moderate(review.id, "published")}>
              {busyId === review.id ? "Guardando…" : "Publicar"}
            </button>
            <button className="button button--outline" type="button" disabled={Boolean(busyId)} onClick={() => void moderate(review.id, "rejected")}>
              Rechazar
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
