import { handle, ok } from "@/lib/api.server";
import { databaseConfigured } from "@/lib/game-session.server";
import { createServerSupabaseClient } from "@/lib/supabase.server";
import type { HealthStatus } from "@/lib/case-types";

export async function GET() {
  return handle(async () => {
    let database: HealthStatus["services"]["database"] = "not_configured";
    if (databaseConfigured()) {
      try {
        const { error } = await createServerSupabaseClient().from("sessions").select("revision").limit(1).abortSignal(AbortSignal.timeout(5000));
        database = error ? "unavailable" : "ok";
        if (error) console.error("[health-database]", error.message);
      } catch { database = "unavailable"; }
    }
    const result: HealthStatus = { status: database === "unavailable" ? "degraded" : "ok", services: { application: "ok", database, ai: process.env.OPENROUTER_API_KEY ? "configured_not_checked" : "not_configured" }, checkedAt: new Date().toISOString() };
    return ok(result, "Проверка ИИ выполняется при генерации; health не расходует токены модели.");
  });
}
