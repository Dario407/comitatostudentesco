/** Scarica il riepilogo di sedute e votazioni. Sono link normali: il file arriva dal server. */
export default function ExportButtons() {
  return (
    <div className="row" aria-label="Scarica il riepilogo">
      <a className="button secondary" href="/api/export/summary?format=xlsx" download>
        Riepilogo Excel
      </a>
      <a className="button secondary" href="/api/export/summary?format=pdf" download>
        Riepilogo PDF
      </a>
    </div>
  );
}
