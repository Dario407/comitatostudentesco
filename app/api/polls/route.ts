import { NextResponse } from "next/server";
import { BallotVisibility, PollMode, PollStatus } from "@prisma/client";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(1200).optional().nullable(),
  mode: z.nativeEnum(PollMode),
  visibility: z.nativeEnum(BallotVisibility),
  status: z.nativeEnum(PollStatus),
  meetingId: z.string().optional().nullable(),
  options: z.array(z.string().min(1).max(200)).min(2).max(20)
});

export async function POST(req: Request) {
  try {
    const representative = await requireInstituteRep();
    const data = schema.parse(await req.json());

    if (data.mode === PollMode.IN_PERSON && !data.meetingId) {
      return NextResponse.json(
        { error: "Il voto in presenza richiede una seduta" },
        { status: 400 }
      );
    }

    const poll = await db.poll.create({
      data: {
        title: data.title,
        description: data.description || null,
        mode: data.mode,
        visibility: data.visibility,
        status: data.status,
        meetingId:
          data.mode === PollMode.IN_PERSON ? data.meetingId : null,
        createdById: representative.id,
        options: {
          create: data.options.map((label, position) => ({
            label,
            position
          }))
        }
      },
      include: { options: true }
    });

    await db.auditLog.create({
      data: {
        actorId: representative.id,
        action: "CREATE_POLL",
        targetType: "POLL",
        targetId: poll.id
      }
    });

    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "FORBIDDEN" ? "Non autorizzato" : "Dati non validi" },
      { status: msg === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
