import { handle, identity, ok, readBody, uuid } from "@/lib/api.server";
import { updateSession } from "@/lib/game-session.server";

export async function POST(request: Request) {
  return handle(async () => {
    const { token, player } = await identity();
    const result = await updateSession(token, player, { type: "evidence", id: uuid((await readBody(request)).evidenceId, "evidenceId") });
    return ok(result.session, "Материал изучен");
  });
}
