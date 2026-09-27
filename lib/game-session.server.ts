import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "./supabase.server";
import { getLocalCase } from "./local-cases.server";
import { changeLocal, readLocal, type PrivateCase, type SessionState, type StoredSession } from "./local-storage.server";
import { publicCase } from "./public-case";
import { ApiError } from "./api-error";
import type { CaseResolution, Evidence, HistoryEntry, SessionSnapshot, Statistics, Suspect } from "./case-types";
import { calculateDisplayScore as calculateScore } from "./score";
export { calculateScore };
import type { Json } from "./database.types";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const databaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const unavailable = (error: unknown): never => {
  console.error("[session-database]", error);
  throw new ApiError("DATABASE_UNAVAILABLE", "База недоступна или не обновлена. Примените миграции и повторите запрос.", 503);
};

export async function loadPrivateCase(caseId: string): Promise<PrivateCase> {
  const local = getLocalCase(caseId);
  if (local) return local;
  if (!databaseConfigured()) throw new ApiError("CASE_NOT_FOUND", "Дело не найдено. Создайте новое расследование.", 404);
  const db = createServerSupabaseClient();
  const { data: row, error } = await db.from("cases").select("id,title,briefing,created_at,culprit_id").eq("id", caseId).maybeSingle();
  if (error) unavailable(error);
  if (!row || !row.culprit_id) throw new ApiError("CASE_NOT_FOUND", "Дело не найдено.", 404);
  const [people, materials] = await Promise.all([
    db.from("suspects").select("id,case_id,name,role,description").eq("case_id", caseId),
    db.from("evidence").select("id,case_id,type,section,title,subtitle,danger,content,hint,position").eq("case_id", caseId).order("position"),
  ]);
  if (people.error || materials.error) unavailable(people.error ?? materials.error);
  return { culpritId: row.culprit_id, bundle: { source: "supabase", case: { id: row.id, title: row.title, briefing: row.briefing, created_at: row.created_at }, suspects: people.data as Suspect[], evidence: materials.data as Evidence[] } };
}

export async function startGameSession(caseId: string, player: string) {
  const privateCase = await loadPrivateCase(caseId);
  const token = randomBytes(32).toString("base64url");
  const startedAt = new Date().toISOString();
  const record: StoredSession = {
    id: randomUUID(), caseId, tokenHash: hashToken(token), playerHash: hashToken(player), startedAt,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), completedAt: null, revision: 0, privateCase,
    state: { caseTitle: privateCase.bundle.case.title, totalEvidence: privateCase.bundle.evidence.length, studied: [], hints: [], attempts: [], abandonedAt: null },
  };
  if (privateCase.bundle.source === "supabase") {
    const { error } = await createServerSupabaseClient().from("sessions").insert({ id: record.id, case_id: caseId, token_hash: record.tokenHash, player_hash: record.playerHash, started_at: startedAt, expires_at: record.expiresAt, state: record.state as unknown as Json });
    if (error) unavailable(error);
  } else changeLocal((data) => { data.sessions[record.tokenHash] = record; });
  return { token, session: snapshot(record), bundle: publicCase(privateCase.bundle) };
}

export async function loadSession(token: string, player: string): Promise<StoredSession> {
  if (!token || !player) throw new ApiError("SESSION_NOT_FOUND", "Игровая сессия не найдена. Начните расследование.", 401);
  const tokenHash = hashToken(token);
  const playerHash = hashToken(player);
  const local = readLocal().sessions[tokenHash];
  if (local && local.playerHash === playerHash) return local;
  if (databaseConfigured()) {
    const { data: row, error } = await createServerSupabaseClient().from("sessions").select("id,case_id,token_hash,player_hash,started_at,expires_at,completed_at,state,revision").eq("token_hash", tokenHash).eq("player_hash", playerHash).maybeSingle();
    if (error) unavailable(error);
    if (row) return { id: row.id, caseId: row.case_id, tokenHash, playerHash, startedAt: row.started_at, expiresAt: row.expires_at, completedAt: row.completed_at, revision: row.revision, state: row.state as unknown as SessionState, privateCase: await loadPrivateCase(row.case_id) };
  }
  throw new ApiError("SESSION_NOT_FOUND", "Игровая сессия не найдена. Начните расследование.", 401);
}

export function snapshot(record: StoredSession): SessionSnapshot {
  const now = Date.now();
  const { state, privateCase } = record;
  const end = record.completedAt ?? state.abandonedAt;
  const elapsedSeconds = Math.max(0, Math.min(1800, Math.floor(((end ? Date.parse(end) : now) - Date.parse(record.startedAt)) / 1000)));
  const status = record.completedAt ? "completed" : state.abandonedAt ? "abandoned" : Date.parse(record.expiresAt) <= now ? "expired" : "active";
  const wrongAttempts = state.attempts.filter((attempt) => !attempt.correct).length;
  const breakdown = calculateScore(elapsedSeconds, state.hints.length, wrongAttempts);
  const sections = Object.fromEntries((["mail", "logs", "files", "people"] as const).map((section) => {
    const items = privateCase.bundle.evidence.filter((item) => item.section === section);
    return [section, { total: items.length, studied: items.filter((item) => state.studied.includes(item.id)).length }];
  })) as SessionSnapshot["progress"]["sections"];
  const total = privateCase.bundle.evidence.length;
  return {
    id: record.id, revision: record.revision, caseId: record.caseId, caseTitle: privateCase.bundle.case.title, status,
    startedAt: record.startedAt, completedAt: record.completedAt, serverTime: new Date(now).toISOString(), elapsedSeconds, remainingSeconds: Math.max(0, 1800 - elapsedSeconds),
    studiedEvidenceIds: state.studied, usedHintIds: state.hints,
    hints: Object.fromEntries(privateCase.bundle.evidence.filter((item) => state.hints.includes(item.id)).map((item) => [item.id, item.hint])),
    attemptedSuspectIds: state.attempts.map((attempt) => attempt.suspectId), hintsUsed: state.hints.length, attempts: state.attempts.length, wrongAttempts,
    score: breakdown.total, breakdown, efficiency: Math.round(100 * state.studied.length / Math.max(1, total)),
    progress: { studiedEvidence: state.studied.length, totalEvidence: total, progress: Math.round(100 * state.studied.length / Math.max(1, total)), hintsUsed: state.hints.length, attempts: state.attempts.length, sections },
    ...(record.completedAt ? { resolution: buildResolution(privateCase) } : {}),
  };
}

function ensureActive(record: StoredSession) {
  const status = snapshot(record).status;
  if (status === "expired") throw new ApiError("SESSION_EXPIRED", "Время расследования истекло. Начните его заново или выберите новое дело.", 409);
  if (status !== "active") throw new ApiError("SESSION_COMPLETED", "Это прохождение завершено. Можно начать его заново.", 409);
}

type Mutation = { type: "evidence" | "hint" | "verdict"; id: string } | { type: "abandon" };
export async function updateSession(token: string, player: string, mutation: Mutation) {
  for (let retry = 0; retry < 3; retry++) {
    const record = await loadSession(token, player);
    const previousRevision = record.revision;
    let attempt: SessionState["attempts"][number] | null = null;
    if (mutation.type === "abandon") {
      if (snapshot(record).status === "active") record.state.abandonedAt = new Date().toISOString();
    } else {
      ensureActive(record);
      if (mutation.type === "verdict") {
        if (!record.privateCase.bundle.suspects.some((person) => person.id === mutation.id)) throw new ApiError("SUSPECT_NOT_FOUND", "Подозреваемый не относится к текущему делу.", 404);
        if (record.state.attempts.some((item) => item.suspectId === mutation.id)) throw new ApiError("SUSPECT_ALREADY_CHECKED", "Этот подозреваемый уже был проверен. Изучите другие версии.", 409);
        const correct = mutation.id === record.privateCase.culpritId;
        if (correct) record.completedAt = new Date().toISOString();
        attempt = { suspectId: mutation.id, correct, score: 0 };
        record.state.attempts.push(attempt);
        attempt.score = snapshot(record).score;
      } else {
        const evidence = record.privateCase.bundle.evidence.find((item) => item.id === mutation.id);
        if (!evidence) throw new ApiError("EVIDENCE_NOT_FOUND", "Материал не относится к текущему делу.", 404);
        const list = mutation.type === "hint" ? record.state.hints : record.state.studied;
        if (!list.includes(mutation.id)) list.push(mutation.id);
      }
    }
    record.revision++;
    if (record.privateCase.bundle.source === "supabase") {
      const { data, error } = await createServerSupabaseClient().rpc("update_investigation_session", {
        p_id: record.id, p_revision: previousRevision, p_state: record.state as unknown as Json,
        p_completed_at: record.completedAt, p_attempt: attempt as unknown as Json,
      });
      if (error) unavailable(error);
      if (!data) continue;
    } else {
      const saved = changeLocal((data) => {
        if (data.sessions[record.tokenHash]?.revision !== previousRevision) return false;
        data.sessions[record.tokenHash] = record;
        return true;
      });
      if (!saved) continue;
    }
    return { correct: attempt?.correct, session: snapshot(record) };
  }
  throw new ApiError("SESSION_CONFLICT", "Состояние изменилось в другом запросе. Обновите данные и повторите действие.", 409);
}

export async function getHistory(player: string): Promise<HistoryEntry[]> {
  if (!player) return [];
  const playerHash = hashToken(player);
  const entries: HistoryEntry[] = Object.values(readLocal().sessions).filter((record) => record.playerHash === playerHash && record.completedAt).map((record) => {
    const view = snapshot(record);
    return { sessionId: record.id, caseId: record.caseId, title: view.caseTitle, completedAt: record.completedAt!, score: view.score, elapsedSeconds: view.elapsedSeconds, hintsUsed: view.hintsUsed, attempts: view.attempts, studiedEvidence: view.progress.studiedEvidence, totalEvidence: view.progress.totalEvidence };
  });
  if (databaseConfigured()) {
    const { data, error } = await createServerSupabaseClient().from("sessions").select("id,case_id,started_at,completed_at,state").eq("player_hash", playerHash).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(100);
    if (error) unavailable(error);
    for (const row of data ?? []) {
      const state = row.state as unknown as SessionState;
      const elapsedSeconds = Math.max(0, Math.min(1800, Math.floor((Date.parse(row.completed_at!) - Date.parse(row.started_at)) / 1000)));
      entries.push({ sessionId: row.id, caseId: row.case_id, title: state.caseTitle, completedAt: row.completed_at!, elapsedSeconds, score: calculateScore(elapsedSeconds, state.hints.length, state.attempts.filter((item) => !item.correct).length).total, hintsUsed: state.hints.length, attempts: state.attempts.length, studiedEvidence: state.studied.length, totalEvidence: state.totalEvidence });
    }
  }
  return entries.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 100);
}

export function statistics(history: HistoryEntry[]): Statistics {
  const count = history.length;
  return { completed: count, averageScore: count ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / count) : 0, bestScore: Math.max(0, ...history.map((item) => item.score)), averageSeconds: count ? Math.round(history.reduce((sum, item) => sum + item.elapsedSeconds, 0) / count) : 0, hintsUsed: history.reduce((sum, item) => sum + item.hintsUsed, 0), attempts: history.reduce((sum, item) => sum + item.attempts, 0), sampleLimit: 100 };
}

function buildResolution({ bundle, culpritId }: PrivateCase): CaseResolution {
  return { suspectName: bundle.suspects.find((person) => person.id === culpritId)?.name ?? "Участник дела", findings: bundle.evidence.filter((item) => item.danger).map((item) => {
    const content = item.content;
    const detail = "lines" in content ? content.lines.filter((line) => line.anomaly).map((line) => line.text).join("\n")
      : "entries" in content ? content.entries.map((entry) => `${entry.key}: ${entry.value}`).join("\n")
      : "connections" in content ? content.connections.filter((edge) => edge.anomaly).map((edge) => `${edge.from} → ${edge.to}: ${edge.label}`).join("\n")
      : `${content.speaker}: ${content.quote}`;
    return { title: item.title, detail, explanation: item.hint };
  }) };
}
