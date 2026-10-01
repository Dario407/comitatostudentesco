import { notFound, redirect } from "next/navigation";
import { BallotVisibility, PollMode, Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function PollResultsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await sessionUser();

  if (!current) redirect("/login");
  if (current.role !== Role.INSTITUTE_REP) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const poll = await db.poll.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" } },
      namedVotes: {
        include: {
          user: true,
          option: true
        }
      },
      participation: {
        include: { user: true }
      },
      secretBallots: true,
      meeting: true
    }
  });

  if (!poll) notFound();

  const eligible =
    poll.mode === PollMode.IN_PERSON && poll.meetingId
      ? (
          await db.attendance.findMany({
            where: {
              meetingId: poll.meetingId,
              present: true
            },
            include: { user: true }
          })
        )
          .map((item) => item.user)
          .filter((user) => user.active)
      : await db.user.findMany({
          where: {
            active: true,
            role: { in: [Role.CLASS_REP, Role.INSTITUTE_REP] }
          },
          orderBy: [{ className: "asc" }, { lastName: "asc" }]
        });

  const voterIds = new Set(
    poll.visibility === BallotVisibility.NAMED
      ? poll.namedVotes.map((vote) => vote.userId)
      : poll.participation.map((vote) => vote.userId)
  );

  const nonVoters = eligible.filter((user) => !voterIds.has(user.id));

  const counts = poll.options.map((option) => ({
    id: option.id,
    label: option.label,
    count:
      poll.visibility === BallotVisibility.NAMED
        ? poll.namedVotes.filter((vote) => vote.optionId === option.id).length
        : poll.secretBallots.filter((vote) => vote.optionId === option.id).length
  }));

  const totalVotes = counts.reduce((sum, item) => sum + item.count, 0);
  const participationRate =
    eligible.length === 0 ? 0 : Math.round((voterIds.size / eligible.length) * 100);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark">CS</div>
          <div>
            <div className="brand">Risultati</div>
            <div className="muted">{poll.title}</div>
          </div>
        </div>

        <div className="page-actions">
          <a className="button secondary" href="/admin">
            Amministrazione
          </a>
          <a className="button secondary" href="/dashboard">
            Area voto
          </a>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow" style={{ color: "rgba(255,255,255,.72)" }}>
            Risultati votazione
          </div>
          <h1>{poll.title}</h1>
          <p>
            {poll.visibility === BallotVisibility.SECRET
              ? "Voto segreto"
              : "Voto palese"}
            {" · "}
            {poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono"}
            {poll.meeting ? " · " + poll.meeting.title : ""}
          </p>
        </div>

        <span className="badge">
          {participationRate}% partecipazione
        </span>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Aventi diritto</div>
          <div className="kpi">{eligible.length}</div>
          <div className="stat-sub">Totale ammessi alla votazione</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Hanno votato</div>
          <div className="kpi">{voterIds.size}</div>
          <div className="stat-sub">{participationRate}% degli aventi diritto</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Non hanno votato</div>
          <div className="kpi">{nonVoters.length}</div>
          <div className="stat-sub">Ancora senza voto registrato</div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Conteggio</h2>
            <div className="section-subtitle">
              Distribuzione dei {totalVotes} voti registrati.
            </div>
          </div>
        </div>

        <div className="card">
          {counts.map((count) => {
            const percentage =
              totalVotes === 0 ? 0 : Math.round((count.count / totalVotes) * 100);

            return (
              <div className="result-row" key={count.id}>
                <div className="result-label">{count.label}</div>
                <div className="progress">
                  <span style={{ width: percentage + "%" }} />
                </div>
                <div className="result-value">
                  {count.count}
                  <div className="meta">{percentage}%</div>
                </div>
              </div>
            );
          })}

          {counts.length === 0 && (
            <div className="empty-state">
              <div>
                <strong>Nessuna opzione</strong>
                Questa votazione non contiene opzioni.
              </div>
            </div>
          )}
        </div>
      </section>

      {poll.visibility === BallotVisibility.SECRET && (
        <section className="section">
          <div className="notice">
            <strong>Voto segreto.</strong> Il sistema conserva separatamente
            la partecipazione e la scheda. È possibile vedere chi ha
            partecipato, ma non associare una persona alla scelta espressa.
          </div>
        </section>
      )}

      {poll.visibility === BallotVisibility.NAMED && (
        <section className="section">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Dettaglio voto palese</h2>
              <div className="section-subtitle">
                Elenco nominativo delle scelte registrate.
              </div>
            </div>
            <span className="badge green">{poll.namedVotes.length} voti</span>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Classe</th>
                    <th>Scelta</th>
                  </tr>
                </thead>
                <tbody>
                  {poll.namedVotes
                    .sort((a, b) =>
                      a.user.lastName.localeCompare(b.user.lastName)
                    )
                    .map((vote) => (
                      <tr key={vote.id}>
                        <td>
                          <span className="user-name">
                            {vote.user.lastName} {vote.user.firstName}
                          </span>
                        </td>
                        <td>{vote.user.className}</td>
                        <td>
                          <span className="badge">{vote.option.label}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Non hanno votato</h2>
            <div className="section-subtitle">
              Aventi diritto senza voto registrato.
            </div>
          </div>
          <span className="badge gray">{nonVoters.length} utenti</span>
        </div>

        {nonVoters.length === 0 ? (
          <div className="success-box">
            Tutti gli aventi diritto hanno partecipato alla votazione.
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Classe</th>
                  </tr>
                </thead>
                <tbody>
                  {nonVoters.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span className="user-name">
                          {user.lastName} {user.firstName}
                        </span>
                      </td>
                      <td>{user.className}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
