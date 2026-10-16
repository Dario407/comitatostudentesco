import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, phoneLookup, randomAccessCode } from "@/lib/security";
import { findUserByRecoveryEmail, maskEmail } from "@/lib/contact";
import { appUrl, mailEnabled, sendMail } from "@/lib/mail";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(30),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().toLowerCase().email().max(120).optional().or(z.literal("")),
  role: z.enum([Role.CLASS_REP, Role.INSTITUTE_REP]).default(Role.CLASS_REP),
  accessCode: z.string().trim().min(6).max(64).optional()
});

export async function POST(req: Request) {
  try {
    const actor = await requireInstituteRep();
    const data = schema.parse(await req.json());

    const accessCode = data.accessCode || randomAccessCode();
    const lookup = phoneLookup(data.phone);
    const cleanEmail = data.email ? data.email.trim().toLowerCase() : null;

    const exists = await db.user.findUnique({ where: { phoneLookup: lookup } });
    if (exists) {
      return NextResponse.json(
        { error: "Esiste già un account associato a questo numero." },
        { status: 409 }
      );
    }

    if (cleanEmail) {
      const emailOwner = await findUserByRecoveryEmail(cleanEmail);
      if (emailOwner) {
        return NextResponse.json(
          { error: "Questo indirizzo email è già associato a un altro account attivo." },
          { status: 409 }
        );
      }
    }

    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        className: data.className,
        role: data.role,
        phoneLookup: lookup,
        accessCodeHash: hashAccessCode(accessCode)
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        className: true,
        role: true,
        active: true
      }
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CREATE_USER",
        targetType: "USER",
        targetId: user.id,
        metadata: { role: user.role, className: user.className }
      }
    });

    await db.auditLog.create({
      data: { actorId: actor.id, action: "CODE_ISSUED", targetType: "USER", targetId: user.id }
    });

    let emailed = false;
    if (cleanEmail) {
      await db.auditLog.create({
        data: {
          actorId: actor.id,
          action: "EMAIL_SET",
          targetType: "USER",
          targetId: user.id,
          metadata: { email: cleanEmail }
        }
      });

      if (mailEnabled()) {
        try {
          const loginUrl = `${appUrl()}/login`;
          await sendMail(
            cleanEmail,
            "Benvenuto nel portale - Comitato Studentesco",
            `Ciao ${user.firstName},\n\nil tuo account da rappresentante (${user.className}) è stato attivato.\nIl tuo codice di accesso provvisorio è: ${accessCode}\n\nAccedi su ${loginUrl} usando il tuo numero di cellulare o questa email. Al primo accesso ti verrà chiesto di scegliere un codice personale.`,
            {
              badge: "Nuovo Account",
              title: "Il tuo account è attivo",
              greeting: `Ciao ${user.firstName},`,
              bodyLines: [
                `I rappresentanti d'istituto hanno attivato il tuo profilo per la classe ${user.className} sul portale del Comitato Studentesco.`,
                "Puoi entrare usando il tuo numero di telefono (oppure questo indirizzo email) e il seguente codice di accesso provvisorio:"
              ],
              highlightCode: accessCode,
              ctaLabel: "Accedi al portale",
              ctaUrl: loginUrl,
              footerNote: "Al primo accesso il sistema ti chiederà di sostituire il codice provvisorio con uno personale."
            }
          );
          emailed = true;
        } catch (mailError) {
          console.error("Invio email di benvenuto non riuscito", mailError);
        }
      }
    }

    return NextResponse.json(
      {
        user: {
          ...user,
          maskedEmail: cleanEmail ? maskEmail(cleanEmail) : null
        },
        accessCode,
        emailed
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
    }
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }
}
