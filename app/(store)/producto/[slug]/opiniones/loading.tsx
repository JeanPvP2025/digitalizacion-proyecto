import styles from "./page.module.css";

export default function ProductReviewsLoading() {
  return (
    <main className={styles.reviewsPage} aria-busy="true">
      <p className={styles.eyebrow}>COMUNIDAD NODRIA</p>
      <h1>Opiniones del producto</h1>
      <p className={styles.loadingState} role="status" aria-live="polite">
        Cargando opiniones y comprobando el acceso a la reseña…
      </p>
    </main>
  );
}
