import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const user = await sessionUser();

  if (!user) redirect("/login");
  if (!(user.role === Role.INSTITUTE_REP || user.role === Role.ADMIN)) {
    redirect("/dashboard");
  }

  const [meetings, polls, activeUsers] = await Promise.all([
    db.meeting.findMany({
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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">Amministrazione</div>
          <div className="muted">Sedute, presenze e votazioni</div>
        </div>

        <div className="row">
          <a className="button secondary" href="/admin/users">
            Utenti ({activeUsers})
          </a>
          <a className="button secondary" href="/dashboard">
            Dashboard
          </a>
        </div>
      </header>

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
