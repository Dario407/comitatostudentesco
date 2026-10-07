import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, signPurposeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailEnabled, sendMail } from "@/lib/mail";
import { emailCodeHash } from "@/lib/contact";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(120) });

/** Primo passo: manda un codice a 6 cifre all'indirizzo indicato. L'email si salva solo dopo la conferma. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!mailEnabled()) {
      return NextResponse.json({ error: "L'invio delle email non è ancora attivo." }, { status: 503 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Indirizzo email non valido" }, { status: 400 });
    const { email } = parsed.data;

    const recent = await db.auditLog.count({
      where: {
        actorId: user.id,
        action: "EMAIL_CODE_SENT",
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    });
    if (recent >= 5) {
      return NextResponse.json({ error: "Troppi tentativi. Riprova tra un'ora." }, { status: 429 });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await sendMail(
      email,
      "Codice di conferma - Comitato Studentesco",
      "Il tuo codice di conferma è " + code + ".\n\nVale 15 minuti. Se non l'hai chiesto tu, ignora questo messaggio."
    );

    await db.auditLog.create({
      data: { actorId: user.id, action: "EMAIL_CODE_SENT", targetType: "USER", targetId: user.id }
    });

    const token = await signPurposeToken(
      "email-confirm",
      { uid: user.id, email, ch: emailCodeHash(user.id, email, code) },
      "15m"
    );
    return NextResponse.json({ token });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
    console.error("Invio codice email non riuscito", error);
    return NextResponse.json({ error: "Non sono riuscito a inviare l'email. Controlla l'indirizzo." }, { status: 500 });
  }
}
