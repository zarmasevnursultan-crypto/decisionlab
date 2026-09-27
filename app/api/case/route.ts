import { handle, identity, ok, uuid } from "@/lib/api.server";
import { loadPrivateCase, loadSession } from "@/lib/game-session.server";
import { publicCase } from "@/lib/public-case";

export async function GET(request: Request) {
  return handle(async () => {
    const id = new URL(request.url).searchParams.get("caseId");
    if (id) return ok(publicCase((await loadPrivateCase(uuid(id, "caseId"))).bundle));
    const { token, player } = await identity();
    return ok(publicCase((await loadSession(token, player)).privateCase.bundle));
  });
}
