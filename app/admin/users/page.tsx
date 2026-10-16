import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecoveryEmailsMap, maskEmail } from "@/lib/contact";
import { mailEnabled } from "@/lib/mail";
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

  const [users, emailsMap] = await Promise.all([
    db.user.findMany({
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
    }),
    getRecoveryEmailsMap()
  ]);

  const enrichedUsers = users.map((u) => {
    const rawEmail = emailsMap.get(u.id);
    return {
      ...u,
      maskedEmail: rawEmail ? maskEmail(rawEmail) : null
    };
  });

  const activeUsers = enrichedUsers.filter((user) => user.active).length;
  const instituteReps = enrichedUsers.filter(
    (user) => user.active && user.role === Role.INSTITUTE_REP
  ).length;
  const withEmailCount = enrichedUsers.filter(
    (user) => user.active && user.maskedEmail
  ).length;

  return (
    <AppShell user={current}>
      <PageHeader
        title="Rappresentanti"
        description="Crea gli account, assegna i ruoli, verifica la copertura email e rigenera i codici di accesso. I numeri di telefono non vengono salvati in chiaro."
      />

      <Metrics
        items={[
          { label: "Utenti totali", value: enrichedUsers.length },
          { label: "Utenti attivi", value: activeUsers, hint: "Possono accedere" },
          { label: "Email configurate", value: `${withEmailCount}/${activeUsers}`, hint: "Recupero autonomo attivo" },
          { label: "Rappr. d'istituto", value: instituteReps, hint: "Accesso amministrativo" }
        ]}
      />

      <UserManager
        users={enrichedUsers}
        currentUserId={current.id}
        mailEnabled={mailEnabled()}
      />
    </AppShell>
  );
}
