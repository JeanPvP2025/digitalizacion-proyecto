import styles from "./analytics.module.css";

export default function AnalyticsLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="Cargando analítica conectada">
      <header className={styles.header}>
        <div className={styles.breadcrumb}><span>Operaciones</span><span aria-hidden="true">/</span><span>Analítica</span></div>
        <div className={styles.headingRow}>
          <div><p className={styles.eyebrow}>NODRIA · INTELIGENCIA OPERATIVA</p><h1>Lo que dicen <em>los datos.</em></h1></div>
        </div>
      </header>
      <div className={styles.metricGrid}>
        {Array.from({ length: 5 }, (_, index) => <div key={index} className={styles.metricCard} aria-hidden="true"><span className={styles.metricTop}>CONSULTA PROTEGIDA</span><span className={styles.metricValue}>···</span></div>)}
      </div>
    </main>
  );
}
