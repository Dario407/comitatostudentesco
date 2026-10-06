import Navigation from "@/components/Navigation";
import { BallotVisibility, PollMode, Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const CLASS_GROUPS = [
  "1A CL", "1B CL", "2A CL", "2B CL", "3A/B CL", "4A CL", "4B CL", "5A CL", "5B CL",
  "1C LIN", "1D LIN", "2C LIN", "2D LIN", "3C LIN", "3D LIN", "4C LIN", "4D LIN", "5C LIN", "5D LIN",
  "1 ALFA SU", "1 BETA SU", "1 GAMMA SU", "1 DELTA SU", "1 EPSILON SU",
  "2 ALFA SU", "2 BETA SU", "2 GAMMA SU", "2 DELTA SU", "2 EPSILON SU",
  "3 ALFA SU", "3 BETA SU", "3 GAMMA SU", "3 DELTA SU", "3 EPSILON SU",
  "4 ALFA SU", "4 BETA SU", "4 GAMMA SU", "4 DELTA SU", "4 EPSILON SU",
  "5 ALFA SU", "5 BETA SU", "5 GAMMA SU", "5 DELTA SU", "5 EPSILON SU",
  "1A ES", "1B ES", "1C ES", "1D ES", "1E ES",
  "2A ES", "2B ES", "2C ES", "2D ES", "2E ES",
  "3A ES", "3B ES", "3C ES", "3D ES", "3E ES",
  "4A ES", "4B ES", "4C ES", "4D ES",
  "5A ES", "5B ES", "5C ES", "5D ES",
  "1M", "2M", "3M", "4M", "5M"
];

export default async function PollResultsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await sessionUser();

  if (!current) redirect("/login");
  if (current.role !== Role.INSTITUTE_REP) redirect("/dashboard");

  const { id } = await params;

  const poll = await db.poll.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" } },
      namedVotes: { include: { user: true, option: true } },
      participation: { include: { user: true } },
      secretBallots: true,
      meeting: true
    }
  });

  if (!poll) notFound();

  const eligible =
    poll.mode === PollMode.IN_PERSON && poll.meetingId
      ? (await db.attendance.findMany({
          where: { meetingId: poll.meetingId, present: true },
          include: { user: true }
        })).map((item) => item.user).filter((user) => user.active)
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

  const classReps = await db.user.findMany({
    where: { active: true, role: Role.CLASS_REP },
    orderBy: [{ className: "asc" }, { lastName: "asc" }]
  });

  const eligibleIds = new Set(eligible.map((user) => user.id));
  const usersByClass = new Map<string, typeof classReps>();
  for (const user of classReps) {
    const list = usersByClass.get(user.className) ?? [];
    list.push(user);
    usersByClass.set(user.className, list);
  }

  const namedVoteByUser = new Map(
    poll.namedVotes.map((vote) => [vote.userId, vote])
  );

  const getSeatState = (userId: string) => {
    if (!eligibleIds.has(userId)) return "not-eligible";
    if (!voterIds.has(userId)) return "absent";
    if (poll.visibility === BallotVisibility.SECRET) return "voted";
    return "option";
  };

  return (
    <main className="shell projection-page">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark">CS</div>
          <div>
            <div className="brand">Comitato Studentesco</div>
            <div className="muted">Portale del Comitato</div>
          </div>
        </div>
        <Navigation admin={true} />
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Risultati votazione</div>
          <h1>{poll.title}</h1>
          <p className="projection-meta">
            {poll.visibility === BallotVisibility.SECRET ? "Voto segreto" : "Voto palese"}
            {" · "}
            {poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono"}
            {poll.meeting ? " · " + poll.meeting.title : ""}
          </p>
        </div>
        <div className="projection-summary"><strong>{voterIds.size}/{eligible.length}</strong><span>hanno votato</span><b>{counts.map((item) => item.count).join(" · ")}</b><small>{counts.map((item) => item.label).join(" · ")}</small></div>
      </section>

      <section className="section parliament-section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Aula del Comitato</h2>
            <div className="section-subtitle">Due seggi per classe · ogni seggio mostra le iniziali del rappresentante.</div>
          </div>
          <span className="badge gray">{CLASS_GROUPS.length} classi · {CLASS_GROUPS.length * 2} seggi</span>
        </div>

        <div className="parliament-board">
          {CLASS_GROUPS.map((className) => {
            const reps = usersByClass.get(className) ?? [];
            const seats = [reps[0], reps[1]];

            return (
              <div className="parliament-class" key={className}>
                <div className="parliament-class-name">{className}</div>
                <div className="parliament-seats">
                  {seats.map((rep, index) => {
                    const vote = rep ? namedVoteByUser.get(rep.id) : undefined;
                    const state = rep ? getSeatState(rep.id) : "empty";
                    const optionIndex = vote
                      ? poll.options.findIndex((option) => option.id === vote.optionId)
                      : -1;
                    const initials = rep
                      ? (rep.firstName[0] + rep.lastName[0]).toUpperCase()
                      : "·";

                    return (
                      <div
                        className={
                          "parliament-seat " +
                          state +
                          (optionIndex >= 0 ? " option-" + (optionIndex % 6) : "")
                        }
                        key={rep?.id ?? className + "-" + index}
                        title={
                          rep
                            ? rep.lastName + " " + rep.firstName +
                              (vote ? " - " + vote.option.label : voterIds.has(rep.id) ? " - Ha votato" : " - Non ha votato")
                            : "Seggio vacante"
                        }
                      >
                        <span>{initials}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="parliament-legend">
          <span><i className="legend-seat voted" /> Ha votato</span>
          <span><i className="legend-seat absent" /> Non ha votato</span>
          <span><i className="legend-seat empty" /> Rappresentante non presente in archivio</span>
          {poll.visibility === BallotVisibility.NAMED &&
            poll.options.map((option, index) => (
              <span key={option.id}>
                <i className={"legend-seat option-" + (index % 6)} /> {option.label}
              </span>
            ))}
        </div>
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
            <div className="section-subtitle">Distribuzione dei {totalVotes} voti registrati.</div>
          </div>
        </div>

        <div className="card">
          {counts.map((count) => {
            const percentage = totalVotes === 0 ? 0 : Math.round((count.count / totalVotes) * 100);
            return (
              <div className="result-row" key={count.id}>
                <div className="result-label">{count.label}</div>
                <div className="progress"><span style={{ width: percentage + "%" }} /></div>
                <div className="result-value">
                  {count.count}
                  <div className="meta">{percentage}%</div>
                </div>
              </div>
            );
          })}
          {counts.length === 0 && (
            <div className="empty-state">
              <div><strong>Nessuna opzione</strong>Questa votazione non contiene opzioni.</div>
            </div>
          )}
        </div>
      </section>

      {poll.visibility === BallotVisibility.SECRET && (
        <section className="section">
          <div className="notice">
            <strong>Voto segreto.</strong> Il sistema conserva separatamente la partecipazione e la scheda. È possibile vedere chi ha partecipato, ma non associare una persona alla scelta espressa.
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Non hanno votato</h2>
            <div className="section-subtitle">Aventi diritto senza voto registrato.</div>
          </div>
          <span className="badge gray">{nonVoters.length} utenti</span>
        </div>
        {nonVoters.length === 0 ? (
          <div className="success-box">Tutti gli aventi diritto hanno partecipato alla votazione.</div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nome</th><th>Classe</th></tr></thead>
                <tbody>
                  {nonVoters.map((user) => (
                    <tr key={user.id}>
                      <td><span className="user-name">{user.lastName} {user.firstName}</span></td>
                      <td>{user.className}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {poll.visibility === BallotVisibility.NAMED && (
        <section className="section">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Dettaglio voto palese</h2>
              <div className="section-subtitle">Elenco nominativo delle scelte registrate.</div>
            </div>
            <span className="badge green">{poll.namedVotes.length} voti</span>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nome</th><th>Classe</th><th>Scelta</th></tr></thead>
                <tbody>
                  {poll.namedVotes.sort((a, b) => a.user.lastName.localeCompare(b.user.lastName)).map((vote) => (
                    <tr key={vote.id}>
                      <td><span className="user-name">{vote.user.lastName} {vote.user.firstName}</span></td>
                      <td>{vote.user.className}</td>
                      <td><span className="badge">{vote.option.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
