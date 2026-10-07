import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, verifyPurposeToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailCodeHash } from "@/lib/contact";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10), code: z.string().trim().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Inserisci il codice a 6 cifre" }, { status: 400 });

    const payload = await verifyPurposeToken("email-confirm", parsed.data.token);
    if (!payload || payload.uid !== user.id) {
      return NextResponse.json({ error: "Codice scaduto: richiedine uno nuovo." }, { status: 400 });
    }

    const expected = Buffer.from(payload.ch, "hex");
    const actual = Buffer.from(emailCodeHash(user.id, payload.email, parsed.data.code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return NextResponse.json({ error: "Codice non corretto" }, { status: 400 });
    }

    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "EMAIL_SET",
        targetType: "USER",
        targetId: user.id,
        metadata: { email: payload.email }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Accesso richiesto" : "Operazione non riuscita" },
      { status: msg === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
