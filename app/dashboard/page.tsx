import Navigation from "@/components/Navigation";
import { redirect } from "next/navigation";
import { BallotVisibility, PollMode, PollStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import VoteCard from "@/components/VoteCard";

export default async function DashboardPage() {
  const user = await sessionUser();
  if (!user || !user.active) redirect("/login");

  const polls = await db.poll.findMany({
    where: { status: PollStatus.OPEN },
    include: {
      options: { orderBy: { position: "asc" } },
      meeting: true
    },
    orderBy: { createdAt: "desc" }
  });

  const cards = await Promise.all(
    polls.map(async (poll) => {
      let reason: string | null = null;

      if (!reason && poll.mode === PollMode.IN_PERSON) {
        if (!poll.meetingId) {
          reason = "Seduta non collegata.";
        } else {
          const attendance = await db.attendance.findUnique({
            where: {
              meetingId_userId: {
                meetingId: poll.meetingId,
                userId: user.id
              }
            }
          });

          if (!attendance?.present) {
            reason = "Puoi votare solo se risulti presente alla seduta.";
          }
        }
      }

      const voted =
        poll.visibility === BallotVisibility.NAMED
          ? !!(await db.namedVote.findUnique({
              where: { pollId_userId: { pollId: poll.id, userId: user.id } }
            }))
          : !!(await db.secretParticipation.findUnique({
              where: { pollId_userId: { pollId: poll.id, userId: user.id } }
            }));

      if (!reason && voted) reason = "Voto già registrato.";

      return { poll, reason };
    })
  );

  const canManage = user.role === Role.INSTITUTE_REP;
  const available = cards.filter((item) => !item.reason).length;
  const completed = cards.filter((item) => item.reason === "Voto già registrato.").length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark">CS</div>
          <div>
            <div className="brand">Comitato Studentesco</div>
            <div className="muted">Portale del Comitato</div>
          </div>
        </div>
        <Navigation admin={canManage} />
      </header>

      <section className="hero">
        <div>
          <h1>Votazioni aperte</h1>
          <p>
            Consulta le votazioni attive e registra il tuo voto quando ne hai
            diritto. Le votazioni segrete non associano la tua identità alla
            scelta espressa.
          </p>
        </div>

        <span className="badge">
          {cards.length} {cards.length === 1 ? "votazione attiva" : "votazioni attive"}
        </span>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Aperte</div>
          <div className="kpi">{cards.length}</div>
          <div className="stat-sub">Votazioni attualmente disponibili</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Puoi votare ora</div>
          <div className="kpi">{available}</div>
          <div className="stat-sub">Votazioni ancora da completare</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Già votate</div>
          <div className="kpi">{completed}</div>
          <div className="stat-sub">Voti già registrati</div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Votazioni</h2>
            <div className="section-subtitle">
              Seleziona una votazione per partecipare.
            </div>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="empty-state">
            <div>
              <strong>Nessuna votazione aperta</strong>
              In questo momento non ci sono votazioni a cui partecipare.
            </div>
          </div>
        ) : (
          <div className="grid">
            {cards.map(({ poll, reason }) => (
              <article className="card poll-card" key={poll.id}>
                <div className="row">
                  <span
                    className={"badge " + (poll.mode === PollMode.IN_PERSON ? "orange" : "green")}
                  >
                    {poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono"}
                  </span>
                  <span className="badge">
                    {poll.visibility === BallotVisibility.SECRET ? "Segreto" : "Palese"}
                  </span>
                </div>

                <div>
                  <h2>{poll.title}</h2>
                  {poll.description && (
                    <p className="muted">{poll.description}</p>
                  )}
                  {poll.meeting && (
                    <div className="meta">Seduta: {poll.meeting.title}</div>
                  )}
                </div>

                <div className="poll-card-footer">
                  <VoteCard
                    pollId={poll.id}
                    options={poll.options}
                    disabledReason={reason}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
