"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, PencilLine } from "lucide-react";
import type { CatalogAdminProduct } from "@/lib/catalog/admin/contracts";
import styles from "./catalog.module.css";

type EditableFields = Pick<CatalogAdminProduct, "name" | "summary" | "description" | "image_url" | "image_alt" | "badge">;

export function CatalogProductEditor({ product }: { product: CatalogAdminProduct }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    setSaving(true);
    setStatus("");
    setError("");
    const submitted: EditableFields = {
      name: String(formData.get("name") ?? "").trim(),
      summary: String(formData.get("summary") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      image_alt: String(formData.get("image_alt") ?? "").trim(),
      badge: String(formData.get("badge") ?? "").trim() || null,
    };
    const editableKeys = ["name", "summary", "description", "image_url", "image_alt", "badge"] as const;
    const changes = Object.fromEntries(editableKeys
      .filter((key) => submitted[key] !== product[key])
      .map((key) => [key, submitted[key]])) as Partial<EditableFields>;
    if (Object.keys(changes).length === 0) {
      setStatus("No hay cambios que guardar.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/backoffice/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, changes }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error : "No se pudo guardar la ficha. Vuelve a intentarlo.";
        setError(message);
        return;
      }
      setStatus("Cambios guardados en el catálogo conectado.");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el catálogo. Comprueba la conexión y vuelve a intentarlo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={styles.productCard}>
      <div className={styles.productSummary}>
        <div className={styles.productImage}>
          {product.image_url ? <Image src={product.image_url} alt={product.image_alt || ""} width={88} height={88} unoptimized /> : <ImageOff size={21} aria-hidden="true" />}
        </div>
        <div className={styles.productIdentity}>
          <div className={styles.productMeta}><span>{product.sku}</span><span className={product.is_published ? styles.published : styles.draft}>{product.is_published ? "Publicado" : "Borrador"}</span></div>
          <h3>{product.name}</h3>
          <p>{product.brand} · /{product.slug}</p>
          <p className={styles.summaryText}>{product.summary || "La ficha todavía no tiene resumen."}</p>
          {product.badge && <span className={styles.badge}>{product.badge}</span>}
        </div>
        <details className={styles.editorDisclosure}>
          <summary><PencilLine size={15} aria-hidden="true" /> Editar contenido</summary>
          <form action={save} className={styles.editorForm}>
            <div className={styles.fieldGrid}>
              <label className={styles.fieldWide}>Nombre<input name="name" required minLength={2} maxLength={180} defaultValue={product.name} /></label>
              <label className={styles.fieldWide}>Resumen<textarea name="summary" maxLength={500} rows={2} defaultValue={product.summary} /><small>Hasta 500 caracteres.</small></label>
              <label className={styles.fieldWide}>Descripción<textarea name="description" maxLength={10000} rows={4} defaultValue={product.description} /><small>Hasta 10.000 caracteres.</small></label>
              <label>URL de imagen<input name="image_url" type="text" inputMode="url" maxLength={2048} defaultValue={product.image_url ?? ""} placeholder="https://… o /images/…" /></label>
              <label>Texto alternativo<input name="image_alt" maxLength={300} defaultValue={product.image_alt} /></label>
              <label className={styles.fieldWide}>Distintivo<input name="badge" maxLength={80} defaultValue={product.badge ?? ""} placeholder="Opcional" /></label>
            </div>
            <p className={styles.editorNotice}>No se modifican publicación, precios, valoraciones ni variantes.</p>
            <button className={styles.saveButton} type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
            {error && <p className={styles.formError} role="alert">{error}</p>}
            {status && <p className={styles.formStatus} role="status">{status}</p>}
          </form>
        </details>
      </div>
    </article>
  );
}
