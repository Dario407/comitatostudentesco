import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { signPurposeToken, codeVersion } from "@/lib/auth";
import { db } from "@/lib/db";
import { phoneLookup } from "@/lib/security";
import { clientIp } from "@/lib/rateLimit";
import { recoveryAllowed } from "@/lib/recoveryLimit";
import { mailEnabled, sendMail } from "@/lib/mail";
import { emailCodeHash, findUserByRecoveryEmail, getRecoveryEmail } from "@/lib/contact";

export const runtime = "nodejs";

const schema = z.object({
  identifier: z.string().trim().min(5).max(120)
});

export async function POST(req: Request) {
  if (!mailEnabled()) {
    return NextResponse.json(
      { error: "L'invio delle email non è attivo su questo server." },
      { status: 503 }
    );
  }

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Inserisci il tuo numero o indirizzo email" }, { status: 400 });
  }

  // Risposta uniforme con un token fittizio se l'utente non esiste o non ha un'email,
  // così non è possibile scoprire quali numeri o email sono registrati.
  const dummyToken = await signPurposeToken(
    "email-login-otp",
    { uid: "none", email: "none", ch: "00".repeat(32), sv: "0", jti: randomUUID() },
    "10m"
  );

  try {
    const raw = data.identifier.trim();
    let active: {
      id: string;
      firstName: string;
      accessCodeHash: string;
      active: boolean;
      deletedAt: Date | null;
    } | null = null;

    if (raw.includes("@")) {
      active = await findUserByRecoveryEmail(raw);
    } else {
      let lookup: string | null = null;
      try {
        lookup = phoneLookup(raw);
      } catch {
        return NextResponse.json({ token: dummyToken });
      }
      const user = await db.user.findUnique({ where: { phoneLookup: lookup } });
      active = user && user.active && !user.deletedAt ? user : null;
    }

    const allowed = await recoveryAllowed(clientIp(req), active?.id ?? null);
    if (!active || !allowed) {
      return NextResponse.json({ token: dummyToken });
    }

    const email = await getRecoveryEmail(active.id);
    if (!email) {
      return NextResponse.json({ token: dummyToken });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const jti = randomUUID();

    await sendMail(
      email,
      "Codice di accesso monouso - Comitato Studentesco",
      `Ciao ${active.firstName},\n\nil tuo codice di accesso monouso è ${code}.\n\nVale 10 minuti. Se non hai richiesto tu l'accesso, ignora questo messaggio.`,
      {
        badge: "Accesso Rapido OTP",
        title: "Il tuo codice di accesso monouso",
        greeting: `Ciao ${active.firstName},`,
        bodyLines: [
          "Hai richiesto di accedere al portale del Comitato Studentesco tramite codice monouso via email.",
          "Inserisci questo codice a 6 cifre nella schermata di accesso:"
        ],
        highlightCode: code,
        footerNote: "Il codice è valido per 10 minuti e funziona una sola volta. Se non hai richiesto tu l'accesso, ignora questo messaggio."
      }
    );

    await db.auditLog.create({
      data: {
        actorId: active.id,
        action: "EMAIL_OTP_SENT",
        targetType: "USER",
        targetId: active.id
      }
    });

    const token = await signPurposeToken(
      "email-login-otp",
      {
        uid: active.id,
        email,
        ch: emailCodeHash(active.id, email, code),
        sv: codeVersion(active.accessCodeHash),
        jti
      },
      "10m"
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Invio OTP email non riuscito", error);
    return NextResponse.json({ token: dummyToken });
  }
}
