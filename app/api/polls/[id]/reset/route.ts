import { NextResponse } from "next/server";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Azzera tutti i voti e le partecipazioni di una votazione, così si può rivotare da capo. */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireInstituteRep();
    const { id } = await context.params;

    const poll = await db.poll.findUnique({ where: { id }, select: { id: true } });
    if (!poll) return NextResponse.json({ error: "Votazione non trovata" }, { status: 404 });

    const [named, participation, secret] = await db.$transaction([
      db.namedVote.deleteMany({ where: { pollId: id } }),
      db.secretParticipation.deleteMany({ where: { pollId: id } }),
      db.secretBallot.deleteMany({ where: { pollId: id } }),
      db.auditLog.create({
        data: {
          actorId: actor.id,
          action: "POLL_RESET",
          targetType: "POLL",
          targetId: id
        }
      })
    ]);

    return NextResponse.json({
      ok: true,
      removed: named.count + participation.count + secret.count
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const forbidden = msg === "FORBIDDEN" || msg === "UNAUTHORIZED";
    return NextResponse.json(
      { error: forbidden ? "Non autorizzato" : "Operazione non riuscita" },
      { status: forbidden ? 403 : 400 }
    );
  }
}
