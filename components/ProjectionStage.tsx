import ProjectionModeButton from "@/components/ProjectionModeButton";

export type StageSeat = { initials: string; state: string; optionIndex: number; title: string };
export type StageCell = { name: string; seats: StageSeat[]; wide?: number };

/**
 * Palco della proiezione: copre l'intera finestra (nascosto finché non si entra in
 * modalità proiezione) e mostra esito e aula in una sola schermata, su fondo scuro.
 */
export default function ProjectionStage({
  title,
  meta,
  voted,
  eligible,
  counts,
  totalVotes,
  cells,
  showChoices,
  closed,
  outcome
}: {
  title: string;
  meta: string;
  voted: number;
  eligible: number;
  counts: { id: string; label: string; count: number }[];
  totalVotes: number;
  cells: StageCell[];
  showChoices: boolean;
  closed: boolean;
  outcome: { text: string; tone: "good" | "bad" | "neutral" };
}) {
  const rate = eligible === 0 ? 0 : Math.round((voted / eligible) * 100);
  const leader = Math.max(0, ...counts.map((item) => item.count));

  return (
    <div className="stage" role="region" aria-label="Proiezione della votazione">
      <header className="stage-top">
        <div className="stage-brand">
          <span className="brand-mark" aria-hidden="true">CS</span>
          <span>Comitato Studentesco</span>
        </div>
        <span className={"stage-status" + (closed ? " closed" : "")}>
          <i aria-hidden="true" />
          {closed ? "Votazione chiusa" : "Votazione in corso"}
        </span>
        <ProjectionModeButton variant="exit" />
      </header>

      <section className="stage-result">
        <p className="stage-meta">{meta}</p>
        <h1 className="stage-title">{title}</h1>

        <div className="stage-turnout">
          <div className="stage-turnout-num">
            <strong>{voted}</strong>
            <span>/ {eligible}</span>
          </div>
          <div className="stage-turnout-label">hanno votato · {rate}%</div>
          <div className="stage-meter"><span style={{ width: rate + "%" }} /></div>
          <div className={"stage-outcome " + outcome.tone}>{outcome.text}</div>
        </div>

        <ol className="stage-options">
          {counts.map((item, index) => {
            const pct = totalVotes === 0 ? 0 : Math.round((item.count / totalVotes) * 100);
            const lead = item.count > 0 && item.count === leader;
            return (
              <li className={"stage-option option-" + (index % 6) + (lead ? " lead" : "")} key={item.id}>
                <div className="stage-option-head">
                  <span className="stage-option-label">{item.label}</span>
                  <span className="stage-option-count">
                    <strong>{item.count}</strong>
                    <small>{pct}%</small>
                  </span>
                </div>
                <div className="stage-option-bar"><span style={{ width: pct + "%" }} /></div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="stage-aula">
        <div className="stage-aula-head">
          <h2>Aula del Comitato</h2>
          <ul className="stage-legend">
            <li><i className="s-voted" /> Ha votato</li>
            <li><i className="s-absent" /> Non ha votato</li>
            {showChoices &&
              counts.map((item, index) => (
                <li key={item.id}><i className={"s-seat-" + (index % 6)} /> {item.label}</li>
              ))}
          </ul>
        </div>

        <div className="stage-board">
          {cells.map((cell) => (
            <div
              className="stage-class"
              key={cell.name}
              style={cell.wide ? { gridColumn: "span " + cell.wide } : undefined}
            >
              <span className="stage-class-name">{cell.name}</span>
              <span className="stage-seats">
                {cell.seats.map((seat, index) => (
                  <i
                    key={index}
                    className={
                      "stage-seat s-" +
                      seat.state +
                      (seat.optionIndex >= 0 ? " s-seat-" + (seat.optionIndex % 6) : "")
                    }
                    title={seat.title}
                  >
                    {seat.initials}
                  </i>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
