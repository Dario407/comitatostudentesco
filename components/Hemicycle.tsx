/**
 * L'emiciclo dell'aula: file di seggi disposte ad arco. È l'unico motivo grafico del portale,
 * e richiama la sezione "Aula del Comitato" dei risultati. Decorativo, quindi nascosto agli screen reader.
 */
export default function Hemicycle({ className }: { className?: string }) {
  const cx = 240;
  const cy = 236;
  const radii = [84, 118, 152, 186, 220];

  const seats = radii.flatMap((radius, row) => {
    const count = Math.floor((Math.PI * radius) / 23);

    return Array.from({ length: count }, (_, i) => {
      const angle = Math.PI - (i * Math.PI) / (count - 1);
      // Alcuni seggi sono "occupati": schema fisso, così il disegno non cambia a ogni caricamento.
      const mark = (row * 7 + i * 3) % 11;
      const tone = mark === 0 ? "full" : mark === 5 || mark === 8 ? "mid" : "base";

      return {
        key: row + "-" + i,
        x: cx + radius * Math.cos(angle),
        y: cy - radius * Math.sin(angle),
        tone
      };
    });
  });

  return (
    <svg
      className={className}
      viewBox="0 0 480 250"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {seats.map((seat) => (
        <circle
          key={seat.key}
          cx={seat.x.toFixed(1)}
          cy={seat.y.toFixed(1)}
          r="6.4"
          className={"hemi-seat hemi-" + seat.tone}
        />
      ))}
    </svg>
  );
}
