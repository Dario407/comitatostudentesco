/** Mostrato al volo mentre la dashboard carica: evita lo schermo bianco su connessioni lente. */
export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="Caricamento">
      <div className="skeleton" style={{ height: 44, width: "55%", marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 20, width: "70%", marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 96, marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </main>
  );
}
