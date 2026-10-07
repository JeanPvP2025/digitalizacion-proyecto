"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ReviewableOrderItem } from "@/lib/reviews/contracts";

export function ReviewSubmissionForm({
  productId,
  orderItems,
}: {
  productId: string;
  orderItems: ReviewableOrderItem[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccess("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const rawRating = Number(formData.get("rating"));
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          orderItemId: formData.get("orderItemId"),
          rating: rawRating,
          title: formData.get("title"),
          body: formData.get("body"),
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "No se pudo enviar la opinión.");
        return;
      }
      form.reset();
      setSuccess("Opinión enviada. Se publicará cuando termine la revisión de moderación.");
      router.refresh();
    } catch {
      setError("No se pudo enviar la opinión. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="review-submission-form" onSubmit={submit}>
      <label>
        Compra entregada
        <select name="orderItemId" required defaultValue="">
          <option value="" disabled>Selecciona el pedido y el artículo</option>
          {orderItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.orderNumber} · {item.productName} · {item.variantTitle}
            </option>
          ))}
        </select>
      </label>
      <label>
        Valoración
        <select name="rating" required defaultValue="">
          <option value="" disabled>Selecciona una valoración</option>
          {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} de 5</option>)}
        </select>
      </label>
      <label>
        Título
        <input name="title" required minLength={3} maxLength={120} />
      </label>
      <label>
        Tu opinión
        <textarea name="body" required minLength={20} maxLength={2000} rows={5} />
      </label>
      {error && <p role="alert" className="review-form-error">{error}</p>}
      {success && <p role="status" className="review-form-success">{success}</p>}
      <button className="button button--dark" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar opinión"}
      </button>
    </form>
  );
}
