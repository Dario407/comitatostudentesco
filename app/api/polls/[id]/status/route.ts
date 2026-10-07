import { NextResponse } from "next/server";
import { BallotVisibility, PollStatus } from "@prisma/client";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";
import { reshuffleSecretBallots } from "@/lib/secretBallots";

const schema = z.object({
  status: z.nativeEnum(PollStatus)
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const representative = await requireInstituteRep();
    const { id } = await context.params;
    const { status } = schema.parse(await req.json());

    const poll = await db.poll.update({
      where: { id },
      data: { status }
    });

    await db.auditLog.create({
      data: {
        actorId: representative.id,
        action: `POLL_${status}`,
        targetType: "POLL",
        targetId: id
      }
    });

    // Alla chiusura di un voto segreto le schede vengono rimescolate (vedi lib/secretBallots.ts).
    if (status === PollStatus.CLOSED && poll.visibility === BallotVisibility.SECRET) {
      try {
        await reshuffleSecretBallots(id);
      } catch (error) {
        console.error("Rimescolamento delle schede segrete non riuscito", error);
      }
    }

    return NextResponse.json(poll);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "FORBIDDEN" ? "Non autorizzato" : "Operazione non riuscita" },
      { status: msg === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
