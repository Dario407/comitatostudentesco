import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, phoneLookup, randomAccessCode } from "@/lib/security";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(30),
  phone: z.string().trim().min(8).max(30),
  role: z.nativeEnum(Role).default(Role.CLASS_REP),
  accessCode: z.string().trim().min(6).max(64).optional()
});

export async function POST(req: Request) {
  try {
    const actor = await requireAdmin();
    const data = schema.parse(await req.json());

    if (actor.role !== Role.ADMIN && data.role === Role.ADMIN) {
      return NextResponse.json(
        { error: "Solo un amministratore tecnico può creare altri amministratori." },
        { status: 403 }
      );
    }

    const accessCode = data.accessCode || randomAccessCode();
    const lookup = phoneLookup(data.phone);

    const exists = await db.user.findUnique({ where: { phoneLookup: lookup } });
    if (exists) {
      return NextResponse.json(
        { error: "Esiste già un account associato a questo numero." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        className: data.className,
        role: data.role,
        phoneLookup: lookup,
        accessCodeHash: hashAccessCode(accessCode)
      },
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
        action: "CREATE_USER",
        targetType: "USER",
        targetId: user.id,
        metadata: { role: user.role, className: user.className }
      }
    });

    return NextResponse.json({ user, accessCode }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
    }
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }
}
