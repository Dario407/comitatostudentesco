import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { BallotVisibility } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canVote } from "@/lib/polls";
import { db } from "@/lib/db";
import { votingDay } from "@/lib/secretBallots";

const schema = z.object({
  optionId: z.string().min(1)
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: pollId } = await context.params;
    const { optionId } = schema.parse(await req.json());

    const eligibility = await canVote(user.id, pollId);

    if (!eligibility.ok || !eligibility.poll) {
      return NextResponse.json(
        { error: eligibility.reason ?? "Voto non consentito" },
        { status: 403 }
      );
    }

    if (!eligibility.poll.options.some((option) => option.id === optionId)) {
      return NextResponse.json({ error: "Opzione non valida" }, { status: 400 });
    }

    if (eligibility.poll.visibility === BallotVisibility.NAMED) {
      await db.$transaction([
        db.namedVote.create({
          data: {
            pollId,
            userId: user.id,
            optionId
          }
        }),
        db.auditLog.create({
          data: {
            actorId: user.id,
            action: "VOTE_NAMED",
            targetType: "POLL",
            targetId: pollId
          }
        })
      ]);
    } else {
      // Voto segreto: nulla deve permettere di abbinare la persona alla scheda.
      // - la scheda ha un id casuale (non ordinabile nel tempo) e nessun orario;
      // - la partecipazione registra solo il giorno, non l'ora;
      // - non si scrive una riga di audit per voto: ne rivelerebbe l'ordine esatto.
      await db.$transaction([
        db.secretParticipation.create({
          data: {
            pollId,
            userId: user.id,
            votedAt: votingDay()
          }
        }),
        db.secretBallot.create({
          data: {
            id: randomUUID(),
            pollId,
            optionId
          }
        })
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Impossibile registrare il voto" },
      { status: 400 }
    );
  }
}
