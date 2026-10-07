import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link aria-label="NODRIA, inicio" className={`brand-mark${compact ? " brand-mark--compact" : ""}`} href="/">
      <svg aria-hidden="true" className="brand-symbol" viewBox="0 0 32 32" fill="none">
        <path d="M16 2 29 9.5v13L16 30 3 22.5v-13L16 2Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M16 7v18M8.2 11.5l15.6 9M23.8 11.5l-15.6 9" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="3.1" fill="var(--accent)" />
      </svg>
      {!compact && <span>NODRIA</span>}
    </Link>
  );
}
