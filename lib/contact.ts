import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/*
  Email di recupero. Per non richiedere una migrazione del database, l'indirizzo
  (già verificato dall'utente con un codice) è conservato nel registro: vale l'ultima
  voce EMAIL_SET / EMAIL_REMOVED di quell'utente. Se un giorno si vorrà una colonna dedicata,
  basta copiare questi valori.
*/

export async function getRecoveryEmail(userId: string): Promise<string | null> {
  const last = await db.auditLog.findFirst({
    where: { targetType: "USER", targetId: userId, action: { in: ["EMAIL_SET", "EMAIL_REMOVED"] } },
    orderBy: { createdAt: "desc" },
    select: { action: true, metadata: true }
  });

  if (!last || last.action !== "EMAIL_SET") return null;
  const email = (last.metadata as { email?: string } | null)?.email;
  return email ?? null;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return name.slice(0, 2) + "***@" + domain;
}

export function emailCodeHash(uid: string, email: string, code: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update([uid, email, code].join("|")).digest("hex");
}
