import { redirect } from "next/navigation";
import { BallotVisibility, PollMode, PollStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { sessionUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import Metrics from "@/components/Metrics";
import VoteCard from "@/components/VoteCard";
import Icon from "@/components/Icon";
import AutoRefresh from "@/components/AutoRefresh";
import Link from "next/link";
import ResetRequestsPanel from "@/components/ResetRequestsPanel";
import { requestsFor } from "@/lib/resetRequests";
import { getRecoveryEmail } from "@/lib/contact";
import { mailEnabled } from "@/lib/mail";

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

  const [resetRequests, recoveryEmail] = await Promise.all([
    requestsFor(user),
    mailEnabled() ? getRecoveryEmail(user.id) : Promise.resolve("ok")
  ]);

  const toVote = cards.filter((item) => !item.reason);
  const others = cards.filter((item) => item.reason);
  const completed = others.filter((item) => item.reason === ALREADY_VOTED).length;
  const isAdmin = user.role === Role.INSTITUTE_REP;

  const headline =
    cards.length === 0
      ? "Al momento non ci sono votazioni aperte in corso."
      : toVote.length === 0
        ? completed === cards.length
          ? "Hai espresso il tuo voto in tutte le votazioni aperte."
          : "Non ci sono votazioni disponibili per il tuo stato attuale."
        : toVote.length === 1
          ? "C'è 1 votazione aperta che attende il tuo voto."
          : "Ci sono " + toVote.length + " votazioni aperte che attendono il tuo voto.";

  return (
    <AppShell user={user}>
      <PageHeader
        title={"Ciao, " + user.firstName}
        description={headline}
        actions={
          <div className="row">
            <AutoRefresh seconds={15} showButton />
            {isAdmin && (
              <Link className="button secondary small" href="/admin">
                <Icon name="dashboard" size={16} /> Gestione
              </Link>
            )}
          </div>
        }
      />

      {!recoveryEmail && (
        <div className="flash notice banner-action">
          <div className="banner-action-text">
            <Icon name="mail" size={20} />
            <div>
              <strong>Aggiungi un&apos;email di recupero.</strong> Se dimentichi il codice potrai sceglierne uno
              nuovo in autonomia senza attendere un rappresentante.
            </div>
          </div>
          <Link className="button secondary small" href="/account">
            Configura ora
          </Link>
        </div>
      )}

      <ResetRequestsPanel
        items={resetRequests.map((item) => ({
          userId: item.userId,
          name: item.name,
          className: item.className
        }))}
      />

      <Metrics
        items={[
          { label: "Votazioni aperte", value: cards.length, hint: "Attive in questo momento" },
          { label: "Da votare", value: toVote.length, hint: toVote.length > 0 ? "Richiedono la tua scelta" : "Tutto in pari" },
          { label: "Già votate", value: completed, hint: "Partecipazioni registrate" }
        ]}
      />

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-inner">
            <div className="empty-icon" aria-hidden="true">
              <Icon name="vote" size={28} />
            </div>
            <strong>Nessuna votazione aperta</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              La pagina si aggiorna da sola: appena la presidenza aprirà una votazione, la scheda comparirà qui.
            </p>
          </div>
        </div>
      ) : (
        <>
          {toVote.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2 className="section-title">
                  <span className="pulse-dot green" aria-hidden="true" /> Schede da votare{" "}
                  <span className="badge">{toVote.length}</span>
                </h2>
              </div>

              <div className="vote-grid">
                {toVote.map(({ poll }, index) => {
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
                        <span className={"badge " + (secret ? "" : "gray")}>
                          <Icon name={secret ? "lock" : "eye"} size={13} />
                          {secret ? "Voto segreto" : "Voto palese"}
                        </span>
                        {poll.meeting && (
                          <span className="badge gray">
                            <Icon name="calendar" size={13} /> {poll.meeting.title}
                          </span>
                        )}
                        {toVote.length > 1 && (
                          <span className="badge gray ballot-count">
                            Scheda {index + 1} di {toVote.length}
                          </span>
                        )}
                      </div>

                      <h2>{poll.title}</h2>
                      {poll.description && <p className="ballot-desc">{poll.description}</p>}

                      <div className={"ballot-privacy-card" + (secret ? " is-secret" : "")}>
                        <Icon name={secret ? "shield" : "info"} size={17} />
                        <span>
                          {secret
                            ? "Voto segreto garantito: la tua identità è separata dalla scheda e nessuno può vedere cosa scegli."
                            : "Voto palese: i rappresentanti d'istituto potranno consultare l'elenco nominativo delle scelte."}
                        </span>
                      </div>

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
                <h2 className="section-title">Riepilogo altre votazioni aperte</h2>
              </div>

              <div className="panel done-list">
                {others.map(({ poll, reason, myChoice }) => {
                  const done = reason === ALREADY_VOTED;
                  const secret = poll.visibility === BallotVisibility.SECRET;

                  return (
                    <div className="done-row" key={poll.id}>
                      <div className="done-main">
                        <span className="done-title">{poll.title}</span>
                        <div className="item-meta">
                          <span className="badge gray">
                            {poll.mode === PollMode.IN_PERSON ? "In presenza" : "Asincrono"}
                          </span>
                          <span className="badge gray">
                            {secret ? "Segreto" : "Palese"}
                          </span>
                          {poll.meeting && <span className="badge gray">{poll.meeting.title}</span>}
                        </div>
                      </div>

                      <div className="done-right">
                        <span className={"done-state" + (done ? "" : " waiting")}>
                          {done ? <Icon name="check" size={16} /> : <Icon name="info" size={16} />}
                          {done
                            ? myChoice
                              ? "Hai votato: " + myChoice
                              : "Voto segreto registrato"
                            : reason}
                        </span>
                        {isAdmin && (
                          <Link className="button secondary small" href={"/admin/polls/" + poll.id}>
                            Risultati
                          </Link>
                        )}
                      </div>
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
