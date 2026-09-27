import { COOKIE_NAME, PLAYER_COOKIE, cookieOptions, handle, identity, newToken, ok, readBody, uuid } from "@/lib/api.server";
import { loadSession, snapshot, startGameSession } from "@/lib/game-session.server";
import { ApiError } from "@/lib/api-error";

export async function GET() {
  return handle(async () => { const { token, player } = await identity(); return ok(snapshot(await loadSession(token, player))); });
}
export async function POST(request: Request) {
  return handle(async () => {
    const caseId = uuid((await readBody(request)).caseId, "caseId");
    const existing = await identity(false);
    const player = existing.player || newToken();
    if (existing.token && existing.player) {
      try {
        const record = await loadSession(existing.token, existing.player);
        if (record.caseId === caseId) return ok(snapshot(record), "Прохождение восстановлено");
      } catch (error) { if (!(error instanceof ApiError) || error.code !== "SESSION_NOT_FOUND") throw error; }
    }
    const result = await startGameSession(caseId, player);
    const response = ok(result.session, "Расследование начато", 201);
    response.cookies.set(COOKIE_NAME, result.token, cookieOptions);
    response.cookies.set(PLAYER_COOKIE, player, cookieOptions);
    response.cookies.set("decisionlab_previous_case", result.bundle.case.title, cookieOptions);
    return response;
  });
}
