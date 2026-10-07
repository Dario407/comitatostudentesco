import AppHeader from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { BallotVisibility, PollMode, PollStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import VoteCard from "@/components/VoteCard";
import { tintIndex } from "@/lib/tint";

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

  const headline =
    cards.length === 0
      ? "Al momento non ci sono votazioni in corso."
      : available === 0
        ? completed === cards.length
          ? "Hai già votato in tutte le votazioni aperte."
          : "Per ora non puoi votare in nessuna delle votazioni aperte."
        : available === 1
          ? "Una votazione aspetta il tuo voto."
          : available + " votazioni aspettano il tuo voto.";

  return (
    <>
      <AppHeader admin={canManage} />

      <main className="shell">
        <section className="hero">
          <div>
            <h1>Votazioni aperte</h1>
            <p>{headline}</p>
          </div>

          <ul className="tally" aria-label="Riepilogo">
            <li><b>{cards.length}</b> aperte</li>
            <li><b>{available}</b> da votare</li>
            <li><b>{completed}</b> già votate</li>
          </ul>
        </section>

        {cards.length === 0 ? (
          <div className="empty-state">
            <div>
              <strong>Nessuna votazione aperta</strong>
              Quando ne verrà aperta una la troverai qui.
            </div>
          </div>
        ) : (
          <div className="ballot-list">
            {cards.map(({ poll, reason }) => (
              <article className={"ballot tint-" + tintIndex(poll.id)} key={poll.id}>
                <aside className="ballot-stub">
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

                  <p className="stub-note">
                    {poll.visibility === BallotVisibility.SECRET
                      ? "La tua identità non viene collegata alla scelta."
                      : "I rappresentanti d'istituto vedono chi ha votato e cosa."}
                  </p>

                  {poll.meeting && (
                    <div className="stub-meeting">Seduta: {poll.meeting.title}</div>
                  )}
                </aside>

                <div className="ballot-body">
                  <h2>{poll.title}</h2>
                  {poll.description && <p className="ballot-description">{poll.description}</p>}

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
      </main>
    </>
  );
}
