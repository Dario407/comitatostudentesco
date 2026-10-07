import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, randomAccessCode } from "@/lib/security";
import { canApprove, openRequestFor } from "@/lib/resetRequests";

export const runtime = "nodejs";

/**
 * Il compagno di classe (o un rappresentante d'istituto) approva la richiesta di nuovo codice:
 * viene generato un codice provvisorio da consegnare di persona. Chi lo riceve dovrà cambiarlo al primo accesso.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireUser();
    const { id } = await context.params;

    const target = await db.user.findUnique({ where: { id } });
    if (!target || !target.active || target.deletedAt) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    if (!canApprove(actor, target)) {
      return NextResponse.json({ error: "Non puoi approvare questa richiesta" }, { status: 403 });
    }

    if (!(await openRequestFor(id))) {
      return NextResponse.json({ error: "Nessuna richiesta aperta (dura 24 ore)." }, { status: 404 });
    }

    const accessCode = randomAccessCode();
    await db.user.update({ where: { id }, data: { accessCodeHash: hashAccessCode(accessCode) } });
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CODE_ISSUED",
        targetType: "USER",
        targetId: id,
        metadata: { via: "peer-approval" }
      }
    });

    return NextResponse.json({ accessCode, name: target.firstName + " " + target.lastName });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Accesso richiesto" : "Operazione non riuscita" },
      { status: msg === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
