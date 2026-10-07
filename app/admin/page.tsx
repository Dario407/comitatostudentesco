import { redirect } from "next/navigation";
import { PollStatus, Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminPanel from "@/components/AdminPanel";
import ExportButtons from "@/components/ExportButtons";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import Metrics from "@/components/Metrics";

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
    <AppShell user={user}>
      <PageHeader
        title="Gestione"
        description="Sedute, presenze e votazioni del Comitato."
        actions={<ExportButtons />}
      />

      <Metrics
        items={[
          { label: "Utenti attivi", value: activeUsers, hint: "Account abilitati" },
          { label: "Sedute aperte", value: meetings.length, hint: "Non ancora archiviate" },
          { label: "Votazioni aperte", value: openPolls, hint: "Attive adesso" }
        ]}
      />

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
    </AppShell>
  );
}
