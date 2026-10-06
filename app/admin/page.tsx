import Navigation from "@/components/Navigation";
import { redirect } from "next/navigation";
import { PollStatus, Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const user = await sessionUser();

  if (!user) redirect("/login");
  if (user.role !== Role.INSTITUTE_REP) {
    redirect("/dashboard");
  }

  const [meetings, polls, activeUsers] = await Promise.all([
    db.meeting.findMany({
      where: { status: "OPEN" },
      orderBy: { startsAt: "desc" },
      take: 50
    }),
    db.poll.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    db.user.count({
      where: { active: true }
    })
  ]);

  const openPolls = polls.filter((poll) => poll.status === PollStatus.OPEN).length;

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
        <Navigation admin={true} />
      </header>

      <section className="hero">
        <div>
          <h1>Gestione del Comitato</h1>
          <p>
            Organizza le sedute, registra le presenze e gestisci le votazioni
            da un unico pannello.
          </p>
        </div>

        <span className="badge">Area amministrativa</span>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Utenti attivi</div>
          <div className="kpi">{activeUsers}</div>
          <div className="stat-sub">Account attualmente abilitati</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Sedute registrate</div>
          <div className="kpi">{meetings.length}</div>
          <div className="stat-sub">Ultime 50 visualizzate</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Votazioni aperte</div>
          <div className="kpi">{openPolls}</div>
          <div className="stat-sub">Attive in questo momento</div>
        </div>
      </section>

      <AdminPanel
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
  );
}
