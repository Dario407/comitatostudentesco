export type Metric = { label: string; value: string | number; hint?: string };

/** Una fascia di cifre: i dati principali della pagina, senza riquadri separati. */
export default function Metrics({ items }: { items: Metric[] }) {
  return (
    <dl className="metrics">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <dt className="metric-label">{item.label}</dt>
          <dd className="metric-value">{item.value}</dd>
          {item.hint && <dd className="metric-hint">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
