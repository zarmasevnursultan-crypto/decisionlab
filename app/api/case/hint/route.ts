import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, recordHint } from "@/lib/game-session.server";

export async function POST() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "session_unavailable" }, { status: 401 });
  const hintsUsed = await recordHint(token);
  if (hintsUsed === null) return NextResponse.json({ error: "session_unavailable" }, { status: 401 });
  return NextResponse.json({ hintsUsed });
}
