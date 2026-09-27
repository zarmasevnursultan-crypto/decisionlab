import { loadCase } from "@/lib/get-case.server";
import CaseClient from "./case-client";
import { cookies } from "next/headers";
import { databaseConfigured, loadSession, snapshot } from "@/lib/game-session.server";
import { publicCase } from "@/lib/public-case";
import { ApiError } from "@/lib/api-error";

export default async function Case001Page() {
  const jar = await cookies();
  if (process.env.VERCEL && !databaseConfigured()) {
    return <main className="min-h-screen bg-[#07090d] p-8 text-white"><h1 className="text-2xl font-bold">DecisionLab готовится к запуску</h1><p className="mt-4 text-gray-400">Хранилище расследований ещё не подключено. Администратору сайта необходимо завершить настройку базы данных.</p></main>;
  }
  const token = jar.get("decisionlab_session")?.value;
  const player = jar.get("decisionlab_player")?.value;
  let restored: Awaited<ReturnType<typeof loadSession>> | null = null;
  if (token && player) {
    try {
      restored = await loadSession(token, player);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "SESSION_NOT_FOUND") {
        console.error("[page-session]", error);
        throw error;
      }
    }
  }
  if (restored) return <CaseClient key={restored.id} caseBundle={publicCase(restored.privateCase.bundle)} initialSession={snapshot(restored)} />;
  const previousTitle = jar.get("decisionlab_previous_case")?.value ?? "";
  const caseBundle = await loadCase(previousTitle);
  return <CaseClient key={caseBundle.case.id} caseBundle={caseBundle} />;
}
