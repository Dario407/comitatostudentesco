import { NextResponse } from "next/server";
import { PollStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  status: z.nativeEnum(PollStatus)
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const { status } = schema.parse(await req.json());

    const poll = await db.poll.update({
      where: { id },
      data: { status }
    });

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `POLL_${status}`,
        targetType: "POLL",
        targetId: id
      }
    });

    return NextResponse.json(poll);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "FORBIDDEN" ? "Non autorizzato" : "Operazione non riuscita" },
      { status: msg === "FORBIDDEN" ? 403 : 400 }
    );
  }
}
