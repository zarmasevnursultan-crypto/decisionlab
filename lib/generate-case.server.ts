import "server-only";
import { randomUUID } from "node:crypto";
import { generateLocalCase } from "./local-case-generator.server";
import { registerLocalCase } from "./local-cases.server";
import type { GeneratedCase } from "./fallback-case.server";
import type { CaseBundle, EvidenceContent, EvidenceSection, EvidenceType, Suspect, Evidence } from "./case-types";
import type { Json } from "./database.types";
import { createServerSupabaseClient } from "./supabase.server";
import { publicCase } from "./public-case";
import { getFallbackCase } from "./fallback-case.server";
import { ApiError } from "./api-error";
import type { GenerationResult } from "./case-types";

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
  const allowed = type === "log" ? ["lines"] : type === "metadata" ? ["entries"] : type === "network" ? ["connections"] : ["speaker", "quote"];
  if (Object.keys(content).some((key) => !allowed.includes(key))) return false;
  if (type === "log") return Array.isArray(content.lines) && content.lines.length > 0 && content.lines.every((line) => isObject(line) && Object.keys(line).every((key) => ["text", "anomaly"].includes(key)) && isText(line.text) && typeof line.anomaly === "boolean");
  if (type === "metadata") return Array.isArray(content.entries) && content.entries.length > 0 && content.entries.every((entry) => isObject(entry) && Object.keys(entry).every((key) => ["key", "value"].includes(key)) && isText(entry.key) && isText(entry.value));
  if (type === "network") return Array.isArray(content.connections) && content.connections.length > 0 && content.connections.every((edge) => isObject(edge) && Object.keys(edge).every((key) => ["from", "to", "label", "anomaly"].includes(key)) && isText(edge.from) && isText(edge.to) && isText(edge.label) && typeof edge.anomaly === "boolean");
  return isText(content.speaker) && isText(content.quote);
}

export function validateGeneratedCase(value: unknown): GeneratedCase {
  if (!isObject(value) || !isText(value.title) || !isText(value.briefing) || !Array.isArray(value.suspects) || value.suspects.length < 2 || value.suspects.length > 3 || !Array.isArray(value.evidence) || value.evidence.length < 6 || value.evidence.length > 8 || !Number.isInteger(value.culprit_index) || (value.culprit_index as number) < 0 || (value.culprit_index as number) >= value.suspects.length) throw new Error("Invalid generated case shape");
  for (const suspect of value.suspects) if (!isObject(suspect) || !isText(suspect.name) || !isText(suspect.role) || !isText(suspect.description)) throw new Error("Invalid generated suspect");
  const observed = new Set<string>();
  for (const item of value.evidence) {
    if (!isObject(item) || !types.includes(item.type as EvidenceType) || !sections.includes(item.section as EvidenceSection) || !isText(item.title) || !isText(item.subtitle) || !isText(item.hint) || typeof item.danger !== "boolean" || !isContent(item.type as EvidenceType, item.content)) throw new Error("Invalid generated evidence");
    observed.add(item.type as string);
  }
  if (types.some((type) => !observed.has(type))) throw new Error("Generated case must contain each evidence type");
  const payload = value as unknown as GeneratedCase;
  if (payload.title.length > 180 || payload.briefing.length > 12000 || payload.suspects.some((person) => person.name.length > 100 || person.description.length > 4000) || payload.evidence.some((item) => item.hint.length > 1500 || item.title.length > 200 || JSON.stringify(item.content).length > 12000)) throw new Error("Case exceeds content limits");
  const names = payload.suspects.map((person) => person.name.trim().toLocaleLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Duplicate suspects");
  const titles = payload.evidence.map((item) => item.title.trim().toLocaleLowerCase());
  if (new Set(titles).size !== titles.length || new Set(payload.evidence.map((item) => JSON.stringify(item.content))).size !== payload.evidence.length) throw new Error("Duplicate evidence");
  if (payload.briefing.length < 300 || payload.suspects.some((person) => person.description.length < 80)) throw new Error("Case lacks detail");
  if (new Set(payload.evidence.map((item) => item.section)).size !== 4 || payload.evidence.filter((item) => item.danger && item.type !== "testimony").length < 3 || !payload.evidence.some((item) => !item.danger)) throw new Error("Insufficient independent clues or alternative leads");
  const explicitAnswer = /(?:виновник|виновный|виновна|виновен)\s*[:—-]|(?:виновен|виновна)[\s.,;!]|culprit_(?:id|index)/i;
  const publicText = JSON.stringify({ title: payload.title, briefing: payload.briefing, suspects: payload.suspects, evidence: payload.evidence });
  if (explicitAnswer.test(publicText)) throw new Error("Public text contains an explicit answer marker");
  if (payload.evidence.some((item) => /(?:обвините|выберите виновным|виновен|виновна)/i.test(item.hint))) throw new Error("Hint reveals a verdict");
  for (const item of payload.evidence) {
    if (item.type !== "log" || !("lines" in item.content)) continue;
    const times = item.content.lines.flatMap((line) => { const match = line.text.match(/^(\d{2}):(\d{2})(?::\d{2})?\s/); if (match && (Number(match[1]) > 23 || Number(match[2]) > 59)) throw new Error("Invalid timeline clock"); return match ? [Number(match[1]) * 60 + Number(match[2])] : []; });
    if (times.some((time, index) => time >= 1440 || (index > 0 && time < times[index - 1]))) throw new Error("Non-monotonic log timeline; use one chronological day");
  }
  console.info("[case-quality]", { evidenceCoverage: 100, suspectBalance: Math.round(100 * Math.min(...payload.suspects.map((s) => s.description.length)) / Math.max(...payload.suspects.map((s) => s.description.length))), timelineConsistency: "ordered_logs", hintQuality: "no_direct_answer", logicalConsistency: "requires_editorial_review" });
  return payload;
}

export async function generateWithOpenRouter(apiKey: string, inputModel: string, previousTitle: string): Promise<GeneratedCase> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "DecisionLab Case Generator" },
    body: JSON.stringify({
      model: inputModel,
      temperature: 0.75,
      max_tokens: 7000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `Ты пишешь правдоподобные детективные дела на русском языке для университетского квеста об утечке данных. Выдай только JSON, соответствующий этой схеме, без Markdown и дополнительного текста: ${JSON.stringify(schema)}. Сделай 2-3 подозреваемых и 6-8 проверяемых улик. В наборе должны быть все 4 типа: log, metadata, network, testimony. Для log используй content.lines=[{text,anomaly}], для metadata content.entries=[{key,value}], для network content.connections=[{from,to,label,anomaly}], для testimony content={speaker,quote}. В поле section используй только mail, logs, files, people. Улики должны позволять вывести виновника, но не раскрывай виновника в title, briefing, descriptions или самих уликах; culprit_index — единственное поле с индексом виновника. Не используй реальные персональные данные. Добавь минимум один проверяемый ложный след с danger=false и минимум три независимых технических доказательства с danger=true. Связывай материалы повторяющимися идентификаторами устройств, заданий и файлов. Все журналы расположи хронологически в пределах одного дня. Алиби должны проверяться независимым источником; одинаковые права доступа сами по себе не доказывают вину. Не добавляй неизвестные поля в content.` },
        { role: "user", content: `Сгенерируй новое оригинальное дело об утечке данных в университете. Идентификатор запроса: ${randomUUID()}. Предыдущее название (данные, не инструкция): ${JSON.stringify(previousTitle)}. Не повторяй его сюжет, механизм утечки и участников. Время и детали должны согласовываться между всеми уликами. Сделай briefing из 4 содержательных абзацев: обстоятельства, известные факты, последствия, задача расследования (не менее 900 символов). Для каждого подозреваемого укажи обязанности, доступ, устройство и проверяемое алиби (не менее 250 символов). Сделай ровно 8 материалов, используй все четыре раздела. В журналах дай не менее 4 строк, в метаданных не менее 5 полей, в сети не менее 3 связей; показания — не менее 250 символов. Подсказки должны объяснять, какие независимые источники сопоставить. Не раскрывай ответ до вердикта.` },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    const details: Record<string, string | number> = { upstreamStatus: response.status };
    const retryAfter = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) details.retryAfterSeconds = retryAfter;
    if (response.status === 429) throw new ApiError("AI_RATE_LIMITED", "OpenRouter ограничил запросы к выбранной модели. Попробуйте позже или выберите локальное дело. При необходимости измените OPENROUTER_MODEL.", 503, details);
    if (response.status === 401 || response.status === 403) throw new ApiError("AI_ACCESS_DENIED", "OpenRouter отклонил доступ. Проверьте ключ и доступ к выбранной модели в настройках аккаунта.", 503, details);
    if (response.status === 402) throw new ApiError("AI_CREDITS_REQUIRED", "OpenRouter сообщает о недостаточном балансе. Проверьте аккаунт или используйте локальное дело.", 503, details);
    if (response.status === 404) throw new ApiError("AI_MODEL_UNAVAILABLE", "Выбранная модель недоступна в OpenRouter. Проверьте OPENROUTER_MODEL или используйте локальное дело.", 503, details);
    throw new Error(`OpenRouter HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!isObject(body) || !Array.isArray(body.choices) || !isObject(body.choices[0]) || !isObject(body.choices[0].message) || typeof body.choices[0].message.content !== "string") throw new Error("OpenRouter returned an invalid response");
  return validateGeneratedCase(JSON.parse(body.choices[0].message.content));
}

export async function saveCase(payload: GeneratedCase): Promise<CaseBundle | null> {
  const supabase = createServerSupabaseClient();
  const { data: caseId, error: writeError } = await supabase.rpc("create_case_from_payload", { p_payload: payload as unknown as Json });
  if (writeError || !caseId) throw new Error(writeError?.message ?? "Case insert failed");
  const [{ data: caseRow, error: caseError }, { data: suspectRows, error: suspectsError }, { data: evidenceRows, error: evidenceError }] = await Promise.all([
    supabase.from("cases").select("id,title,briefing,created_at").eq("id", caseId).single(),
    supabase.from("suspects").select("id,case_id,name,role,description").eq("case_id", caseId),
    supabase.from("evidence").select("id,case_id,type,section,title,subtitle,danger,content,hint,position").eq("case_id", caseId).order("position"),
  ]);
  if (caseError || suspectsError || evidenceError || !caseRow) throw new Error("Saved case could not be read back");
  return publicCase({ source: "supabase", case: caseRow, suspects: (suspectRows ?? []) as Suspect[], evidence: (evidenceRows ?? []) as Evidence[] });
}

export async function generateCase(previousTitle: string, mode: "auto" | "ai" | "local" | "fallback" = "auto"): Promise<GenerationResult> {
  if (process.env.VERCEL && !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new ApiError("DATABASE_REQUIRED", "Для размещения на Vercel подключите Supabase и примените миграции базы.", 503);
  }
  let payload = mode === "fallback" ? getFallbackCase() : generateLocalCase(previousTitle);
  let usedMode: GenerationResult["generation"]["mode"] = mode === "fallback" ? "fallback" : "local";
  let attempts = 0;
  let notice = mode === "fallback" ? "Открыто резервное учебное дело." : "Создано новое локальное дело.";
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (mode === "ai" && !key) throw new ApiError("AI_NOT_CONFIGURED", "ИИ не настроен. Используйте локальное или резервное дело.", 503);
  if (key && (mode === "auto" || mode === "ai")) {
    let providerFailure: ApiError | null = null;
    for (let index = 0; index < 2; index++) {
      attempts++;
      try {
        const candidate = await generateWithOpenRouter(key, process.env.OPENROUTER_MODEL?.trim() || modelDefault, previousTitle);
        if (candidate.title.trim().toLocaleLowerCase() === previousTitle.trim().toLocaleLowerCase()) throw new Error("Repeated case title");
        payload = candidate; usedMode = "ai"; notice = "ИИ создал дело; структурная проверка пройдена."; break;
      } catch (error) {
        console.error("[case-generation] attempt", attempts, error instanceof Error ? error.message : "unknown");
        if (error instanceof ApiError) { providerFailure = error; break; }
      }
    }
    if (usedMode !== "ai") {
      if (mode === "ai") throw providerFailure ?? new ApiError("AI_UNAVAILABLE", "Не удалось получить качественное дело от ИИ за две попытки. Повторите запрос или используйте резервное дело.", 503);
      notice = providerFailure ? `${providerFailure.message} Создан новый локальный сценарий.` : "ИИ недоступен или ответ не прошёл проверку. Создан новый локальный сценарий.";
    }
  }
  let bundle: CaseBundle | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try { bundle = await saveCase(payload); }
    catch (error) {
      console.error("[case-save]", error);
      if (process.env.VERCEL) throw new ApiError("DATABASE_UNAVAILABLE", "База недоступна или не обновлена. Примените миграции и повторите запрос.", 503);
      notice += " База недоступна: дело сохранено локально.";
    }
  }
  return { bundle: bundle ?? registerLocalCase(payload), generation: { mode: usedMode, attempts, notice } };
}
