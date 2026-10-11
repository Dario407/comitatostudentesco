import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInstituteRep } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveQuorumSettings } from "@/lib/pollSettings";

export const runtime = "nodejs";

const schema = z.object({
  percent: z.number().int().min(0).max(100),
  base: z.enum(["MEMBERS", "PRESENT"])
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireInstituteRep();
    const { id } = await context.params;
    const data = schema.parse(await req.json());

    const poll = await db.poll.findUnique({ where: { id }, select: { id: true } });
    if (!poll) return NextResponse.json({ error: "Votazione non trovata" }, { status: 404 });

    await saveQuorumSettings(id, actor.id, data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    const forbidden = msg === "FORBIDDEN" || msg === "UNAUTHORIZED";
    return NextResponse.json(
      { error: forbidden ? "Non autorizzato" : "Percentuale non valida (0-100)" },
      { status: forbidden ? 403 : 400 }
    );
  }
}
