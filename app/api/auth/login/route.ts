import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { phoneLookup, verifyAccessCode } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().min(8).max(30),
  code: z.string().min(6).max(64)
});

export async function POST(req: Request) {
  try {
    const data = schema.parse(await req.json());
    const lookup = phoneLookup(data.phone);
    const user = await db.user.findUnique({ where: { phoneLookup: lookup } });

    if (!user || !user.active || !verifyAccessCode(data.code, user.accessCodeHash)) {
      return NextResponse.json({ error: "Numero o codice non validi" }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
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
  } catch {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }
}
