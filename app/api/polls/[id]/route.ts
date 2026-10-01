import { NextResponse } from "next/server";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireInstituteRep();
    const { id } = await context.params;

    const poll = await db.poll.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        mode: true,
        visibility: true,
        status: true
      }
    });

    if (!poll) {
      return NextResponse.json({ error: "Votazione non trovata" }, { status: 404 });
    }

    await db.$transaction([
      db.poll.delete({ where: { id } }),
      db.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE_POLL",
          targetType: "POLL",
          targetId: id,
          metadata: {
            title: poll.title,
            mode: poll.mode,
            visibility: poll.visibility,
            status: poll.status
          }
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    return NextResponse.json(
      {
        error:
          message === "FORBIDDEN"
            ? "Non autorizzato"
            : "Impossibile eliminare la votazione"
      },
      {
        status:
          message === "FORBIDDEN"
            ? 403
            : message === "UNAUTHORIZED"
              ? 401
              : 400
      }
    );
  }
}
