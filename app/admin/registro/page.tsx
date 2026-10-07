import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/datetime";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";

const LABELS: Record<string, string> = {
  LOGIN: "Accesso",
  LOGIN_FAILED: "Accesso non riuscito",
  CODE_CHANGED: "Codice cambiato dall'utente",
  CODE_ISSUED: "Codice assegnato",
  RESET_REQUEST: "Richiesta di nuovo codice",
  RESET_EMAIL_SENT: "Link di recupero inviato",
  EMAIL_SET: "Email di recupero salvata",
  EMAIL_REMOVED: "Email di recupero rimossa",
  EMAIL_CODE_SENT: "Codice di conferma email inviato",
  RESET_ACCESS_CODE: "Nuovo codice generato",
  CREATE_USER: "Account creato",
  UPDATE_USER: "Account modificato",
  DELETE_USER: "Account eliminato",
  IMPORT_USERS: "Utenti importati",
  CREATE_MEETING: "Seduta creata",
  CLOSE_MEETING: "Seduta archiviata",
  REOPEN_MEETING: "Seduta riaperta",
  DELETE_MEETING: "Seduta eliminata",
  MARK_PRESENT: "Presenza segnata",
  MARK_ABSENT: "Assenza segnata",
  CREATE_POLL: "Votazione creata",
  POLL_OPEN: "Votazione aperta",
  POLL_CLOSED: "Votazione chiusa",
  POLL_DRAFT: "Votazione riportata in bozza",
  POLL_RESET: "Voti azzerati",
  DELETE_POLL: "Votazione eliminata",
  VOTE_NAMED: "Voto palese espresso",
  VOTE_REMOVED: "Voto palese rimosso"
};

const GROUPS: { key: string; label: string; match: (a: string) => boolean }[] = [
  { key: "tutto", label: "Tutto", match: () => true },
  { key: "accessi", label: "Accessi", match: (a) => a.startsWith("LOGIN") || a.startsWith("CODE") || a.startsWith("RESET_") || a.startsWith("EMAIL_") || a === "RESET_ACCESS_CODE" },
  { key: "votazioni", label: "Votazioni", match: (a) => a.includes("POLL") || a.startsWith("VOTE") },
  { key: "utenti", label: "Utenti", match: (a) => a.endsWith("_USER") || a === "IMPORT_USERS" },
  { key: "sedute", label: "Sedute", match: (a) => a.includes("MEETING") || a.startsWith("MARK_") }
];

// Accessi falliti e sessioni chiuse sono rumore tecnico: le sessioni revocate non si mostrano mai.
const HIDDEN = new Set(["SESSION_REVOKED", "RECOVERY_REQUEST"]);

export default async function RegistroPage({
  searchParams
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const current = await sessionUser();
  if (!current) redirect("/login");
  if (current.role !== Role.INSTITUTE_REP) redirect("/dashboard");

  const { tipo = "tutto" } = await searchParams;
  const group = GROUPS.find((item) => item.key === tipo) ?? GROUPS[0];

  const raw = await db.auditLog.findMany({
    where: { action: { notIn: [...HIDDEN] } },
    orderBy: { createdAt: "desc" },
    take: 600,
    include: { actor: { select: { firstName: true, lastName: true } } }
  });

  const logs = raw.filter((log) => group.match(log.action)).slice(0, 200);

  const userIds = new Set<string>();
  const pollIds = new Set<string>();
  const meetingIds = new Set<string>();
  for (const log of logs) {
    if (log.targetType === "USER" && log.targetId) userIds.add(log.targetId);
    if (log.targetType === "POLL" && log.targetId) pollIds.add(log.targetId);
    if (log.targetType === "MEETING" && log.targetId) meetingIds.add(log.targetId);
    const meta = log.metadata as { userId?: string } | null;
    if (meta?.userId) userIds.add(meta.userId);
  }

  const [users, polls, meetings] = await Promise.all([
    db.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, firstName: true, lastName: true } }),
    db.poll.findMany({ where: { id: { in: [...pollIds] } }, select: { id: true, title: true } }),
    db.meeting.findMany({ where: { id: { in: [...meetingIds] } }, select: { id: true, title: true } })
  ]);

  const userName = new Map(users.map((u) => [u.id, u.lastName + " " + u.firstName]));
  const pollTitle = new Map(polls.map((p) => [p.id, p.title]));
  const meetingTitle = new Map(meetings.map((m) => [m.id, m.title]));

  function target(log: (typeof logs)[number]) {
    const meta = log.metadata as { userId?: string } | null;
    const parts: string[] = [];
    if (log.targetType === "USER" && log.targetId) parts.push(userName.get(log.targetId) ?? "utente eliminato");
    if (log.targetType === "POLL" && log.targetId) parts.push(pollTitle.get(log.targetId) ?? "votazione eliminata");
    if (log.targetType === "MEETING" && log.targetId) parts.push(meetingTitle.get(log.targetId) ?? "seduta eliminata");
    if (meta?.userId) parts.push(userName.get(meta.userId) ?? "utente eliminato");
    return parts.join(" · ");
  }

  return (
    <AppShell user={current}>
      <PageHeader
        title="Registro attività"
        description="Cosa è successo nel portale: accessi, votazioni, presenze e modifiche. I voti segreti non compaiono mai qui."
      />

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filtra il registro">
          {GROUPS.map((item) => (
            <Link
              key={item.key}
              href={item.key === "tutto" ? "/admin/registro" : "/admin/registro?tipo=" + item.key}
              className={item.key === group.key ? "active" : ""}
              aria-current={item.key === group.key ? "true" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <span className="meta">Ultime {logs.length} voci</span>
      </div>

      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Chi</th>
              <th>Azione</th>
              <th>Su</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="meta">{formatDateTime(log.createdAt, { dateStyle: "short", timeStyle: "medium" })}</td>
                <td>
                  {log.actor ? (
                    <span className="user-name">{log.actor.lastName} {log.actor.firstName}</span>
                  ) : (
                    <span className="muted">Sistema o anonimo</span>
                  )}
                </td>
                <td>{LABELS[log.action] ?? log.action}</td>
                <td className="muted">{target(log) || "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4}><div className="muted">Nessuna attività registrata.</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
