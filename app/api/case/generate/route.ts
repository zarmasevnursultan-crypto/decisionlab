import { NextResponse } from "next/server";
import { getFallbackCase } from "@/lib/fallback-case.server";
import type { GeneratedCase } from "@/lib/fallback-case.server";
import type { CaseBundle, EvidenceContent, EvidenceSection, EvidenceType, Suspect, Evidence } from "@/lib/case-types";
import type { Json } from "@/lib/database.types";
import { loadFallbackCaseBundle } from "@/lib/get-case.server";
import { createServerSupabaseClient } from "@/lib/supabase.server";

const modelDefault = "google/gemma-4-26b-a4b-it:free";
const sections: EvidenceSection[] = ["mail", "logs", "files", "people"];
const types: EvidenceType[] = ["log", "metadata", "network", "testimony"];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "briefing", "suspects", "culprit_index", "evidence"],
  properties: {
    title: { type: "string" }, briefing: { type: "string" }, culprit_index: { type: "integer" },
    suspects: { type: "array", minItems: 2, maxItems: 3, items: { type: "object", additionalProperties: false, required: ["name", "role", "description"], properties: { name: { type: "string" }, role: { type: "string" }, description: { type: "string" } } } },
    evidence: { type: "array", minItems: 6, maxItems: 8, items: { type: "object", required: ["type", "section", "title", "subtitle", "danger", "content", "hint"], properties: { type: { enum: types }, section: { enum: sections }, title: { type: "string" }, subtitle: { type: "string" }, danger: { type: "boolean" }, content: { type: "object" }, hint: { type: "string" } } } },
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isContent(type: EvidenceType, content: unknown): content is EvidenceContent {
  if (!isObject(content)) return false;
  if (type === "log") return Array.isArray(content.lines) && content.lines.length > 0 && content.lines.every((line) => isObject(line) && isText(line.text) && typeof line.anomaly === "boolean");
  if (type === "metadata") return Array.isArray(content.entries) && content.entries.length > 0 && content.entries.every((entry) => isObject(entry) && isText(entry.key) && isText(entry.value));
  if (type === "network") return Array.isArray(content.connections) && content.connections.length > 0 && content.connections.every((edge) => isObject(edge) && isText(edge.from) && isText(edge.to) && isText(edge.label) && typeof edge.anomaly === "boolean");
  return isText(content.speaker) && isText(content.quote);
}

function validateGeneratedCase(value: unknown): GeneratedCase {
  if (!isObject(value) || !isText(value.title) || !isText(value.briefing) || !Array.isArray(value.suspects) || value.suspects.length < 2 || value.suspects.length > 3 || !Array.isArray(value.evidence) || value.evidence.length < 6 || value.evidence.length > 8 || !Number.isInteger(value.culprit_index) || (value.culprit_index as number) < 0 || (value.culprit_index as number) >= value.suspects.length) throw new Error("Invalid generated case shape");
  for (const suspect of value.suspects) if (!isObject(suspect) || !isText(suspect.name) || !isText(suspect.role) || !isText(suspect.description)) throw new Error("Invalid generated suspect");
  const observed = new Set<string>();
  for (const item of value.evidence) {
    if (!isObject(item) || !types.includes(item.type as EvidenceType) || !sections.includes(item.section as EvidenceSection) || !isText(item.title) || !isText(item.subtitle) || !isText(item.hint) || typeof item.danger !== "boolean" || !isContent(item.type as EvidenceType, item.content)) throw new Error("Invalid generated evidence");
    observed.add(item.type as string);
  }
  if (types.some((type) => !observed.has(type))) throw new Error("Generated case must contain each evidence type");
  return value as unknown as GeneratedCase;
}

async function generateWithOpenRouter(apiKey: string, inputModel: string): Promise<GeneratedCase> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "DecisionLab Case Generator" },
    body: JSON.stringify({
      model: inputModel,
      temperature: 0.75,
      max_tokens: 7000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Ты пишешь правдоподобные детективные дела на русском языке для университетского квеста об утечке данных. Выдай только JSON, соответствующий этой схеме, без Markdown и дополнительного текста: ${JSON.stringify(schema)}. Сделай 2-3 подозреваемых и 6-8 проверяемых улик. В наборе должны быть все 4 типа: log, metadata, network, testimony. Для log используй content.lines=[{text,anomaly}], для metadata content.entries=[{key,value}], для network content.connections=[{from,to,label,anomaly}], для testimony content={speaker,quote}. В поле section используй только mail, logs, files, people. Улики должны позволять вывести виновника, но не раскрывай виновника в title, briefing, descriptions или самих уликах; culprit_index — единственное поле с индексом виновника. Не используй реальные персональные данные.` },
        { role: "user", content: "Сгенерируй новое оригинальное дело об утечке данных в университете. Время и детали должны согласовываться между всеми уликами." },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!isObject(body) || !Array.isArray(body.choices) || !isObject(body.choices[0]) || !isObject(body.choices[0].message) || typeof body.choices[0].message.content !== "string") throw new Error("OpenRouter returned an invalid response");
  return validateGeneratedCase(JSON.parse(body.choices[0].message.content));
}

async function saveCase(payload: GeneratedCase): Promise<CaseBundle | null> {
  const supabase = createServerSupabaseClient();
  const { data: caseId, error: writeError } = await supabase.rpc("create_case_from_payload", { p_payload: payload as unknown as Json });
  if (writeError || !caseId) throw new Error(writeError?.message ?? "Case insert failed");
  const [{ data: caseRow, error: caseError }, { data: suspectRows, error: suspectsError }, { data: evidenceRows, error: evidenceError }] = await Promise.all([
    supabase.from("cases").select("id,title,briefing,created_at").eq("id", caseId).single(),
    supabase.from("suspects").select("id,case_id,name,role,description").eq("case_id", caseId),
    supabase.from("evidence").select("id,case_id,type,section,title,subtitle,danger,content,hint,position").eq("case_id", caseId).order("position"),
  ]);
  if (caseError || suspectsError || evidenceError || !caseRow) throw new Error("Saved case could not be read back");
  return { source: "supabase", case: caseRow, suspects: (suspectRows ?? []) as Suspect[], evidence: (evidenceRows ?? []) as Evidence[] };
}

export async function POST() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "generation_unavailable" }, { status: 503 });

  let generated: GeneratedCase;
  try {
    generated = await generateWithOpenRouter(apiKey, process.env.OPENROUTER_MODEL?.trim() || modelDefault);
  } catch (error) {
    console.error("[case-generate] OpenRouter failed; using the checked-in fallback case", error instanceof Error ? error.message : "unknown error");
    generated = getFallbackCase();
  }

  try {
    const bundle = await saveCase(generated);
    if (bundle) return NextResponse.json(bundle);
  } catch (error) {
    console.error("[case-generate] Supabase write failed; serving the local fallback case", error instanceof Error ? error.message : "unknown error");
  }
  return NextResponse.json(loadFallbackCaseBundle());
}
