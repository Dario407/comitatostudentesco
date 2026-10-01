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
  if (!(current.role === Role.INSTITUTE_REP || current.role === Role.ADMIN)) {
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
          .filter((user) => user.active && user.role !== Role.ADMIN)
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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">Risultati</div>
          <h1>{poll.title}</h1>
          <div className="muted">
            {poll.visibility === BallotVisibility.SECRET
              ? "Voto segreto"
              : "Voto palese"}
          </div>
        </div>

        <a className="button secondary" href="/admin">
          Indietro
        </a>
      </header>

      <div className="grid">
        <div className="card">
          <div className="muted">Aventi diritto</div>
          <div className="kpi">{eligible.length}</div>
        </div>
        <div className="card">
          <div className="muted">Hanno votato</div>
          <div className="kpi">{voterIds.size}</div>
        </div>
        <div className="card">
          <div className="muted">Non hanno votato</div>
          <div className="kpi">{nonVoters.length}</div>
        </div>
      </div>

      <h2 className="section-title">Conteggio</h2>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Opzione</th>
              <th>Voti</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((count) => (
              <tr key={count.id}>
                <td>{count.label}</td>
                <td>
                  <strong>{count.count}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {poll.visibility === BallotVisibility.NAMED && (
        <>
          <h2 className="section-title">Chi ha votato cosa</h2>
          <div className="card">
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
                        {vote.user.lastName} {vote.user.firstName}
                      </td>
                      <td>{vote.user.className}</td>
                      <td>{vote.option.label}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {poll.visibility === BallotVisibility.SECRET && (
        <div className="notice section-title">
          Nel voto segreto il sistema conserva separatamente partecipazione e
          scheda: puoi vedere chi ha votato, ma non associare una persona alla
          scelta.
        </div>
      )}

      <h2 className="section-title">Non hanno votato</h2>
      <div className="card">
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
                  {user.lastName} {user.firstName}
                </td>
                <td>{user.className}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
