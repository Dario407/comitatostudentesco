import { redirect } from "next/navigation";
import { PollStatus, Role } from "@prisma/client";
import Link from "next/link";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { formatDateTime } from "@/lib/datetime";
import ExportButtons from "@/components/ExportButtons";
import Metrics from "@/components/Metrics";
import Icon from "@/components/Icon";

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
  const totalVotesCast = polls.reduce(
    (sum, p) => sum + p._count.namedVotes + p._count.participation,
    0
  );

  return (
    <AppShell user={current}>
      <PageHeader
        title="Archivio storico"
        description="Votazioni concluse e verbali delle sedute precedenti, conservati per la consultazione."
        actions={isAdmin ? <ExportButtons /> : undefined}
      />

      <Metrics
        items={[
          { label: "Votazioni concluse", value: polls.length, hint: "Archiviate nel registro" },
          { label: "Sedute archiviate", value: meetings.length, hint: "Verbali consolidati" },
          { label: "Voti totali registrati", value: totalVotesCast, hint: "Partecipazioni complessive" }
        ]}
      />

      <div className="archive-cols">
        <section>
          <div className="section-head">
            <h2 className="section-title">
              <Icon name="vote" size={20} /> Votazioni chiuse{" "}
              <span className="badge gray">{polls.length}</span>
            </h2>
          </div>

          {polls.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-inner">
                <div className="empty-icon" aria-hidden="true">
                  <Icon name="archive" size={26} />
                </div>
                <strong>Nessuna votazione archiviata</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Le votazioni chiuse compariranno automaticamente qui.
                </p>
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {polls.map((poll) => {
                const count = poll._count.namedVotes + poll._count.participation;
                return (
                  <div className="item" key={poll.id}>
                    <div className="item-main">
                      <div className="item-title">{poll.title}</div>
                      <div className="item-meta">
                        <span className="badge gray">
                          <Icon name={poll.visibility === "SECRET" ? "lock" : "eye"} size={12} />
                          {poll.visibility === "SECRET" ? "Segreto" : "Palese"}
                        </span>
                        <span className="badge gray">{count} voti</span>
                        {poll.meeting && (
                          <span className="badge gray">
                            <Icon name="calendar" size={12} /> {poll.meeting.title}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="item-actions">
                        <Link className="button secondary small" href={"/admin/polls/" + poll.id}>
                          Esito e dettagli
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2 className="section-title">
              <Icon name="calendar" size={20} /> Sedute concluse{" "}
              <span className="badge gray">{meetings.length}</span>
            </h2>
          </div>

          {meetings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-inner">
                <div className="empty-icon" aria-hidden="true">
                  <Icon name="calendar" size={26} />
                </div>
                <strong>Nessuna seduta archiviata</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Le sedute archiviate compariranno qui con il riepilogo presenze.
                </p>
              </div>
            </div>
          ) : (
            <div className="panel item-list">
              {meetings.map((meeting) => (
                <div className="item" key={meeting.id}>
                  <div className="item-main">
                    <div className="item-title">{meeting.title}</div>
                    <div className="item-sub">
                      <Icon name="clock" size={13} /> {formatDateTime(meeting.startsAt)}
                    </div>
                    <div className="item-meta">
                      <span className="badge gray">{meeting._count.polls} votazioni</span>
                      <span className="badge gray">{meeting._count.attendance} presenze registrate</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="item-actions">
                      <a
                        className="button ghost small"
                        href={"/api/meetings/" + meeting.id + "/minutes"}
                        download
                        title="Scarica verbale PDF"
                      >
                        <Icon name="download" size={15} /> PDF
                      </a>
                      <Link className="button secondary small" href={"/admin/meetings/" + meeting.id}>
                        Appello
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
