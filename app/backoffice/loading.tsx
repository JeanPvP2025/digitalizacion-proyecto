import styles from "@/components/backoffice/operations-center.module.css";

export default function BackofficeLoading() {
  return (
    <main className={styles.loading} aria-label="Cargando pedidos y eventos operativos" role="status">
      <span className={styles.loadingLine} />
      <span className={styles.loadingCards}><i /><i /><i /><i /></span>
      <span className={styles.loadingPanel} />
    </main>
  );
}
