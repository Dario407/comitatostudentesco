import { NextResponse } from "next/server";
import { z } from "zod";
import { signPurposeToken, codeVersion } from "@/lib/auth";
import { db } from "@/lib/db";
import { phoneLookup } from "@/lib/security";
import { clientIp } from "@/lib/rateLimit";
import { recoveryAllowed } from "@/lib/recoveryLimit";
import { appUrl, mailEnabled, sendMail } from "@/lib/mail";
import { getRecoveryEmail } from "@/lib/contact";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().min(8).max(30),
  method: z.enum(["email", "partner"])
});

// La risposta è sempre la stessa: così non si scopre chi è registrato né chi ha un'email.
const REPLY = { ok: true };

export async function POST(req: Request) {
  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    let lookup: string | null = null;
    try {
      lookup = phoneLookup(data.phone);
    } catch {
      return NextResponse.json(REPLY);
    }

    const user = await db.user.findUnique({ where: { phoneLookup: lookup } });
    const active = user && user.active && !user.deletedAt ? user : null;

    const allowed = await recoveryAllowed(clientIp(req), active?.id ?? null);
    if (!active || !allowed) return NextResponse.json(REPLY);

    if (data.method === "email") {
      const email = mailEnabled() ? await getRecoveryEmail(active.id) : null;
      if (email) {
        const token = await signPurposeToken(
          "reset",
          { uid: active.id, sv: codeVersion(active.accessCodeHash) },
          "30m"
        );
        await sendMail(
          email,
          "Recupero del codice - Comitato Studentesco",
          "Ciao " + active.firstName + ",\n\nper scegliere un nuovo codice di accesso apri questo link (vale 30 minuti e funziona una volta sola):\n\n" +
            appUrl() + "/reset-codice?t=" + token + "\n\nSe non l'hai chiesto tu, ignora questo messaggio: il tuo codice attuale resta valido."
        );
        await db.auditLog.create({
          data: { action: "RESET_EMAIL_SENT", targetType: "USER", targetId: active.id }
        });
      }
    } else {
      await db.auditLog.create({
        data: { action: "RESET_REQUEST", targetType: "USER", targetId: active.id }
      });
    }

    return NextResponse.json(REPLY);
  } catch (error) {
    console.error("Richiesta di recupero non riuscita", error);
    return NextResponse.json(REPLY);
  }
}
