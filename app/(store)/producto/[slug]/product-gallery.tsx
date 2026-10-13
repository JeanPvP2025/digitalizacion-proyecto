"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./page.module.css";

export function ProductGallery({ image, alt, modelNumber, sourceUrl }: { image: string; alt: string; modelNumber?: string; sourceUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const available = Boolean(image) && !failed;
  return <figure className={styles.gallery}>
    <div className={`product-detail-image ${expanded ? styles.expanded : ""}`}>
      {available ? <Image src={image} alt={alt} fill sizes="(max-width: 760px) 100vw, 52vw" loading="eager" fetchPriority="high" unoptimized onError={() => setFailed(true)} /> : <span className="product-photo-placeholder">Imagen no disponible</span>}
      {modelNumber && <span className="detail-image-label">{modelNumber}</span>}
    </div>
    <figcaption className={styles.galleryCaption}><span>{available ? "Fotografía del modelo exacto" : "No hay una imagen disponible para esta referencia."}</span>{available && sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Fuente de la imagen</a>}{available && <button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Restaurar vista" : "Ver imagen completa"}</button>}</figcaption>
  </figure>;
}
