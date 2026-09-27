import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getFallbackCase } from "./fallback-case.server";
import { stableUuid } from "./stable-id.server";
import { createServerSupabaseClient } from "./supabase.server";

const COOKIE_NAME = "decisionlab_session";
const fallbackCase = getFallbackCase();
const fallbackCaseId = stableUuid(`case:${fallbackCase.title}`);
const fallbackSuspects = fallbackCase.suspects.map((_, index) => stableUuid(`${fallbackCaseId}:suspect:${index}`));
type LocalSession = { caseId: string; startedAt: string; hintsUsed: number; attempted: Set<string>; completed: boolean };
const globalSessions = globalThis as typeof globalThis & { __decisionlabSessions?: Map<string, LocalSession> };
const localSessions = globalSessions.__decisionlabSessions ??= new Map<string, LocalSession>();
export { COOKIE_NAME };
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startGameSession(caseId: string) {
  const token = randomBytes(32).toString("base64url");
  const startedAt = new Date().toISOString();
  try {
    const supabase = createServerSupabaseClient();
    const { data: caseRow } = await supabase.from("cases").select("id").eq("id", caseId).maybeSingle();
    if (caseRow) {
      const { error } = await supabase.from("sessions").insert({ case_id: caseId, token_hash: hashToken(token), started_at: startedAt, expires_at: new Date(Date.now() + 30 * 60_000).toISOString() });
      if (!error) return { token, startedAt };
    }
  } catch { /* The checked-in fallback supports local demos without Supabase. */ }
  if (caseId !== fallbackCaseId) return null;
  localSessions.set(hashToken(token), { caseId, startedAt, hintsUsed: 0, attempted: new Set(), completed: false });
  return { token, startedAt };
}

export async function recordHint(token: string) {
  const tokenHash = hashToken(token);
  const local = localSessions.get(tokenHash);
  if (local && !local.completed && Date.now() - Date.parse(local.startedAt) < 30 * 60_000) return ++local.hintsUsed;
  try {
    const supabase = createServerSupabaseClient();
    const { data: session } = await supabase.from("sessions").select("id,hints_used,expires_at,completed_at").eq("token_hash", tokenHash).maybeSingle();
    if (!session || session.completed_at || Date.parse(session.expires_at) <= Date.now()) return null;
    const hintsUsed = session.hints_used + 1;
    const { error } = await supabase.from("sessions").update({ hints_used: hintsUsed }).eq("id", session.id);
    return error ? null : hintsUsed;
  } catch { return null; }
}

export async function submitVerdict(token: string, suspectId: string) {
  const tokenHash = hashToken(token);
  const local = localSessions.get(tokenHash);
  if (local) {
    if (local.completed || Date.now() - Date.parse(local.startedAt) >= 30 * 60_000 || !fallbackSuspects.includes(suspectId) || local.attempted.has(suspectId)) return null;
    local.attempted.add(suspectId);
    const correct = suspectId === fallbackSuspects[fallbackCase.culprit_index];
    if (correct) local.completed = true;
    return { correct, score: Math.max(0, 100 - local.hintsUsed * 10 - Math.floor((Date.now() - Date.parse(local.startedAt)) / 30_000)) };
  }
  try {
    const supabase = createServerSupabaseClient();
    const { data: session } = await supabase.from("sessions").select("id,case_id,started_at,expires_at,hints_used,completed_at").eq("token_hash", tokenHash).maybeSingle();
    if (!session || session.completed_at || Date.parse(session.expires_at) <= Date.now()) return null;
    const { data: suspect } = await supabase.from("suspects").select("id").eq("id", suspectId).eq("case_id", session.case_id).maybeSingle();
    if (!suspect) return null;
    const { data: caseRow } = await supabase.from("cases").select("culprit_id").eq("id", session.case_id).maybeSingle();
    if (!caseRow) return null;
    const { data: previous } = await supabase.from("attempts").select("id").eq("session_id", session.id).eq("suspect_id", suspectId).maybeSingle();
    if (previous) return null;
    const correct = caseRow.culprit_id === suspectId;
    const score = Math.max(0, 100 - session.hints_used * 10 - Math.floor((Date.now() - Date.parse(session.started_at)) / 30_000));
    const { error } = await supabase.from("attempts").insert({ session_id: session.id, case_id: session.case_id, suspect_id: suspectId, correct, score });
    if (error) return null;
    if (correct) await supabase.from("sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
    return { correct, score };
  } catch { return null; }
}

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 };
}
