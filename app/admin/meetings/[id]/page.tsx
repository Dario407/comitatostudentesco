import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AttendanceManager from "@/components/AttendanceManager";

export default async function MeetingPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await sessionUser();

  if (!current) redirect("/login");
  if (![Role.INSTITUTE_REP, Role.ADMIN].includes(current.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const [meeting, users] = await Promise.all([
    db.meeting.findUnique({
      where: { id },
      include: { attendance: true }
    }),
    db.user.findMany({
      where: {
        active: true,
        role: { in: [Role.CLASS_REP, Role.INSTITUTE_REP] }
      },
      orderBy: [
        { className: "asc" },
        { lastName: "asc" },
        { firstName: "asc" }
      ]
    })
  ]);

  if (!meeting) notFound();

  const attendance = new Map(
    meeting.attendance.map((item) => [item.userId, item.present])
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">Presenze</div>
          <h1>{meeting.title}</h1>
          <div className="muted">
            {meeting.startsAt.toLocaleString("it-IT")}
          </div>
        </div>

        <a className="button secondary" href="/admin">
          Indietro
        </a>
      </header>

      <AttendanceManager
        meetingId={meeting.id}
        initial={users.map((user) => ({
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          className: user.className,
          present: attendance.get(user.id) ?? false
        }))}
      />
    </main>
  );
}
