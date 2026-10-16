import { NextResponse } from "next/server";
import { createSessionToken, requireInstituteRep, sessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, randomAccessCode } from "@/lib/security";
import { getRecoveryEmail } from "@/lib/contact";
import { appUrl, mailEnabled, sendMail } from "@/lib/mail";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireInstituteRep();
    const { id } = await context.params;

    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    const accessCode = randomAccessCode();

    // Cambiare il codice chiude tutte le sessioni aperte di quell'utente.
    const updated = await db.user.update({
      where: { id },
      data: { accessCodeHash: hashAccessCode(accessCode) }
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "RESET_ACCESS_CODE",
        targetType: "USER",
        targetId: id
      }
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        // Chi rigenera il proprio codice lo conosce già: non va costretto a cambiarlo di nuovo.
        action: actor.id === id ? "CODE_CHANGED" : "CODE_ISSUED",
        targetType: "USER",
        targetId: id
      }
    });

    let emailed = false;
    if (actor.id !== id && mailEnabled()) {
      const targetEmail = await getRecoveryEmail(id);
      if (targetEmail) {
        try {
          const loginUrl = `${appUrl()}/login`;
          await sendMail(
            targetEmail,
            "Nuovo codice provvisorio - Comitato Studentesco",
            `Ciao ${target.firstName},\n\nun rappresentante d'istituto ha generato per te un nuovo codice di accesso provvisorio:\n\n${accessCode}\n\nAccedi su ${loginUrl} e scegli subito un nuovo codice personale.`,
            {
              badge: "Codice Rigenerato",
              title: "Il tuo nuovo codice provvisorio",
              greeting: `Ciao ${target.firstName},`,
              bodyLines: [
                "Un rappresentante d'istituto ha rigenerato il codice di accesso del tuo account sul portale del Comitato Studentesco.",
                "Usa questo codice provvisorio per entrare:"
              ],
              highlightCode: accessCode,
              ctaLabel: "Accedi e cambia codice",
              ctaUrl: loginUrl,
              footerNote: "Al primo accesso ti verrà chiesto di scegliere un nuovo codice personale."
            }
          );
          emailed = true;
        } catch (mailError) {
          console.error("Invio email nuovo codice provvisorio non riuscito", mailError);
        }
      }
    }

    const res = NextResponse.json({ accessCode, emailed });

    // Se l'admin rigenera il proprio codice resta collegato: la sua sessione viene riemessa.
    if (updated.id === actor.id) {
      res.cookies.set(sessionCookie.name, await createSessionToken(updated), sessionCookie.options);
    }

    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Non autorizzato" : "Operazione non riuscita" },
      { status: message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
