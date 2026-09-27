import { readFileSync, writeFileSync } from "node:fs";
const endpoints = JSON.parse(readFileSync(new URL("../lib/api-contract.json", import.meta.url), "utf8"));
const string = { type: "string" }, number = { type: "integer", minimum: 0 }, uuid = { type: "string", format: "uuid" };
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const array = (items) => ({ type: "array", items });
const object = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required });
const score = object({ base: number, hintsPenalty: number, timePenalty: number, mistakesPenalty: number, total: number });
const schemas = {
  Error: object({ success: { const: false }, error: object({ code: string, message: string, details: { type: "object", additionalProperties: true } }, ["code", "message"]) }),
  Evidence: object({ id: uuid, case_id: uuid, type: { enum: ["log", "metadata", "network", "testimony"] }, section: { enum: ["mail", "logs", "files", "people"] }, title: string, subtitle: string, danger: { type: "boolean" }, content: { oneOf: [object({ lines: array(object({ text: string, anomaly: { type: "boolean" } })) }), object({ entries: array(object({ key: string, value: string })) }), object({ connections: array(object({ from: string, to: string, label: string, anomaly: { type: "boolean" } })) }), object({ speaker: string, quote: string })] }, hint: { const: "", description: "Текст выдаётся только через POST hint" }, position: number }),
  CaseBundle: object({ source: { enum: ["local", "supabase", "fallback"] }, case: object({ id: uuid, title: string, briefing: string, created_at: { type: "string", format: "date-time" } }), suspects: array(object({ id: uuid, case_id: uuid, name: string, role: string, description: string })), evidence: array(ref("Evidence")) }),
  Progress: object({ studiedEvidence: number, totalEvidence: number, progress: { type: "integer", minimum: 0, maximum: 100 }, hintsUsed: number, attempts: number, sections: object(Object.fromEntries(["mail", "logs", "files", "people"].map((key) => [key, object({ studied: number, total: number })]))) }),
  Resolution: object({ suspectName: string, findings: array(object({ title: string, detail: string, explanation: string })) }),
  Session: object({ id: uuid, revision: number, caseId: uuid, caseTitle: string, status: { enum: ["active", "completed", "expired", "abandoned"] }, startedAt: string, completedAt: { type: ["string", "null"] }, serverTime: string, elapsedSeconds: number, remainingSeconds: number, studiedEvidenceIds: array(uuid), usedHintIds: array(uuid), hints: { type: "object", additionalProperties: string }, attemptedSuspectIds: array(uuid), hintsUsed: number, attempts: number, wrongAttempts: number, score: number, breakdown: score, progress: ref("Progress"), efficiency: number, resolution: { ...ref("Resolution"), description: "Только после успешного вердикта" } }, ["id", "caseId", "status", "elapsedSeconds", "remainingSeconds", "score", "breakdown", "progress"]),
  Hint: object({ hint: string, session: ref("Session") }),
  Verdict: object({ correct: { type: "boolean" }, session: ref("Session") }),
  Restart: object({ bundle: ref("CaseBundle"), session: ref("Session") }),
  Generation: object({ bundle: ref("CaseBundle"), generation: object({ mode: { enum: ["ai", "local", "fallback"] }, attempts: number, notice: string }) }),
  History: array(object({ sessionId: uuid, caseId: uuid, title: string, completedAt: string, score: number, elapsedSeconds: number, hintsUsed: number, attempts: number, studiedEvidence: number, totalEvidence: number })),
  Statistics: object({ completed: number, averageScore: number, bestScore: number, averageSeconds: number, hintsUsed: number, attempts: number, sampleLimit: { const: 100 } }),
  Health: object({ status: { enum: ["ok", "degraded"] }, services: object({ application: { const: "ok" }, database: { enum: ["ok", "unavailable", "not_configured"] }, ai: { enum: ["configured_not_checked", "not_configured"] } }), checkedAt: string }),
};
const paths = {};
for (const endpoint of endpoints) {
  const success = { description: "Успешный ответ", content: { "application/json": { schema: object({ success: { const: true }, data: ref(endpoint.schema), message: string }) } } };
  const responses = { 200: success };
  if (endpoint.method === "POST" && ["/api/case/session", "/api/case/restart", "/api/case/generate"].includes(endpoint.path)) responses[201] = success;
  for (const [status, description] of Object.entries({ 400: "Некорректный JSON", 401: "SESSION_NOT_FOUND", 403: "ORIGIN_MISMATCH", 404: "CASE_NOT_FOUND / EVIDENCE_NOT_FOUND / SUSPECT_NOT_FOUND", 409: "SESSION_EXPIRED / SESSION_COMPLETED / SUSPECT_ALREADY_CHECKED / SESSION_CONFLICT", 413: "REQUEST_TOO_LARGE", 422: "VALIDATION_ERROR", 500: "INTERNAL_ERROR", 503: "DATABASE_UNAVAILABLE / AI_NOT_CONFIGURED / AI_UNAVAILABLE / AI_RATE_LIMITED / AI_ACCESS_DENIED / AI_CREDITS_REQUIRED / AI_MODEL_UNAVAILABLE" })) responses[status] = { description, content: { "application/json": { schema: ref("Error"), example: { success: false, error: { code: description.split(" / ")[0], message: "Понятное сообщение пользователю" } } } } };
  const operation = { summary: endpoint.description, operationId: `${endpoint.method.toLowerCase()}${endpoint.path.replaceAll("/", "_")}`, responses, security: [{ sessionCookie: [], playerCookie: [] }] };
  if (["/api/health", "/api/case/generate", "/api/history", "/api/statistics"].includes(endpoint.path) || endpoint.method === "POST" && endpoint.path === "/api/case/session") operation.security = [];
  if (endpoint.method === "POST") {
    const properties = Object.fromEntries(Object.entries(endpoint.body ?? {}).map(([key]) => [key, key === "mode" ? { enum: ["auto", "ai", "local", "fallback"] } : key === "previousTitle" ? { type: "string", maxLength: 300 } : uuid]));
    if (endpoint.path === "/api/case/restart") properties.caseId = uuid;
    operation.requestBody = { required: true, content: { "application/json": { schema: object(properties, endpoint.required ?? []), example: endpoint.body ?? {} } } };
  }
  if (endpoint.path === "/api/case") operation.parameters = [{ name: "caseId", in: "query", required: false, schema: uuid, description: "Если задан, cookie не обязательны; возвращаются только публичные материалы" }];
  paths[endpoint.path] ??= {}; paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
}
const spec = { openapi: "3.1.0", info: { title: "DecisionLab API", version: "1.0.0", description: "Анонимные прохождения через HttpOnly cookie. 100 − 10×подсказки − floor(секунды/30) − 5×ошибки, минимум 0. История ограничена 100 последними завершёнными прохождениями. ИИ проверяется эвристически, логическая корректность не гарантируется." }, servers: [{ url: "/" }], paths, components: { schemas, securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "decisionlab_session" }, playerCookie: { type: "apiKey", in: "cookie", name: "decisionlab_player" } } } };
writeFileSync(new URL("../public/openapi.json", import.meta.url), JSON.stringify(spec, null, 2) + "\n");
console.log(`OpenAPI generated: ${endpoints.length} operations.`);
