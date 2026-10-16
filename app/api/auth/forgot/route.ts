import { NextResponse } from "next/server";
import { z } from "zod";
import { signPurposeToken, codeVersion } from "@/lib/auth";
import { db } from "@/lib/db";
import { phoneLookup } from "@/lib/security";
import { clientIp } from "@/lib/rateLimit";
import { recoveryAllowed } from "@/lib/recoveryLimit";
import { appUrl, mailEnabled, sendMail } from "@/lib/mail";
import { findUserByRecoveryEmail, getRecoveryEmail } from "@/lib/contact";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().trim().min(5).max(120),
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
    const rawIdentifier = data.phone.trim();
    let active: {
      id: string;
      firstName: string;
      accessCodeHash: string;
      active: boolean;
      deletedAt: Date | null;
    } | null = null;

    if (rawIdentifier.includes("@")) {
      active = await findUserByRecoveryEmail(rawIdentifier);
    } else {
      let lookup: string | null = null;
      try {
        lookup = phoneLookup(rawIdentifier);
      } catch {
        return NextResponse.json(REPLY);
      }

      const user = await db.user.findUnique({ where: { phoneLookup: lookup } });
      active = user && user.active && !user.deletedAt ? user : null;
    }

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
        const resetUrl = `${appUrl()}/reset-codice?t=${token}`;
        await sendMail(
          email,
          "Recupero del codice - Comitato Studentesco",
          "Ciao " + active.firstName + ",\n\nper scegliere un nuovo codice di accesso apri questo link (vale 30 minuti e funziona una volta sola):\n\n" +
            resetUrl + "\n\nSe non l'hai chiesto tu, ignora questo messaggio: il tuo codice attuale resta valido.",
          {
            badge: "Recupero Codice",
            title: "Reimposta il tuo codice di accesso",
            greeting: `Ciao ${active.firstName},`,
            bodyLines: [
              "Abbiamo ricevuto una richiesta per reimpostare il codice di accesso del tuo account sul portale del Comitato Studentesco.",
              "Clicca sul pulsante qui sotto per scegliere subito un nuovo codice personale (il link è valido per 30 minuti e può essere usato una sola volta):"
            ],
            ctaLabel: "Scegli nuovo codice",
            ctaUrl: resetUrl,
            footerNote: "Se non hai richiesto tu il recupero, ignora questo messaggio: il tuo codice attuale rimarrà invariato."
          }
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
