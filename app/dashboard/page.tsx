import { redirect } from "next/navigation";
import { BallotVisibility, PollMode, PollStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import VoteCard from "@/components/VoteCard";
import LogoutButton from "@/components/LogoutButton";

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

      if (user.role === Role.ADMIN) {
        reason = "L'account tecnico amministratore non è avente diritto al voto.";
      }

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

  const isAdmin = [Role.INSTITUTE_REP, Role.ADMIN].includes(user.role);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">Comitato Studentesco</div>
          <div className="muted">
            {user.firstName} {user.lastName} · {user.className}
          </div>
        </div>

        <div className="row">
          {isAdmin && (
            <a className="button secondary" href="/admin">
              Amministrazione
            </a>
          )}
          <LogoutButton />
        </div>
      </header>

      <h1>Votazioni aperte</h1>

      {cards.length === 0 ? (
        <div className="card">Non ci sono votazioni aperte in questo momento.</div>
      ) : (
        <div className="grid">
          {cards.map(({ poll, reason }) => (
            <article className="card stack" key={poll.id}>
              <div className="row">
                <span
                  className={`badge ${poll.mode === PollMode.IN_PERSON ? "orange" : "green"}`}
                >
                  {poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono"}
                </span>
                <span className="badge">
                  {poll.visibility === BallotVisibility.SECRET ? "Segreto" : "Palese"}
                </span>
              </div>

              <div>
                <h2>{poll.title}</h2>
                {poll.description && <p className="muted">{poll.description}</p>}
                {poll.meeting && <p className="muted">Seduta: {poll.meeting.title}</p>}
              </div>

              <VoteCard
                pollId={poll.id}
                options={poll.options}
                disabledReason={reason}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
