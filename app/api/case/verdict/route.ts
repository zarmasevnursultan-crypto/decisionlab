import { handle, identity, ok, readBody, uuid } from "@/lib/api.server";
import { updateSession } from "@/lib/game-session.server";

export async function POST(request: Request) {
  return handle(async () => {
    const { token, player } = await identity();
    const body = await readBody(request);
    const result = await updateSession(token, player, { type: "verdict", id: uuid(body.suspect_id, "suspect_id") });
    return ok({ correct: result.correct, session: result.session }, result.correct ? "Дело раскрыто" : "Вердикт не подтверждён. Изучите другие версии.");
  });
}
