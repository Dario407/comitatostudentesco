import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { codeVersion, createSessionToken, sessionCookie, verifyPurposeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailCodeHash, emailLookupKey, getRecoveryEmail } from "@/lib/contact";
import {
  checkLoginRateLimit,
  clientIp,
  recordLoginFailure,
  resetLoginRateLimit
} from "@/lib/rateLimit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10),
  code: z.string().trim().regex(/^\d{6}$/)
});

export async function POST(req: Request) {
  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Inserisci il codice a 6 cifre" }, { status: 400 });
  }

  try {
    const ip = clientIp(req);
    const payload = await verifyPurposeToken("email-login-otp", data.token);
    const lookup = payload && payload.email && payload.email !== "none"
      ? emailLookupKey(payload.email)
      : null;

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

    if (!payload || payload.uid === "none" || !payload.jti) {
      await recordLoginFailure(lookup, ip);
      return NextResponse.json({ error: "Codice non valido o scaduto" }, { status: 401 });
    }

    const expected = Buffer.from(payload.ch, "hex");
    const actual = Buffer.from(emailCodeHash(payload.uid, payload.email, data.code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await recordLoginFailure(lookup, ip);
      return NextResponse.json({ error: "Codice non valido o scaduto" }, { status: 401 });
    }

    // Verifica che questo OTP non sia già stato usato
    const alreadyUsed = await db.auditLog.findFirst({
      where: {
        action: "EMAIL_OTP_USED",
        targetType: "SESSION",
        targetId: payload.jti
      },
      select: { id: true }
    });
    if (alreadyUsed) {
      return NextResponse.json({ error: "Questo codice è già stato utilizzato." }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: payload.uid } });
    const currentEmail = user ? await getRecoveryEmail(user.id) : null;
    if (
      !user ||
      !user.active ||
      user.deletedAt ||
      codeVersion(user.accessCodeHash) !== payload.sv ||
      currentEmail !== payload.email
    ) {
      await recordLoginFailure(lookup, ip);
      return NextResponse.json({ error: "Codice non valido o scaduto" }, { status: 401 });
    }

    if (lookup) {
      await resetLoginRateLimit(lookup, ip);
    }

    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "EMAIL_OTP_USED",
        targetType: "SESSION",
        targetId: payload.jti
      }
    });

    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "LOGIN",
        targetType: "USER",
        targetId: user.id,
        metadata: { method: "email-otp" }
      }
    });

    const sessionToken = await createSessionToken(user);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie.name, sessionToken, sessionCookie.options);
    return res;
  } catch (error) {
    console.error("Verifica OTP email non riuscita", error);
    return NextResponse.json({ error: "Errore del server. Riprova tra poco." }, { status: 500 });
  }
}
