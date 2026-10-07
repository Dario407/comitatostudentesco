import { BallotVisibility, PollMode, Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import ProjectionModeButton from "@/components/ProjectionModeButton";
import RemoveVoteButton from "@/components/RemoveVoteButton";
import ProjectionStage, { type StageCell } from "@/components/ProjectionStage";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import Metrics from "@/components/Metrics";
import { normalizeClass } from "@/lib/classes";

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

  const entitled =
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

  // Chi ha già votato conta tra gli ammessi anche se nel frattempo è stato disattivato
  // o segnato assente: altrimenti l'affluenza potrebbe superare il 100%.
  const admitted = new Map(entitled.map((user) => [user.id, user]));
  for (const vote of poll.visibility === BallotVisibility.NAMED
    ? poll.namedVotes
    : poll.participation) {
    admitted.set(vote.user.id, vote.user);
  }
  const eligible = [...admitted.values()];

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

  const instituteReps = await db.user.findMany({
    where: { active: true, role: Role.INSTITUTE_REP },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });

  const eligibleIds = new Set(eligible.map((user) => user.id));
  const usersByClass = new Map<string, typeof classReps>();
  for (const user of classReps) {
    const key = normalizeClass(user.className);
    const list = usersByClass.get(key) ?? [];
    list.push(user);
    usersByClass.set(key, list);
  }

  // Rappresentanti la cui classe non corrisponde a nessun gruppo dell'aula: senza avviso
  // sparirebbero dalla plancia senza che nessuno se ne accorga.
  const knownClasses = new Set(CLASS_GROUPS.map(normalizeClass));
  const unplaced = classReps.filter((user) => !knownClasses.has(normalizeClass(user.className)));

  const namedVoteByUser = new Map(
    poll.namedVotes.map((vote) => [vote.userId, vote])
  );

  const getSeatState = (userId: string) => {
    if (!eligibleIds.has(userId)) return "not-eligible";
    if (!voterIds.has(userId)) return "absent";
    if (poll.visibility === BallotVisibility.SECRET) return "voted";
    return "choice";
  };

  const secret = poll.visibility === BallotVisibility.SECRET;

  const stageCells: StageCell[] = CLASS_GROUPS.map((className) => {
    const reps = usersByClass.get(normalizeClass(className)) ?? [];
    return {
      name: className,
      seats: [reps[0], reps[1]].map((rep) => {
        if (!rep) return { initials: "", state: "empty", optionIndex: -1, title: "Seggio vacante" };
        const vote = namedVoteByUser.get(rep.id);
        return {
          initials: (rep.firstName[0] + rep.lastName[0]).toUpperCase(),
          state: getSeatState(rep.id),
          optionIndex: vote ? poll.options.findIndex((option) => option.id === vote.optionId) : -1,
          title:
            rep.lastName + " " + rep.firstName +
            (vote ? " - " + vote.option.label : voterIds.has(rep.id) ? " - Ha votato" : " - Non ha votato")
        };
      })
    };
  });

  const seatFor = (rep: (typeof instituteReps)[number]) => {
    const vote = namedVoteByUser.get(rep.id);
    return {
      initials: (rep.firstName[0] + rep.lastName[0]).toUpperCase(),
      state: getSeatState(rep.id),
      optionIndex: vote ? poll.options.findIndex((option) => option.id === vote.optionId) : -1,
      title:
        rep.lastName + " " + rep.firstName +
        (vote ? " - " + vote.option.label : voterIds.has(rep.id) ? " - Ha votato" : " - Non ha votato")
    };
  };

  if (instituteReps.length > 0) {
    stageCells.push({ name: "Rappr. d'istituto", wide: 3, seats: instituteReps.map(seatFor) });
  }

  const sortedNamed = [...poll.namedVotes].sort((a, b) =>
    a.user.lastName.localeCompare(b.user.lastName)
  );

  return (
    <AppShell user={current} projection>
      <ProjectionStage
        title={poll.title}
        meta={
          (secret ? "Voto segreto" : "Voto palese") +
          " · " +
          (poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono") +
          (poll.meeting ? " · " + poll.meeting.title : "")
        }
        voted={voterIds.size}
        eligible={eligible.length}
        counts={counts}
        totalVotes={totalVotes}
        cells={stageCells}
        showChoices={!secret}
        closed={poll.status === "CLOSED"}
      />
      <PageHeader
        back={{ href: "/admin", label: "Gestione" }}
        title={poll.title}
        description={
          (secret ? "Voto segreto" : "Voto palese") +
          " · " +
          (poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono") +
          (poll.meeting ? " · " + poll.meeting.title : "")
        }
        actions={<ProjectionModeButton />}
      />

      <section className="panel outcome proj-outcome">
        <div className="outcome-head">
          <h2>{poll.title}</h2>
          <div className="outcome-turnout">
            <strong>{voterIds.size}</strong>
            <span>su {eligible.length} hanno votato ({participationRate}%)</span>
          </div>
        </div>

        {totalVotes > 0 && (
          <div className="outcome-bar" aria-hidden="true">
            {counts.map((item, index) =>
              item.count > 0 ? (
                <span
                  key={item.id}
                  className={"option-" + (index % 6)}
                  style={{ width: (item.count / totalVotes) * 100 + "%" }}
                />
              ) : null
            )}
          </div>
        )}

        <div className="outcome-rows">
          {counts.map((item, index) => {
            const percentage = totalVotes === 0 ? 0 : Math.round((item.count / totalVotes) * 100);
            return (
              <div className={"outcome-row option-" + (index % 6)} key={item.id}>
                <div className="outcome-label">{item.label}</div>
                <div className="outcome-count">
                  <strong>{item.count}</strong>
                  <span>{percentage}%</span>
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

      <section className="section proj-aula">
        <div className="section-head">
          <div>
            <h2 className="section-title">Aula del Comitato</h2>
            <p className="section-note">
              Due seggi per classe, con le iniziali del rappresentante.
            </p>
          </div>
          <span className="badge gray">
            {CLASS_GROUPS.length} classi · {CLASS_GROUPS.length * 2} seggi
          </span>
        </div>

        <div className="parliament-board">
          {CLASS_GROUPS.map((className) => {
            const reps = usersByClass.get(normalizeClass(className)) ?? [];
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
                          (optionIndex >= 0 ? " seat-" + (optionIndex % 6) : "")
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

          {instituteReps.length > 0 && (
            <div className="parliament-class parliament-class-wide" key="istituto">
              <div className="parliament-class-name">Istituto</div>
              <div className="parliament-seats">
                {instituteReps.map((rep) => {
                  const seat = seatFor(rep);
                  return (
                    <div
                      className={
                        "parliament-seat " + seat.state +
                        (seat.optionIndex >= 0 ? " seat-" + (seat.optionIndex % 6) : "")
                      }
                      key={rep.id}
                      title={seat.title}
                    >
                      <span>{seat.initials}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="parliament-legend">
          <span><i className="legend-seat voted" /> Ha votato</span>
          <span><i className="legend-seat absent" /> Non ha votato</span>
          <span><i className="legend-seat empty" /> Seggio senza rappresentante</span>
          {!secret &&
            poll.options.map((option, index) => (
              <span key={option.id}>
                <i className={"legend-seat seat-" + (index % 6)} /> {option.label}
              </span>
            ))}
        </div>

        {unplaced.length > 0 && (
          <div className="notice no-fullscreen" style={{ marginTop: 14 }}>
            <strong>
              {unplaced.length}{" "}
              {unplaced.length === 1 ? "rappresentante non compare" : "rappresentanti non compaiono"}{" "}
              nell'aula
            </strong>{" "}
            perché la classe indicata non corrisponde a nessuna di quelle in elenco:{" "}
            {unplaced.map((user) => user.lastName + " " + user.firstName + " (" + user.className + ")").join(", ")}.
          </div>
        )}
      </section>

      <div className="no-fullscreen">
        <section className="section">
          <Metrics
            items={[
              { label: "Aventi diritto", value: eligible.length, hint: "Ammessi alla votazione" },
              { label: "Hanno votato", value: voterIds.size, hint: participationRate + "% degli aventi diritto" },
              { label: "Non hanno votato", value: nonVoters.length, hint: "Senza voto registrato" }
            ]}
          />

          {secret && (
            <div className="notice">
              <strong>Voto segreto.</strong> Il sistema conserva separatamente la partecipazione e la
              scheda: si vede chi ha partecipato, ma non si può associare una persona alla scelta.
            </div>
          )}
        </section>

        <section className="section">
          <details className="disclosure">
            <summary>
              Non hanno votato <span className="badge gray">{nonVoters.length}</span>
            </summary>
            <div className="disclosure-body">
              {nonVoters.length === 0 ? (
                <div className="panel-pad muted">Tutti gli aventi diritto hanno partecipato.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Nome</th><th>Classe</th></tr>
                    </thead>
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
              )}
            </div>
          </details>

          {!secret && (
            <details className="disclosure">
              <summary>
                Dettaglio voto palese <span className="badge green">{sortedNamed.length}</span>
              </summary>
              <div className="disclosure-body">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Nome</th><th>Classe</th><th>Scelta</th>{poll.status === "OPEN" && <th className="actions"><span className="sr-only">Azioni</span></th>}</tr>
                    </thead>
                    <tbody>
                      {sortedNamed.map((vote) => (
                        <tr key={vote.id}>
                          <td><span className="user-name">{vote.user.lastName} {vote.user.firstName}</span></td>
                          <td>{vote.user.className}</td>
                          <td><span className="badge">{vote.option.label}</span></td>
                          {poll.status === "OPEN" && (
                            <td className="actions">
                              <RemoveVoteButton
                                pollId={poll.id}
                                userId={vote.userId}
                                name={vote.user.firstName + " " + vote.user.lastName}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}
        </section>
      </div>
    </AppShell>
  );
}
