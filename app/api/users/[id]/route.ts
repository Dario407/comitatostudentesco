import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  active: z.boolean().optional(),
  role: z.nativeEnum(Role).optional()
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;
    const data = schema.parse(await req.json());

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    if (
      actor.role !== Role.ADMIN &&
      (target.role === Role.ADMIN || data.role === Role.ADMIN)
    ) {
      return NextResponse.json(
        { error: "Solo un amministratore tecnico può modificare un amministratore." },
        { status: 403 }
      );
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
