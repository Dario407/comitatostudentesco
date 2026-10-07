import AppHeader from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import UserManager from "@/components/UserManager";

export default async function UsersPage() {
  const current = await sessionUser();

  if (!current) redirect("/login");
  if (current.role !== Role.INSTITUTE_REP) {
    redirect("/dashboard");
  }

  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: [
      { className: "asc" },
      { lastName: "asc" },
      { firstName: "asc" }
    ],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      className: true,
      role: true,
      active: true
    }
  });

  const activeUsers = users.filter((user) => user.active).length;
  const instituteReps = users.filter(
    (user) => user.active && user.role === Role.INSTITUTE_REP
  ).length;

  return (
    <>
    <AppHeader admin={true} />
    <main className="shell">

      <section className="hero">
        <div>
          <h1>Rappresentanti e accessi</h1>
          <p>
            Crea gli account, assegna i ruoli e rigenera i codici di accesso.
            I numeri di telefono non vengono mostrati né salvati in chiaro.
          </p>
        </div>
        <span className="badge">Gestione account</span>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Utenti totali</div>
          <div className="kpi">{users.length}</div>
          <div className="stat-sub">Account presenti nel sistema</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Utenti attivi</div>
          <div className="kpi">{activeUsers}</div>
          <div className="stat-sub">Possono accedere all'app</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Rappresentanti d'istituto</div>
          <div className="kpi">{instituteReps}</div>
          <div className="stat-sub">Con accesso amministrativo</div>
        </div>
      </section>

      <UserManager users={users} currentUserId={current.id} />
    </main>
    </>
  );
}
