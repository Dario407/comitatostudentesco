import { redirect } from "next/navigation";
import { PollStatus, Role } from "@prisma/client";
import Link from "next/link";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
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

  const isAdmin = current.role === Role.INSTITUTE_REP;

  return (
    <AppShell user={current}>
      <PageHeader
        title="Archivio"
        description="Votazioni chiuse e sedute concluse, conservate per la consultazione."
        actions={isAdmin ? <ExportButtons /> : undefined}
      />

      <div className="archive-cols">
        <section>
          <div className="section-head">
            <h2 className="section-title">
              Votazioni <span className="badge gray">{polls.length}</span>
            </h2>
          </div>

          {polls.length === 0 ? (
            <div className="empty-state">
              <div>
                <strong>Nessuna votazione archiviata</strong>
                Le votazioni chiuse compariranno qui.
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {polls.map((poll) => (
                <div className="item" key={poll.id}>
                  <div className="item-main">
                    <div className="item-title">{poll.title}</div>
                    <div className="item-sub">
                      {poll.meeting ? poll.meeting.title + " · " : ""}
                      {poll.visibility === "SECRET" ? "Voto segreto" : "Voto palese"} ·{" "}
                      {poll._count.namedVotes + poll._count.participation} partecipazioni
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="item-actions">
                      <Link className="button secondary" href={"/admin/polls/" + poll.id}>
                        Risultati
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2 className="section-title">
              Sedute <span className="badge gray">{meetings.length}</span>
            </h2>
          </div>

          {meetings.length === 0 ? (
            <div className="empty-state">
              <div>
                <strong>Nessuna seduta archiviata</strong>
                Le sedute concluse compariranno qui.
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {meetings.map((meeting) => (
                <div className="item" key={meeting.id}>
                  <div className="item-main">
                    <div className="item-title">{meeting.title}</div>
                    <div className="item-sub">
                      {formatDateTime(meeting.startsAt)} · {meeting._count.polls} votazioni ·{" "}
                      {meeting._count.attendance} presenze
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="item-actions">
                      <Link className="button secondary" href={"/admin/meetings/" + meeting.id}>
                        Registro
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
