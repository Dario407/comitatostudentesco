import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, phoneLookup, randomAccessCode } from "@/lib/security";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  className: z.string().trim().min(1).max(30).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
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
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    if (
      actor.id === target.id &&
      (data.active === false || data.role === Role.CLASS_REP)
    ) {
      return NextResponse.json(
        { error: "Non puoi disattivare o rimuovere i tuoi permessi di gestione." },
        { status: 400 }
      );
    }

    const updateData: {
      firstName?: string;
      lastName?: string;
      className?: string;
      phoneLookup?: string;
      active?: boolean;
      role?: Role;
    } = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.className !== undefined) updateData.className = data.className;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.role !== undefined) updateData.role = data.role;

    if (data.phone) {
      const lookup = phoneLookup(data.phone);
      const existing = await db.user.findUnique({ where: { phoneLookup: lookup } });

      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Esiste già un account associato a questo numero." },
          { status: 409 }
        );
      }

      updateData.phoneLookup = lookup;
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
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
        metadata: {
          firstNameChanged: data.firstName !== undefined,
          lastNameChanged: data.lastName !== undefined,
          classNameChanged: data.className !== undefined,
          phoneChanged: data.phone !== undefined,
          role: data.role,
          active: data.active
        }
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

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireInstituteRep();
    const { id } = await context.params;

    if (actor.id === id) {
      return NextResponse.json(
        { error: "Non puoi eliminare il tuo stesso account." },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    await db.$transaction([
      db.user.update({
        where: { id },
        data: {
          firstName: "Utente",
          lastName: "eliminato",
          className: "-",
          role: Role.CLASS_REP,
          active: false,
          deletedAt: new Date(),
          phoneLookup: randomBytes(32).toString("hex"),
          accessCodeHash: hashAccessCode(randomAccessCode(32))
        }
      }),
      db.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE_USER",
          targetType: "USER",
          targetId: id,
          metadata: {
            previousRole: target.role,
            previousClassName: target.className
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
            : "Impossibile eliminare l'account"
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
