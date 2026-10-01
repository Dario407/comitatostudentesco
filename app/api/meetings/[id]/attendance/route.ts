import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  userId: z.string().min(1),
  present: z.boolean()
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id: meetingId } = await context.params;
    const data = schema.parse(await req.json());

    const [meeting, user] = await Promise.all([
      db.meeting.findUnique({ where: { id: meetingId } }),
      db.user.findUnique({ where: { id: data.userId } })
    ]);

    if (!meeting || !user?.active) {
      return NextResponse.json(
        { error: "Seduta o utente non valido" },
        { status: 404 }
      );
    }

    const attendance = await db.attendance.upsert({
      where: {
        meetingId_userId: {
          meetingId,
          userId: data.userId
        }
      },
      create: {
        meetingId,
        userId: data.userId,
        present: data.present,
        checkedById: admin.id
      },
      update: {
        present: data.present,
        checkedById: admin.id,
        checkedAt: new Date()
      }
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: data.present ? "MARK_PRESENT" : "MARK_ABSENT",
        targetType: "ATTENDANCE",
        targetId: `${meetingId}:${data.userId}`
      }
    });

    return NextResponse.json(attendance);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "FORBIDDEN" ? "Non autorizzato" : "Richiesta non valida" },
      { status: msg === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
