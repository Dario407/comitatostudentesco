import { NextResponse } from "next/server";
import { z } from "zod";
import { codeVersion, verifyPurposeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10),
  next: z.string().trim().min(8, "Il nuovo codice deve avere almeno 8 caratteri").max(64)
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
    }

    const payload = await verifyPurposeToken("reset", parsed.data.token);
    const invalid = NextResponse.json({ error: "Il link è scaduto o è già stato usato." }, { status: 400 });
    if (!payload) return invalid;

    const user = await db.user.findUnique({ where: { id: payload.uid } });
    if (!user || !user.active || user.deletedAt) return invalid;
    // Il link vale finché il codice non cambia: dopo l'uso (o un altro reset) non funziona più.
    if (payload.sv !== codeVersion(user.accessCodeHash)) return invalid;

    if (/^(.)\1+$/.test(parsed.data.next)) {
      return NextResponse.json({ error: "Il codice è troppo semplice" }, { status: 400 });
    }

    await db.user.update({ where: { id: user.id }, data: { accessCodeHash: hashAccessCode(parsed.data.next) } });
    await db.auditLog.create({
      data: { actorId: user.id, action: "CODE_CHANGED", targetType: "USER", targetId: user.id }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Operazione non riuscita" }, { status: 400 });
  }
}
