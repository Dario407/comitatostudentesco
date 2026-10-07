import { cookies } from "next/headers";
import { createHmac, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";

const COOKIE_NAME = "cs_session";
const REVOKED_ACTION = "SESSION_REVOKED";

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

function sessionKey() {
  return new TextEncoder().encode(sessionSecret());
}

/**
 * Impronta del codice di accesso: se il codice viene rigenerato cambia, e tutte
 * le sessioni aperte con il vecchio codice smettono di valere.
 */
export function codeVersion(accessCodeHash: string) {
  return createHmac("sha256", sessionSecret())
    .update(accessCodeHash)
    .digest("hex")
    .slice(0, 24);
}

export async function createSessionToken(user: { id: string; accessCodeHash: string }) {
  return new SignJWT({ uid: user.id, sv: codeVersion(user.accessCodeHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey());
}

export async function sessionUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });

    // I token emessi prima dell'introduzione di jti e sv non sono più accettati.
    if (
      typeof payload.uid !== "string" ||
      typeof payload.sv !== "string" ||
      typeof payload.jti !== "string"
    ) {
      return null;
    }

    const user = await db.user.findUnique({ where: { id: payload.uid } });
    if (!user || user.deletedAt) return null;
    if (payload.sv !== codeVersion(user.accessCodeHash)) return null;

    // Sessione chiusa con "Esci": la revoca è nel registro, cercata dal momento dell'emissione.
    const issuedAt = new Date(((payload.iat ?? 0) - 1) * 1000);
    const revoked = await db.auditLog.findFirst({
      where: {
        action: REVOKED_ACTION,
        targetId: payload.jti,
        createdAt: { gte: issuedAt }
      },
      select: { id: true }
    });
    if (revoked) return null;

    return user;
  } catch {
    return null;
  }
}

/** Invalida la sessione corrente lato server, non solo cancellando il cookie. */
export async function revokeCurrentSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return;

  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    if (typeof payload.jti !== "string") return;

    await db.auditLog.create({
      data: {
        actorId: typeof payload.uid === "string" ? payload.uid : null,
        action: REVOKED_ACTION,
        targetType: "SESSION",
        targetId: payload.jti
      }
    });

    // Un token vale al massimo 12 ore: le revoche più vecchie di un giorno non servono più.
    await db.auditLog.deleteMany({
      where: {
        action: REVOKED_ACTION,
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
  } catch {
    // Token non valido o già scaduto: non c'è nulla da revocare.
  }
}

export async function requireUser() {
  const user = await sessionUser();
  if (!user || !user.active) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireInstituteRep() {
  const user = await requireUser();
  if (user.role !== Role.INSTITUTE_REP) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export const sessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12
  }
};

/*
  Token a scopo singolo (conferma email, recupero codice): firmati con una chiave derivata
  diversa da quella delle sessioni, così uno non può essere scambiato per l'altro.
*/
function purposeKey(purpose: string) {
  return new TextEncoder().encode(
    createHmac("sha256", sessionSecret()).update("cs-token-v1:" + purpose).digest("hex")
  );
}

export async function signPurposeToken(
  purpose: string,
  payload: Record<string, string>,
  expiresIn: string
) {
  return new SignJWT({ ...payload, pur: purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(purposeKey(purpose));
}

export async function verifyPurposeToken(purpose: string, token: string) {
  try {
    const { payload } = await jwtVerify(token, purposeKey(purpose), { algorithms: ["HS256"] });
    if (payload.pur !== purpose) return null;
    return payload as Record<string, string>;
  } catch {
    return null;
  }
}
