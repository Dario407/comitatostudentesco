import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, requireUser, sessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, verifyAccessCode } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  current: z.string().min(1).max(64),
  next: z.string().trim().min(8, "Il nuovo codice deve avere almeno 8 caratteri").max(64)
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dati non validi" },
        { status: 400 }
      );
    }
    const { current, next } = parsed.data;

    if (!verifyAccessCode(current, user.accessCodeHash)) {
      return NextResponse.json({ error: "Il codice attuale non è corretto" }, { status: 401 });
    }
    if (next === current.trim()) {
      return NextResponse.json({ error: "Scegli un codice diverso da quello attuale" }, { status: 400 });
    }
    if (/^(.)\1+$/.test(next)) {
      return NextResponse.json({ error: "Il codice è troppo semplice" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { accessCodeHash: hashAccessCode(next) }
    });

    await db.auditLog.create({
      data: { actorId: user.id, action: "CODE_CHANGED", targetType: "USER", targetId: user.id }
    });

    // Il nuovo codice chiude le altre sessioni; questa viene riemessa.
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookie.name, await createSessionToken(updated), sessionCookie.options);
    return res;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Accesso richiesto" : "Operazione non riuscita" },
      { status: msg === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
