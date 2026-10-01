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

    const meeting = await db.meeting.findUnique({
      where: { id },
      include: {
        _count: {
          select: { polls: true }
        }
      }
    });

    if (!meeting) {
      return NextResponse.json({ error: "Seduta non trovata" }, { status: 404 });
    }

    if (meeting._count.polls > 0) {
      return NextResponse.json(
        {
          error:
            "La seduta ha votazioni collegate. Elimina prima le votazioni collegate."
        },
        { status: 409 }
      );
    }

    await db.$transaction([
      db.meeting.delete({ where: { id } }),
      db.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE_MEETING",
          targetType: "MEETING",
          targetId: id,
          metadata: {
            title: meeting.title,
            startsAt: meeting.startsAt.toISOString()
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
            : "Impossibile eliminare la seduta"
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
