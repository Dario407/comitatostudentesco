import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import UserManager from "@/components/UserManager";

export default async function UsersPage() {
  const current = await sessionUser();

  if (!current) redirect("/login");
  if (!(current.role === Role.INSTITUTE_REP || current.role === Role.ADMIN)) {
    redirect("/dashboard");
  }

  const users = await db.user.findMany({
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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">Gestione utenti</div>
          <div className="muted">
            I numeri non vengono mostrati né conservati in chiaro.
          </div>
        </div>

        <a className="button secondary" href="/admin">
          Indietro
        </a>
      </header>

      <UserManager users={users} />
    </main>
  );
}
