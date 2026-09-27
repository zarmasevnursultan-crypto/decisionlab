import { handle, identity, ok } from "@/lib/api.server";
import { getHistory, statistics } from "@/lib/game-session.server";
export async function GET() { return handle(async () => ok(statistics(await getHistory((await identity(false)).player)))); }
