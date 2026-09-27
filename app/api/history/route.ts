import { handle, identity, ok } from "@/lib/api.server";
import { getHistory } from "@/lib/game-session.server";
export async function GET() { return handle(async () => ok(await getHistory((await identity(false)).player))); }
