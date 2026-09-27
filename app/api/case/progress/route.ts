import { handle, identity, ok } from "@/lib/api.server";
import { loadSession, snapshot } from "@/lib/game-session.server";

export async function GET() {
  return handle(async () => { const { token, player } = await identity(); return ok(snapshot(await loadSession(token, player)).progress); });
}
