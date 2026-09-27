import { handle, identity, ok, readBody, uuid } from "@/lib/api.server";
import { updateSession } from "@/lib/game-session.server";

export async function POST(request: Request) {
  return handle(async () => {
    const { token, player } = await identity();
    const evidenceId = uuid((await readBody(request)).evidenceId, "evidenceId");
    const result = await updateSession(token, player, { type: "hint", id: evidenceId });
    return ok({ hint: result.session.hints[evidenceId], session: result.session }, "Подсказка открыта. Повторный запрос не списывает очки.");
  });
}
