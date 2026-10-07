import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeClass } from "@/lib/classes";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type ResetRequest = { userId: string; role: Role; name: string; className: string; requestedAt: Date };

/** Richieste di nuovo codice ancora aperte (ultime 24 ore, non ancora evase). */
async function openRequests() {
  const since = new Date(Date.now() - WINDOW_MS);

  const requests = await db.auditLog.findMany({
    where: { action: "RESET_REQUEST", targetType: "USER", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, createdAt: true }
  });

  const latest = new Map<string, Date>();
  for (const request of requests) {
    if (request.targetId && !latest.has(request.targetId)) latest.set(request.targetId, request.createdAt);
  }
  if (latest.size === 0) return [];

  const ids = [...latest.keys()];
  const [fulfilled, users] = await Promise.all([
    db.auditLog.findMany({
      where: { action: { in: ["CODE_ISSUED", "CODE_CHANGED"] }, targetId: { in: ids }, createdAt: { gte: since } },
      select: { targetId: true, createdAt: true }
    }),
    db.user.findMany({
      where: { id: { in: ids }, active: true, deletedAt: null },
      select: { id: true, role: true, firstName: true, lastName: true, className: true }
    })
  ]);

  return users
    .filter((user) => {
      const requestedAt = latest.get(user.id)!;
      return !fulfilled.some((event) => event.targetId === user.id && event.createdAt >= requestedAt);
    })
    .map<ResetRequest>((user) => ({
      userId: user.id,
      role: user.role,
      name: user.firstName + " " + user.lastName,
      className: user.className,
      requestedAt: latest.get(user.id)!
    }));
}

/** Chi può approvare: il compagno di classe (solo per un rappresentante di classe), oppure un rappresentante d'istituto. */
export function canApprove(
  actor: { id: string; role: Role; className: string },
  target: { id: string; role: Role; className: string }
) {
  if (actor.id === target.id) return false;
  if (actor.role === Role.INSTITUTE_REP) return true;
  // Un compagno di classe non può riassegnare l'account di un rappresentante d'istituto.
  if (target.role === Role.INSTITUTE_REP) return false;
  return normalizeClass(actor.className) === normalizeClass(target.className);
}

export async function requestsFor(actor: { id: string; role: Role; className: string }) {
  const all = await openRequests();
  return all.filter((item) => canApprove(actor, { id: item.userId, role: item.role, className: item.className }));
}

export async function openRequestFor(userId: string) {
  return (await openRequests()).find((item) => item.userId === userId) ?? null;
}
