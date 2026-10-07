import styles from "./crm.module.css";

export default function CrmLoading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-label="Cargando CRM">
      <aside className={styles.sidebar} />
      <div className={styles.main}>
        <div className={styles.loadingBar} />
        <div className={styles.loadingTitle} />
        <div className={styles.loadingMetrics}><i /><i /><i /><i /></div>
        <div className={styles.loadingPanel} />
      </div>
    </main>
  );
}
