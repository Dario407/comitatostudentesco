import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  title: z.string().min(3).max(140),
  startsAt: z.string().datetime()
});

export async function POST(req: Request) {
  try {
    const representative = await requireInstituteRep();
    const data = schema.parse(await req.json());

    const meeting = await db.meeting.create({
      data: {
        title: data.title,
        startsAt: new Date(data.startsAt),
        createdById: representative.id
      }
    });

    await db.auditLog.create({
      data: {
        actorId: representative.id,
        action: "CREATE_MEETING",
        targetType: "MEETING",
        targetId: meeting.id
      }
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "FORBIDDEN" ? "Non autorizzato" : "Dati non validi" },
      { status: msg === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
