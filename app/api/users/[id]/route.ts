import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  active: z.boolean().optional(),
  role: z.enum([Role.CLASS_REP, Role.INSTITUTE_REP]).optional()
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireInstituteRep();
    const { id } = await context.params;
    const data = schema.parse(await req.json());

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    if (actor.id === target.id && data.active === false) {
      return NextResponse.json(
        { error: "Non puoi disattivare il tuo stesso account." },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        className: true,
        role: true,
        active: true
      }
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "UPDATE_USER",
        targetType: "USER",
        targetId: id,
        metadata: data
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          message === "FORBIDDEN"
            ? "Non autorizzato"
            : "Operazione non riuscita"
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
