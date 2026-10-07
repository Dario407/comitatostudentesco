import { NextResponse } from "next/server";
import { revokeCurrentSession, sessionCookie } from "@/lib/auth";

export async function POST() {
  // Prima si revoca il token lato server, poi si cancella il cookie.
  await revokeCurrentSession().catch((error) => {
    console.error("Revoca sessione non riuscita", error);
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie.name, "", {
    ...sessionCookie.options,
    maxAge: 0
  });
  return res;
}
