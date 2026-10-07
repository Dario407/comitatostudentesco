import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/*
  Limite ai tentativi di accesso falliti.

  I tentativi vengono registrati nella tabella AuditLog, quindi il contatore è
  condiviso da tutte le istanze serverless e sopravvive ai riavvii (il vecchio
  contatore in memoria non faceva nessuna delle due cose). Non servono
  migrazioni: AuditLog esiste già.

  Si contano tre chiavi, tutte salvate come HMAC e mai in chiaro:
  - telefono + IP: poche prove, così chi sbaglia da casa propria si ferma presto;
  - telefono (da qualunque IP): soglia più alta, così un estraneo non riesce a
    bloccare l'account di un altro con pochi tentativi da un solo indirizzo;
  - IP: frena chi prova molti numeri diversi.
*/

const ACTION = "LOGIN_FAILED";
const TARGET_TYPE = "LOGIN_KEY";
const WINDOW_MS = 15 * 60 * 1000;

const LIMITS = {
  phoneIp: 5,
  phone: 12,
  ip: 30
} as const;

function secret() {
  const value = process.env.PHONE_LOOKUP_SECRET;
  if (!value) throw new Error("Missing environment variable: PHONE_LOOKUP_SECRET");
  return value;
}

function hash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex").slice(0, 32);
}

/** Su Vercel x-real-ip e x-forwarded-for sono impostati dalla piattaforma, non dal client. */
export function clientIp(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

type Key = { id: string; limit: number };

function keysFor(lookup: string | null, ip: string): Key[] {
  const keys: Key[] = [{ id: "ip:" + hash("ip|" + ip), limit: LIMITS.ip }];

  if (lookup) {
    keys.push({ id: "ph:" + lookup, limit: LIMITS.phone });
    keys.push({ id: "pi:" + hash(lookup + "|" + ip), limit: LIMITS.phoneIp });
  }

  return keys;
}

export async function checkLoginRateLimit(lookup: string | null, ip: string) {
  const since = new Date(Date.now() - WINDOW_MS);

  const results = await Promise.all(
    keysFor(lookup, ip).map(async (key) => {
      const rows = await db.auditLog.findMany({
        where: {
          action: ACTION,
          targetType: TARGET_TYPE,
          targetId: key.id,
          createdAt: { gte: since }
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true }
      });

      if (rows.length < key.limit) return 0;

      // Si torna sotto soglia quando scade il tentativo che sta "di troppo".
      const expiring = rows[rows.length - key.limit].createdAt.getTime() + WINDOW_MS;
      return Math.max(1, Math.ceil((expiring - Date.now()) / 1000));
    })
  );

  const retryAfterSeconds = Math.max(0, ...results);
  return retryAfterSeconds > 0
    ? { allowed: false as const, retryAfterSeconds }
    : { allowed: true as const, retryAfterSeconds: 0 };
}

export async function recordLoginFailure(lookup: string | null, ip: string) {
  await db.auditLog.createMany({
    data: keysFor(lookup, ip).map((key) => ({
      action: ACTION,
      targetType: TARGET_TYPE,
      targetId: key.id
    }))
  });

  // Pulizia: i tentativi più vecchi di un giorno non servono più.
  await db.auditLog.deleteMany({
    where: {
      action: ACTION,
      targetType: TARGET_TYPE,
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
}

/** Dopo un accesso riuscito si azzerano i tentativi di quel numero, ma non quelli dell'IP. */
export async function resetLoginRateLimit(lookup: string, ip: string) {
  const keys = keysFor(lookup, ip).filter((key) => !key.id.startsWith("ip:"));

  await db.auditLog.deleteMany({
    where: {
      action: ACTION,
      targetType: TARGET_TYPE,
      targetId: { in: keys.map((key) => key.id) }
    }
  });
}
