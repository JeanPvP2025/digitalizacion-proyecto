export default function PcBuilderLoading() {
  return (
    <main className="builder-page" aria-busy="true" aria-live="polite">
      <section className="builder-banner">
        <div className="builder-banner-inner">
          <p className="eyebrow">NODRIA LAB · CONFIGURADOR</p>
          <h1>Cargando catálogo…</h1>
          <p>Estamos leyendo las piezas publicadas y sus datos técnicos.</p>
        </div>
      </section>
      <div className="builder-workspace">
        <div className="empty-state">Preparando las opciones del configurador…</div>
      </div>
    </main>
  );
}

