"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import type { ChatbotComparisonTable } from "@/lib/chatbot/types";
import styles from "./chatbot.module.css";

type ChatbotComparisonCardProps = {
  comparison: ChatbotComparisonTable;
};

export function ChatbotComparisonCard({ comparison }: ChatbotComparisonCardProps) {
  const { title, attributes, products, verdict } = comparison;

  return (
    <div className={styles.comparisonWrapper}>
      <div className={styles.comparisonHeader}>
        <span className={styles.comparisonBadge}>Comparativa Técnica</span>
        <h4 className={styles.comparisonTitle}>{title}</h4>
      </div>

      <div className={styles.comparisonScroll}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th className={styles.comparisonThAttribute}>Especificación</th>
              {products.map((p) => (
                <th key={p.slug} className={styles.comparisonThProduct}>
                  <div className={styles.thProductMedia}>
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.imageAlt || p.name}
                        width={48}
                        height={48}
                        className={styles.thProductImg}
                        unoptimized
                      />
                    ) : (
                      <div className={styles.thProductPlaceholder}>{p.brand.slice(0, 3)}</div>
                    )}
                  </div>
                  <div className={styles.thProductInfo}>
                    <span className={styles.thProductBrand}>{p.brand}</span>
                    <strong className={styles.thProductName}>
                      <Link href={`/producto/${p.slug}`} className={styles.thProductLink}>
                        {p.name}
                      </Link>
                    </strong>
                    <span className={styles.thProductPrice}>{formatPrice(p.price)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr) => (
              <tr key={attr}>
                <td className={styles.comparisonTdLabel}>{attr}</td>
                {products.map((p) => (
                  <td key={`${p.slug}-${attr}`} className={styles.comparisonTdValue}>
                    {p.specs[attr] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {verdict && (
        <div className={styles.comparisonVerdict}>
          <p>{verdict}</p>
        </div>
      )}
    </div>
  );
}
