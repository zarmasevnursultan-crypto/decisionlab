import "server-only";
import { createServerSupabaseClient } from "./supabase.server";
import { getFallbackCase } from "./fallback-case.server";
import { stableUuid } from "./stable-id.server";
import type { CaseBundle, Evidence, Suspect } from "./case-types";

// Loads the one active case for the game. Only ever selects the columns the
// client is allowed to see (no culprit_id) so the answer can't leak even if
// this function's return value is later serialized to the client by mistake.
async function loadFromSupabase(): Promise<CaseBundle | null> {
  let supabase;
  try {
    supabase = createServerSupabaseClient();
  } catch {
    // Env vars not configured yet — caller falls back.
    return null;
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id,title,briefing,created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (caseError) {
    console.error("[get-case] failed to load case:", caseError.message);
    return null;
  }
  if (!caseRow) return null;

  const [{ data: suspects, error: suspectsError }, { data: evidence, error: evidenceError }] =
    await Promise.all([
      supabase
        .from("suspects")
        .select("id,case_id,name,role,description")
        .eq("case_id", caseRow.id),
      supabase
        .from("evidence")
        .select("id,case_id,type,section,title,subtitle,danger,content,hint,position")
        .eq("case_id", caseRow.id)
        .order("position", { ascending: true }),
    ]);

  if (suspectsError || evidenceError) {
    console.error(
      "[get-case] failed to load suspects/evidence:",
      suspectsError?.message,
      evidenceError?.message
    );
    return null;
  }

  return {
    source: "supabase",
    case: caseRow,
    suspects: (suspects ?? []) as Suspect[],
    evidence: (evidence ?? []) as Evidence[],
  };
}

// Turns the fallback JSON (which includes culprit_index) into the same safe
// shape the UI gets from Supabase. culprit_index is intentionally dropped here.
function loadFromFallback(): CaseBundle {
  const generated = getFallbackCase();
  const caseId = stableUuid(`case:${generated.title}`);

  const suspects: Suspect[] = generated.suspects.map((s, index) => ({
    id: stableUuid(`${caseId}:suspect:${index}`),
    case_id: caseId,
    name: s.name,
    role: s.role,
    description: s.description,
  }));

  const evidence: Evidence[] = generated.evidence.map((e, index) => ({
    id: stableUuid(`${caseId}:evidence:${index}`),
    case_id: caseId,
    type: e.type,
    section: e.section,
    title: e.title,
    subtitle: e.subtitle,
    danger: e.danger,
    content: e.content,
    hint: e.hint,
    position: index,
  }));

  return {
    source: "fallback",
    case: {
      id: caseId,
      title: generated.title,
      briefing: generated.briefing,
      created_at: new Date().toISOString(),
    },
    suspects,
    evidence,
  };
}

export async function loadCase(): Promise<CaseBundle> {
  const fromDb = await loadFromSupabase();
  if (fromDb) return fromDb;
  return loadFromFallback();
}
