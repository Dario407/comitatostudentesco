import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const user = await requireUser();
    await db.auditLog.create({
      data: { actorId: user.id, action: "EMAIL_REMOVED", targetType: "USER", targetId: user.id }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Accesso richiesto" }, { status: 401 });
  }
}
