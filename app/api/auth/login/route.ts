import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { phoneLookup, verifyAccessCode } from "@/lib/security";
import {
  checkLoginRateLimit,
  clientIp,
  recordLoginFailure,
  resetLoginRateLimit
} from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().min(8).max(30),
  code: z.string().min(6).max(64)
});

// Hash di comodo: serve a far durare un accesso con numero sconosciuto quanto uno vero,
// così i tempi di risposta non rivelano se un numero è registrato.
const DUMMY_HASH = "00".repeat(16) + ":" + "00".repeat(64);

const INVALID_PHONE = "Numero di telefono non valido";

export async function POST(req: Request) {
  let data: z.infer<typeof schema>;

  try {
    data = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const ip = clientIp(req);

    let lookup: string | null = null;
    try {
      lookup = phoneLookup(data.phone);
    } catch (error) {
      // Un numero malformato è un tentativo fallito come gli altri; ogni altro errore no.
      if (!(error instanceof Error) || error.message !== INVALID_PHONE) throw error;
    }

    const rate = await checkLoginRateLimit(lookup, ip);

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "Troppi tentativi. Riprova più tardi.",
          retryAfterSeconds: rate.retryAfterSeconds
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) }
        }
      );
    }

    const user = lookup ? await db.user.findUnique({ where: { phoneLookup: lookup } }) : null;

    const valid =
      user && user.active && !user.deletedAt
        ? verifyAccessCode(data.code, user.accessCodeHash)
        : (verifyAccessCode(data.code, DUMMY_HASH), false);

    if (!user || !valid) {
      await recordLoginFailure(lookup, ip);
      return NextResponse.json({ error: "Numero o codice non validi" }, { status: 401 });
    }

    await resetLoginRateLimit(lookup!, ip);

    const token = await createSessionToken(user);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie.name, token, sessionCookie.options);

    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "LOGIN",
        targetType: "USER",
        targetId: user.id
      }
    });

    return res;
  } catch (error) {
    console.error("Login non riuscito", error);
    return NextResponse.json(
      { error: "Errore del server. Riprova tra poco." },
      { status: 500 }
    );
  }
}
