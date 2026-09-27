import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const jar = new Map();
async function request(path, body, expected = 200, customJar = jar) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Cookie: [...customJar].map(([key, value]) => `${key}=${value}`).join("; ") }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";", 1)[0]; const index = pair.indexOf("="); customJar.set(pair.slice(0, index), pair.slice(index + 1)); }
  const text = await response.text();
  assert.equal(response.status, expected, `${path}: ${text.slice(0, 300)}`);
  if (!path.startsWith("/api/")) return text;
  const envelope = JSON.parse(text);
  assert.equal(envelope.success, expected < 400);
  return expected < 400 ? envelope.data : envelope.error;
}
assert.equal((await request("/api/case/session", undefined, 401)).code, "SESSION_NOT_FOUND");
assert.equal((await request("/api/case/session", "{", 400)).code, "INVALID_JSON");
assert.equal((await request("/api/case/session", { caseId: "bad" }, 422)).code, "VALIDATION_ERROR");
assert.equal((await request("/api/health")).services.application, "ok");
assert((await request("/api-test")).includes("API Tester"));
let previousTitle = "";
for (let index = 0; index < 3; index++) {
  const { bundle } = await request("/api/case/generate", { mode: "local", previousTitle }, 201);
  assert(!JSON.stringify(bundle).includes("culprit")); assert(bundle.evidence.every((item) => !item.hint));
  assert.notEqual(previousTitle.split(" · ")[0], bundle.case.title.split(" · ")[0]);
  const started = await request("/api/case/session", { caseId: bundle.case.id }, 201);
  const restored = await request("/api/case/session", { caseId: bundle.case.id }); assert.equal(restored.id, started.id);
  assert.equal((await request("/api/case")).case.id, bundle.case.id);
  assert.equal((await request("/api/case/evidence", { evidenceId: bundle.evidence[0].id })).progress.studiedEvidence, 1);
  const hints = await Promise.all([1, 2].map(() => request("/api/case/hint", { evidenceId: bundle.evidence[0].id })));
  assert(hints.every((item) => item.session.hintsUsed === 1)); assert(hints[0].hint);
  assert.equal((await request("/api/case/progress")).progress, 13);
  assert.equal((await request("/api/case/session")).progress.studiedEvidence, 1);
  const page = await request("/"); assert(page.includes(bundle.case.title), "Refresh restores current investigation");
  let solved = false;
  for (const suspect of bundle.suspects) {
    const verdict = await request("/api/case/verdict", { suspect_id: suspect.id });
    if (verdict.correct) { assert(verdict.session.resolution); assert.equal(verdict.session.status, "completed"); solved = true; break; }
    assert.equal(verdict.session.resolution, undefined);
    assert.equal((await request("/api/case/verdict", { suspect_id: suspect.id }, 409)).code, "SUSPECT_ALREADY_CHECKED");
  }
  assert(solved);
  const completed = await request("/api/case/session");
  assert.equal(completed.score, completed.breakdown.total);
  assert.equal((await request("/api/case/hint", { evidenceId: bundle.evidence[1].id }, 409)).code, "SESSION_COMPLETED");
  assert((await request("/api/history")).some((item) => item.sessionId === started.id));
  const restarted = await request("/api/case/restart", {}, 201);
  assert.notEqual(restarted.session.id, started.id); assert.equal(restarted.session.score, 100); assert.equal(restarted.session.progress.studiedEvidence, 0);
  previousTitle = bundle.case.title;
}
assert.equal((await request("/api/statistics")).completed, 3);
assert.deepEqual(await request("/api/history", undefined, 200, new Map()), []);
assert.equal((await request("/api/case/generate", { mode: "fallback" }, 201)).generation.mode, "fallback");
console.log("HTTP PASS: 12 endpoints, validation errors, isolated history, paid hints, progress, refresh, restart, verdict and fallback.");
