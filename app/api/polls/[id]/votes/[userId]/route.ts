import { NextResponse } from "next/server";
import { BallotVisibility, PollStatus } from "@prisma/client";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Un rappresentante d'istituto rimuove il voto palese di un utente: l'utente risulta di nuovo
 * "non votato" e può votare ancora. Non vale per il voto segreto, dove la scheda non è
 * collegata alla persona e quindi non si può togliere senza falsare il conteggio.
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const representative = await requireInstituteRep();
    const { id, userId } = await context.params;

    const poll = await db.poll.findUnique({ where: { id } });
    if (!poll) return NextResponse.json({ error: "Votazione non trovata" }, { status: 404 });

    if (poll.visibility !== BallotVisibility.NAMED) {
      return NextResponse.json(
        { error: "Un voto segreto non può essere rimosso per singola persona." },
        { status: 400 }
      );
    }

    if (poll.status !== PollStatus.OPEN) {
      return NextResponse.json(
        { error: "Si può rimuovere un voto solo mentre la votazione è aperta." },
        { status: 400 }
      );
    }

    const vote = await db.namedVote.findUnique({
      where: { pollId_userId: { pollId: id, userId } }
    });
    if (!vote) return NextResponse.json({ error: "Voto non trovato" }, { status: 404 });

    await db.$transaction([
      db.namedVote.delete({ where: { id: vote.id } }),
      db.auditLog.create({
        data: {
          actorId: representative.id,
          action: "VOTE_REMOVED",
          targetType: "POLL",
          targetId: id,
          metadata: { userId, optionId: vote.optionId }
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const forbidden = msg === "FORBIDDEN" || msg === "UNAUTHORIZED";
    return NextResponse.json(
      { error: forbidden ? "Non autorizzato" : "Operazione non riuscita" },
      { status: forbidden ? 403 : 400 }
    );
  }
}
