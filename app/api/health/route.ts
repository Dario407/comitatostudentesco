import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    sessionSecret: Boolean(process.env.SESSION_SECRET),
    phoneLookupSecret: Boolean(process.env.PHONE_LOOKUP_SECRET)
  };

  if (!config.databaseUrl || !config.sessionSecret || !config.phoneLookupSecret) {
    return NextResponse.json(
      { ok: false, config, database: false },
      { status: 503 }
    );
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      config,
      database: true
    });
  } catch {
    return NextResponse.json(
      { ok: false, config, database: false },
      { status: 503 }
    );
  }
}
