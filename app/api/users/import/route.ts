import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAccessCode, phoneLookup, randomAccessCode } from "@/lib/security";

export const runtime = "nodejs";

const row = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(30),
  phone: z.string().trim().min(8).max(30),
  role: z.enum([Role.CLASS_REP, Role.INSTITUTE_REP]).optional(),
  accessCode: z.string().trim().min(6).max(64).optional()
});

const schema = z.object({ rows: z.array(z.unknown()).min(1).max(300) });

type Result = {
  line: number;
  name: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  accessCode?: string;
};

export async function POST(req: Request) {
  try {
    const actor = await requireInstituteRep();
    const { rows } = schema.parse(await req.json());

    const results: Result[] = [];
    const seen = new Set<string>();
    const created: string[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const parsed = row.safeParse(rows[i]);
      const line = i + 1;

      if (!parsed.success) {
        const raw = rows[i] as { firstName?: string; lastName?: string } | null;
        results.push({ line, name: ((raw?.lastName ?? "") + " " + (raw?.firstName ?? "")).trim() || "riga " + line, status: "error", reason: "Dati mancanti o non validi" });
        continue;
      }

      const data = parsed.data;
      const name = data.lastName + " " + data.firstName;

      let lookup: string;
      try {
        lookup = phoneLookup(data.phone);
      } catch {
        results.push({ line, name, status: "error", reason: "Numero di telefono non valido" });
        continue;
      }

      if (seen.has(lookup)) {
        results.push({ line, name, status: "skipped", reason: "Numero ripetuto nel file" });
        continue;
      }
      seen.add(lookup);

      if (await db.user.findUnique({ where: { phoneLookup: lookup }, select: { id: true } })) {
        results.push({ line, name, status: "skipped", reason: "Esiste già un account con questo numero" });
        continue;
      }

      const accessCode = data.accessCode || randomAccessCode();
      const user = await db.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          className: data.className,
          role: data.role ?? Role.CLASS_REP,
          phoneLookup: lookup,
          accessCodeHash: hashAccessCode(accessCode)
        },
        select: { id: true }
      });

      created.push(user.id);
      results.push({ line, name, status: "created", accessCode });
    }

    if (created.length > 0) {
      await db.auditLog.createMany({
        data: [
          { actorId: actor.id, action: "IMPORT_USERS", targetType: "USER", metadata: { created: created.length } },
          ...created.map((id) => ({ actorId: actor.id, action: "CODE_ISSUED", targetType: "USER", targetId: id }))
        ]
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "FORBIDDEN" || msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }
    return NextResponse.json({ error: "File non valido (massimo 300 righe)" }, { status: 400 });
  }
}
