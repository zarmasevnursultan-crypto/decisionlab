import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, submitVerdict } from "@/lib/game-session.server";

export async function POST(request: Request) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "session_unavailable" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const suspectId = body && typeof body === "object" && "suspect_id" in body && typeof body.suspect_id === "string" ? body.suspect_id : "";
  if (!suspectId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await submitVerdict(token, suspectId);
  if (!result) return NextResponse.json({ error: "attempt_unavailable" }, { status: 400 });
  return NextResponse.json({ correct: result.correct });
}
