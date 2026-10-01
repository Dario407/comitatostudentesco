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
  if (!(current.role === Role.INSTITUTE_REP || current.role === Role.ADMIN)) {
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
        <div className="brand-row">
          <div className="brand-mark">CS</div>
          <div>
            <div className="brand">Presenze</div>
            <div className="muted">{meeting.title}</div>
          </div>
        </div>

        <div className="page-actions">
          <a className="button secondary" href="/admin">
            Amministrazione
          </a>
          <a className="button secondary" href="/dashboard">
            Area voto
          </a>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow" style={{ color: "rgba(255,255,255,.72)" }}>
            Registro della seduta
          </div>
          <h1>{meeting.title}</h1>
          <p>
            {meeting.startsAt.toLocaleString("it-IT", {
              dateStyle: "full",
              timeStyle: "short"
            })}
          </p>
        </div>

        <span className="badge">{users.length} aventi diritto</span>
      </section>

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
