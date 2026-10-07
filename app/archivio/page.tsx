import { redirect } from "next/navigation";
import { PollStatus, Role } from "@prisma/client";
import Link from "next/link";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AppHeader from "@/components/AppHeader";
import { formatDateTime } from "@/lib/datetime";
import ExportButtons from "@/components/ExportButtons";

export default async function ArchivePage() {
  const current = await sessionUser();

  if (!current) redirect("/login");

  const [meetings, polls] = await Promise.all([
    db.meeting.findMany({
      where: { status: "CLOSED" },
      orderBy: { startsAt: "desc" },
      take: 100,
      include: { _count: { select: { polls: true, attendance: true } } },
    }),
    db.poll.findMany({
      where: { status: PollStatus.CLOSED },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { meeting: true, _count: { select: { namedVotes: true, participation: true } } },
    }),
  ]);

  return (
    <>
    <AppHeader admin={current.role === Role.INSTITUTE_REP} />
    <main className="shell">

      <section className="hero">
        <div>
          <h1>Archivio del Comitato</h1>
          <p>Sedute concluse e votazioni chiuse conservate per la consultazione.</p>
        </div>
        {current.role === Role.INSTITUTE_REP ? (
          <ExportButtons />
        ) : (
          <span className="badge gray">{meetings.length + polls.length} elementi</span>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Sedute archiviate</h2>
            <div className="section-subtitle">Le sedute concluse non vengono più mostrate nella gestione corrente.</div>
          </div>
          <span className="badge gray">{meetings.length}</span>
        </div>

        {meetings.length === 0 ? (
          <div className="empty-state"><div><strong>Nessuna seduta archiviata</strong>Le sedute concluse compariranno qui.</div></div>
        ) : (
          <div className="archive-list">
            {meetings.map((meeting) => (
              <article className="card archive-item" key={meeting.id}>
                <div>
                  <h3>{meeting.title}</h3>
                  <div className="muted">{formatDateTime(meeting.startsAt)}</div>
                </div>
                <div className="archive-meta">
                  <span>{meeting._count.polls} votazioni</span>
                  <span>{meeting._count.attendance} presenze</span>
                  {current.role === Role.INSTITUTE_REP && (
                    <Link className="button secondary" href={"/admin/meetings/" + meeting.id}>Apri registro</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">Votazioni archiviate</h2>
            <div className="section-subtitle">Votazioni chiuse e relativi risultati.</div>
          </div>
          <span className="badge gray">{polls.length}</span>
        </div>

        {polls.length === 0 ? (
          <div className="empty-state"><div><strong>Nessuna votazione archiviata</strong>Le votazioni chiuse compariranno qui.</div></div>
        ) : (
          <div className="archive-list">
            {polls.map((poll) => (
              <article className="card archive-item" key={poll.id}>
                <div>
                  <h3>{poll.title}</h3>
                  <div className="muted">
                    {poll.meeting ? poll.meeting.title + " · " : ""}
                    {poll.visibility === "SECRET" ? "Voto segreto" : "Voto palese"}
                  </div>
                </div>
                <div className="archive-meta">
                  <span>{poll._count.namedVotes + poll._count.participation} partecipazioni</span>
                  {current.role === Role.INSTITUTE_REP && (
                    <Link className="button secondary" href={"/admin/polls/" + poll.id}>Risultati</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
    </>
  );
}
