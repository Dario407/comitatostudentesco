import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/*
  Email di recupero. Per non richiedere una migrazione del database, l'indirizzo
  (confermato dall'utente con un codice o impostato alla creazione) è conservato nel registro:
  vale l'ultima voce EMAIL_SET / EMAIL_REMOVED di quell'utente.
*/

export async function getRecoveryEmail(userId: string): Promise<string | null> {
  const last = await db.auditLog.findFirst({
    where: { targetType: "USER", targetId: userId, action: { in: ["EMAIL_SET", "EMAIL_REMOVED"] } },
    orderBy: { createdAt: "desc" },
    select: { action: true, metadata: true }
  });

  if (!last || last.action !== "EMAIL_SET") return null;
  const email = (last.metadata as { email?: string } | null)?.email;
  return email ? email.trim().toLowerCase() : null;
}

/**
 * Restituisce una mappa userId -> email per tutti gli utenti che hanno un'email attiva.
 * Usato nella gestione utenti per mostrare lo stato dell'email senza query N+1.
 */
export async function getRecoveryEmailsMap(): Promise<Map<string, string>> {
  const logs = await db.auditLog.findMany({
    where: { targetType: "USER", action: { in: ["EMAIL_SET", "EMAIL_REMOVED"] } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, action: true, metadata: true }
  });

  const seen = new Set<string>();
  const activeEmails = new Map<string, string>();

  for (const log of logs) {
    if (!log.targetId || seen.has(log.targetId)) continue;
    seen.add(log.targetId);
    if (log.action === "EMAIL_SET") {
      const raw = (log.metadata as { email?: string } | null)?.email;
      if (raw) activeEmails.set(log.targetId, raw.trim().toLowerCase());
    }
  }

  return activeEmails;
}

/**
 * Cerca un utente attivo tramite il suo indirizzo email di recupero verificato.
 */
export async function findUserByRecoveryEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  const emailsMap = await getRecoveryEmailsMap();
  const matchingUserIds: string[] = [];
  for (const [uid, addr] of emailsMap.entries()) {
    if (addr === normalized) matchingUserIds.push(uid);
  }

  if (matchingUserIds.length === 0) return null;

  return db.user.findFirst({
    where: {
      id: { in: matchingUserIds },
      active: true,
      deletedAt: null
    }
  });
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  if (name.length <= 2) return name[0] + "***@" + domain;
  return name.slice(0, 2) + "***@" + domain;
}

export function emailCodeHash(uid: string, email: string, code: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret)
    .update([uid, email.trim().toLowerCase(), code].join("|"))
    .digest("hex");
}

/** Impronta HMAC dell'email per il rate-limiting senza salvare l'indirizzo in chiaro nei tentativi falliti. */
export function emailLookupKey(email: string) {
  const secret = process.env.PHONE_LOOKUP_SECRET ?? process.env.SESSION_SECRET ?? "";
  return (
    "em_" +
    createHmac("sha256", secret)
      .update(email.trim().toLowerCase())
      .digest("hex")
      .slice(0, 32)
  );
}
