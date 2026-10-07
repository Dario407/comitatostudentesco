import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import UserManager from "@/components/UserManager";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import Metrics from "@/components/Metrics";

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
    <AppShell user={current}>
      <PageHeader
        title="Rappresentanti"
        description="Crea gli account, assegna i ruoli e rigenera i codici di accesso. I numeri di telefono non vengono mostrati né salvati in chiaro."
      />

      <Metrics
        items={[
          { label: "Utenti totali", value: users.length },
          { label: "Utenti attivi", value: activeUsers, hint: "Possono accedere" },
          { label: "Rappr. d'istituto", value: instituteReps, hint: "Accesso amministrativo" }
        ]}
      />

      <UserManager users={users} currentUserId={current.id} />
    </AppShell>
  );
}
