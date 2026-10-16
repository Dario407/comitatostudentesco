import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/datetime";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";

const LABELS: Record<string, string> = {
  LOGIN: "Accesso effettuato",
  LOGIN_FAILED: "Tentativo di accesso fallito",
  CODE_CHANGED: "Codice cambiato dall'utente",
  CODE_ISSUED: "Codice provvisorio assegnato",
  RESET_REQUEST: "Richiesta di nuovo codice",
  RESET_EMAIL_SENT: "Link di recupero inviato",
  EMAIL_SET: "Email di recupero salvata",
  EMAIL_REMOVED: "Email di recupero rimossa",
  EMAIL_CODE_SENT: "Codice di conferma email inviato",
  EMAIL_OTP_SENT: "Codice OTP di accesso inviato via email",
  RESET_ACCESS_CODE: "Nuovo codice generato",
  CREATE_USER: "Account creato",
  UPDATE_USER: "Account modificato",
  DELETE_USER: "Account eliminato",
  IMPORT_USERS: "Utenti importati da CSV",
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

function actionBadgeTone(action: string) {
  if (action.includes("DELETE") || action === "LOGIN_FAILED" || action === "POLL_RESET" || action === "VOTE_REMOVED") {
    return "red";
  }
  if (action === "POLL_OPEN" || action === "MARK_PRESENT" || action === "CREATE_POLL" || action === "CREATE_MEETING" || action === "EMAIL_SET") {
    return "green";
  }
  if (action.startsWith("RESET_") || action === "CODE_ISSUED") {
    return "orange";
  }
  return "gray";
}

const GROUPS: { key: string; label: string; match: (a: string) => boolean }[] = [
  { key: "tutto", label: "Tutto", match: () => true },
  {
    key: "accessi",
    label: "Accessi",
    match: (a) =>
      a.startsWith("LOGIN") ||
      a.startsWith("CODE") ||
      a.startsWith("RESET_") ||
      a.startsWith("EMAIL_") ||
      a === "RESET_ACCESS_CODE"
  },
  { key: "votazioni", label: "Votazioni", match: (a) => a.includes("POLL") || a.startsWith("VOTE") },
  { key: "utenti", label: "Utenti", match: (a) => a.endsWith("_USER") || a === "IMPORT_USERS" },
  { key: "sedute", label: "Sedute", match: (a) => a.includes("MEETING") || a.startsWith("MARK_") }
];

// Accessi falliti e sessioni chiuse sono rumore tecnico: le sessioni revocate e i marker OTP non si mostrano mai.
const HIDDEN = new Set(["SESSION_REVOKED", "RECOVERY_REQUEST", "EMAIL_OTP_USED"]);

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
        title="Registro di audit"
        description="Cronologia delle operazioni amministrative, accessi e presenze. I voti segreti non generano alcuna traccia."
      />

      <div className="panel">
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
          <span className="meta">Ultime {logs.length} operazioni</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data e ora</th>
                <th>Operatore</th>
                <th>Evento</th>
                <th>Oggetto</th>
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
                      <span className="muted">Sistema / Utente non autenticato</span>
                    )}
                  </td>
                  <td>
                    <span className={"badge " + actionBadgeTone(log.action)}>
                      {LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="muted">{target(log) || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="muted" style={{ padding: "12px 0", textAlign: "center" }}>
                      Nessuna attività registrata in questa categoria.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
