import { redirect } from "next/navigation";
import { BallotVisibility, PollMode, PollStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import Metrics from "@/components/Metrics";
import VoteCard from "@/components/VoteCard";
import Icon from "@/components/Icon";

const ALREADY_VOTED = "Voto già registrato.";

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

      if (poll.mode === PollMode.IN_PERSON) {
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

      let myChoice: string | null = null;
      let voted = false;

      if (poll.visibility === BallotVisibility.NAMED) {
        const mine = await db.namedVote.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId: user.id } },
          include: { option: true }
        });
        voted = !!mine;
        // Solo nel voto palese la scelta è collegata alla persona; nel segreto non esiste.
        myChoice = mine?.option.label ?? null;
      } else {
        voted = !!(await db.secretParticipation.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId: user.id } }
        }));
      }

      if (!reason && voted) reason = ALREADY_VOTED;

      return { poll, reason, myChoice };
    })
  );

  const toVote = cards.filter((item) => !item.reason);
  const others = cards.filter((item) => item.reason);
  const completed = others.filter((item) => item.reason === ALREADY_VOTED).length;

  const headline =
    cards.length === 0
      ? "Al momento non ci sono votazioni in corso."
      : toVote.length === 0
        ? completed === cards.length
          ? "Hai già votato in tutte le votazioni aperte."
          : "Per ora non puoi votare in nessuna delle votazioni aperte."
        : toVote.length === 1
          ? "Una votazione aspetta il tuo voto."
          : toVote.length + " votazioni aspettano il tuo voto.";

  return (
    <AppShell user={user}>
      <PageHeader title={"Ciao, " + user.firstName} description={headline} />

      <Metrics
        items={[
          { label: "Aperte", value: cards.length },
          { label: "Da votare", value: toVote.length },
          { label: "Già votate", value: completed }
        ]}
      />

      {cards.length === 0 ? (
        <div className="empty-state">
          <div>
            <strong>Nessuna votazione aperta</strong>
            Quando ne verrà aperta una la troverai qui.
          </div>
        </div>
      ) : (
        <>
          {toVote.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">Da votare</h2>
              </div>

              <div className="vote-grid">
                {toVote.map(({ poll }) => {
                  const secret = poll.visibility === BallotVisibility.SECRET;

                  return (
                    <article className="panel ballot" key={poll.id}>
                      <div className="ballot-badges">
                        <span
                          className={
                            "badge " + (poll.mode === PollMode.IN_PERSON ? "orange" : "green")
                          }
                        >
                          {poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono"}
                        </span>
                        <span className="badge">{secret ? "Segreto" : "Palese"}</span>
                        {poll.meeting && <span className="badge gray">{poll.meeting.title}</span>}
                      </div>

                      <h2>{poll.title}</h2>
                      {poll.description && <p className="ballot-desc">{poll.description}</p>}

                      <p className="ballot-note">
                        <Icon name="lock" size={16} />
                        {secret
                          ? "La tua identità non viene collegata alla scelta."
                          : "I rappresentanti d'istituto vedono chi ha votato e cosa."}
                      </p>

                      <VoteCard pollId={poll.id} options={poll.options} secret={secret} />
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">Già votate o non disponibili</h2>
              </div>

              <div className="panel done-list">
                {others.map(({ poll, reason, myChoice }) => {
                  const done = reason === ALREADY_VOTED;

                  return (
                    <div className="done-row" key={poll.id}>
                      <span className="done-title">{poll.title}</span>
                      <span className={"done-state" + (done ? "" : " waiting")}>
                        {done && <Icon name="check" size={16} />}
                        {done && myChoice ? "Hai votato: " + myChoice : reason}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
