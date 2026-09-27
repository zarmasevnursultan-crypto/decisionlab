import { NextResponse } from "next/server";
import { COOKIE_NAME, sessionCookieOptions, startGameSession } from "@/lib/game-session.server";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const caseId = body && typeof body === "object" && "caseId" in body && typeof body.caseId === "string" ? body.caseId : "";
  if (!caseId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const session = await startGameSession(caseId);
  if (!session) return NextResponse.json({ error: "session_unavailable" }, { status: 503 });
  const response = NextResponse.json({ startedAt: session.startedAt });
  response.cookies.set(COOKIE_NAME, session.token, sessionCookieOptions());
  return response;
}
