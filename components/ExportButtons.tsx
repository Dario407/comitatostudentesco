import Icon from "@/components/Icon";

/** Scarica il riepilogo di sedute e votazioni. Sono link normali: il file arriva dal server. */
export default function ExportButtons() {
  return (
    <div className="row" aria-label="Scarica il riepilogo">
      <a className="button secondary small" href="/api/export/summary?format=xlsx" download>
        <Icon name="download" size={16} /> Riepilogo Excel
      </a>
      <a className="button secondary small" href="/api/export/summary?format=pdf" download>
        <Icon name="file" size={16} /> Riepilogo PDF
      </a>
    </div>
  );
}
