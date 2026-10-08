"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./page.module.css";

export function ProductGallery({ image, alt, demo, sku }: { image: string; alt: string; demo: boolean; sku: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const available = Boolean(image) && !failed;
  return <figure className={styles.gallery}>
    <div className={`product-detail-image ${expanded ? styles.expanded : ""}`}>
      {available ? demo ? <Image src={image} alt={alt} fill sizes="(max-width: 760px) 100vw, 52vw" loading="eager" fetchPriority="high" onError={() => setFailed(true)} /> :
        // Connected origins retain the existing unoptimized public-image contract.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt} fetchPriority="high" onError={() => setFailed(true)} /> : <span className="product-photo-placeholder">Imagen no disponible</span>}
      <span className="detail-image-label">{sku}</span>
    </div>
    <figcaption className={styles.galleryCaption}><span>{available ? "1 imagen publicada · referencia visual de la demo" : "No hay una imagen disponible para esta referencia."}</span>{available && <button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Restaurar vista" : "Ver imagen completa"}</button>}</figcaption>
  </figure>;
}
