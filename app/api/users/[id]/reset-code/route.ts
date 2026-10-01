import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, randomAccessCode } from "@/lib/security";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    if (actor.role !== Role.ADMIN && target.role === Role.ADMIN) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const accessCode = randomAccessCode();

    await db.user.update({
      where: { id },
      data: { accessCodeHash: hashAccessCode(accessCode) }
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "RESET_ACCESS_CODE",
        targetType: "USER",
        targetId: id
      }
    });

    return NextResponse.json({ accessCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Non autorizzato" : "Operazione non riuscita" },
      { status: message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
