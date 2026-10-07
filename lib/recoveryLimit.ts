import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/** Limiti alle richieste di recupero: per indirizzo IP e per utente, contati nel registro. */
const ACTION = "RECOVERY_REQUEST";
const WINDOW_MS = 60 * 60 * 1000;

function key(kind: string, value: string) {
  const secret = process.env.PHONE_LOOKUP_SECRET;
  if (!secret) throw new Error("Missing environment variable: PHONE_LOOKUP_SECRET");
  return kind + ":" + createHmac("sha256", secret).update(kind + "|" + value).digest("hex").slice(0, 32);
}

/** Registra la richiesta e dice se è entro i limiti (10 all'ora per IP, 3 per utente). */
export async function recoveryAllowed(ip: string, userId: string | null) {
  const since = new Date(Date.now() - WINDOW_MS);
  const ipKey = key("ip", ip);
  const userKey = userId ? key("us", userId) : null;

  const [ipCount, userCount] = await Promise.all([
    db.auditLog.count({ where: { action: ACTION, targetId: ipKey, createdAt: { gte: since } } }),
    userKey
      ? db.auditLog.count({ where: { action: ACTION, targetId: userKey, createdAt: { gte: since } } })
      : Promise.resolve(0)
  ]);

  await db.auditLog.createMany({
    data: [
      { action: ACTION, targetType: "LOGIN_KEY", targetId: ipKey },
      ...(userKey ? [{ action: ACTION, targetType: "LOGIN_KEY", targetId: userKey }] : [])
    ]
  });

  return ipCount < 10 && userCount < 3;
}
