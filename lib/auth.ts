import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";

const COOKIE_NAME = "cs_session";

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
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
    if (typeof payload.uid !== "string") return null;
    return db.user.findUnique({ where: { id: payload.uid } });
  } catch {
    return null;
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
