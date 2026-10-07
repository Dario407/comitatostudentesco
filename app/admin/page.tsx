import AppHeader from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { PollStatus, Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminPanel from "@/components/AdminPanel";
import ExportButtons from "@/components/ExportButtons";

export default async function AdminPage() {
  const user = await sessionUser();

  if (!user) redirect("/login");
  if (user.role !== Role.INSTITUTE_REP) {
    redirect("/dashboard");
  }

  const [meetings, activePolls, recentClosed, closedTotal, activeUsers] = await Promise.all([
    db.meeting.findMany({
      where: { status: "OPEN" },
      orderBy: { startsAt: "desc" },
      take: 50
    }),
    db.poll.findMany({
      where: { status: { in: [PollStatus.DRAFT, PollStatus.OPEN] } },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    // Le votazioni chiuse si accumulano: qui solo le ultime, le altre sono nell'Archivio.
    db.poll.findMany({
      where: { status: PollStatus.CLOSED },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    db.poll.count({ where: { status: PollStatus.CLOSED } }),
    db.user.count({
      where: { active: true }
    })
  ]);

  const polls = [...activePolls, ...recentClosed];
  const openPolls = activePolls.filter((poll) => poll.status === PollStatus.OPEN).length;

  return (
    <>
    <AppHeader admin={true} />
    <main className="shell">

      <section className="hero">
        <div>
          <h1>Gestione del Comitato</h1>
          <p>
            Organizza le sedute, registra le presenze e gestisci le votazioni
            da un unico pannello.
          </p>
        </div>

        <ExportButtons />
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Utenti attivi</div>
          <div className="kpi">{activeUsers}</div>
          <div className="stat-sub">Account attualmente abilitati</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Sedute aperte</div>
          <div className="kpi">{meetings.length}</div>
          <div className="stat-sub">Non ancora archiviate</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Votazioni aperte</div>
          <div className="kpi">{openPolls}</div>
          <div className="stat-sub">Attive in questo momento</div>
        </div>
      </section>

      <AdminPanel
        closedTotal={closedTotal}
        meetings={meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          startsAt: meeting.startsAt.toISOString()
        }))}
        polls={polls.map((poll) => ({
          id: poll.id,
          title: poll.title,
          status: poll.status,
          mode: poll.mode,
          visibility: poll.visibility
        }))}
      />
    </main>
    </>
  );
}
