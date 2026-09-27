import { COOKIE_NAME, PLAYER_COOKIE, cookieOptions, handle, identity, ok, readBody, uuid } from "@/lib/api.server";
import { loadSession, snapshot, startGameSession, updateSession } from "@/lib/game-session.server";

export async function POST(request: Request) {
  return handle(async () => {
    const { token, player } = await identity();
    const body = await readBody(request);
    const previous = await loadSession(token, player);
    const caseId = body.caseId === undefined ? previous.caseId : uuid(body.caseId, "caseId");
    const result = await startGameSession(caseId, player);
    if (snapshot(previous).status === "active") await updateSession(token, player, { type: "abandon" });
    const response = ok({ bundle: result.bundle, session: result.session }, "Начато новое прохождение того же дела", 201);
    response.cookies.set(COOKIE_NAME, result.token, cookieOptions);
    response.cookies.set(PLAYER_COOKIE, player, cookieOptions);
    return response;
  });
}
