/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness loads TypeScript server modules using the installed compiler. */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const assert = require("node:assert/strict");
const { test, after } = require("node:test");
fs.mkdirSync(path.resolve(".test-data"), { recursive: true });
const directory = fs.mkdtempSync(path.resolve(".test-data", "run-"));
process.env.DECISIONLAB_DATA_DIR = directory;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
const { generateLocalCase } = require("../lib/local-case-generator.server.ts");
const { registerLocalCase } = require("../lib/local-cases.server.ts");
const { startGameSession, updateSession, loadSession, snapshot, getHistory, statistics, calculateScore, hashToken } = require("../lib/game-session.server.ts");
const { changeLocal, readLocal } = require("../lib/local-storage.server.ts");
const { validateGeneratedCase, generateCase } = require("../lib/generate-case.server.ts");
const { getFallbackCase } = require("../lib/fallback-case.server.ts");
const { evidenceLinks } = require("../lib/evidence-links.ts");
const { loadCase } = require("../lib/get-case.server.ts");
after(() => { const file = path.join(directory, "data.json"); if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(directory); });

test("Vercel first visit uses Supabase and never falls back to filesystem writes", async () => {
  const originalFetch = global.fetch;
  const originalVercel = process.env.VERCEL;
  const before = fs.existsSync(path.join(directory, "data.json")) ? fs.readFileSync(path.join(directory, "data.json"), "utf8") : null;
  process.env.VERCEL = "1";
  try {
    await assert.rejects(loadCase(), { code: "DATABASE_REQUIRED" });
    assert.throws(() => registerLocalCase(generateLocalCase()), { code: "DATABASE_REQUIRED" });
    assert.deepEqual(readLocal(), { cases: {}, sessions: {} });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-placeholder";
    const calls = [];
    global.fetch = async (input) => {
      const url = String(input); calls.push(url);
      if (url.includes("/rpc/")) return Response.json("test-case-id");
      if (url.includes("/cases?")) return Response.json({ id: "test-case-id", title: "Stored case", briefing: "Briefing", created_at: new Date().toISOString() });
      return Response.json([]);
    };
    const bundle = await loadCase();
    assert.equal(bundle.source, "supabase");
    assert.equal(bundle.case.id, "test-case-id");
    assert(calls.some((url) => url.includes("/rpc/create_case_from_payload")));
    global.fetch = async () => Response.json({ message: "database unavailable" }, { status: 400 });
    await assert.rejects(loadCase(), { code: "DATABASE_UNAVAILABLE" });
    global.fetch = async () => Response.json({ code: "PGRST202", message: "Missing RPC" }, { status: 404 });
    await assert.rejects(loadCase(), { code: "DATABASE_MIGRATION_REQUIRED" });
    const after = fs.existsSync(path.join(directory, "data.json")) ? fs.readFileSync(path.join(directory, "data.json"), "utf8") : null;
    assert.equal(after, before);
  } finally {
    global.fetch = originalFetch;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test("100 cases have distinct IDs, varied adjacent themes and no public answers or hint text", () => {
  let previousTitle = "";
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    const payload = generateLocalCase(previousTitle);
    assert.notEqual(payload.title.split(" · ")[0], previousTitle.split(" · ")[0]);
    assert(payload.briefing.length >= 900);
    assert(payload.suspects.every((person) => person.description.length >= 250));
    const bundle = registerLocalCase(payload);
    assert(!ids.has(bundle.case.id)); ids.add(bundle.case.id);
    assert(!JSON.stringify(bundle).includes("culprit"));
    assert(bundle.evidence.every((item) => item.hint === ""));
    assert(!JSON.stringify(bundle).includes(payload.evidence[0].hint));
    assert(evidenceLinks(bundle.evidence[1], bundle).length > 0);
    previousTitle = payload.title;
  }
});

test("progress, concurrent hints, verdict penalties, durable restoration, history and isolation", async () => {
  const payload = generateLocalCase();
  const bundle = registerLocalCase(payload);
  const player = "visitor-a";
  const started = await startGameSession(bundle.case.id, player);
  const token = started.token;
  await updateSession(token, player, { type: "evidence", id: bundle.evidence[0].id });
  await updateSession(token, player, { type: "evidence", id: bundle.evidence[0].id });
  await Promise.all([1, 2].map(() => updateSession(token, player, { type: "hint", id: bundle.evidence[0].id })));
  let view = snapshot(await loadSession(token, player));
  assert.equal(view.progress.studiedEvidence, 1);
  assert.equal(view.hintsUsed, 1);
  assert.equal(view.hints[bundle.evidence[0].id], payload.evidence[0].hint);
  assert.equal(view.resolution, undefined);
  assert.equal(readLocal().sessions[hashToken(token)].state.studied.length, 1);
  await assert.rejects(loadSession(token, "visitor-b"), { code: "SESSION_NOT_FOUND" });
  const wrong = bundle.suspects[(payload.culprit_index + 1) % 3].id;
  const incorrect = await updateSession(token, player, { type: "verdict", id: wrong });
  assert.equal(incorrect.correct, false); assert.equal(incorrect.session.resolution, undefined);
  await assert.rejects(updateSession(token, player, { type: "verdict", id: wrong }), { code: "SUSPECT_ALREADY_CHECKED" });
  const correct = await updateSession(token, player, { type: "verdict", id: bundle.suspects[payload.culprit_index].id });
  assert.equal(correct.correct, true); assert.equal(correct.session.score, 85);
  assert.equal(correct.session.breakdown.mistakesPenalty, 5);
  assert.equal(correct.session.resolution.suspectName, payload.suspects[payload.culprit_index].name);
  await assert.rejects(updateSession(token, player, { type: "hint", id: bundle.evidence[1].id }), { code: "SESSION_COMPLETED" });
  view = snapshot(await loadSession(token, player)); assert.equal(view.score, 85);
  const history = await getHistory(player); assert.equal(history.length, 1); assert.equal(statistics(history).bestScore, 85);
  assert.equal((await getHistory("visitor-b")).length, 0);
  const restarted = await startGameSession(bundle.case.id, player);
  assert.notEqual(restarted.session.id, started.session.id); assert.equal(restarted.session.hintsUsed, 0);
  assert.equal((await getHistory(player)).length, 1);
});

test("foreign evidence, unknown suspects and expired sessions return distinct errors", async () => {
  const bundle = registerLocalCase(generateLocalCase());
  const second = registerLocalCase(generateLocalCase());
  const { token } = await startGameSession(bundle.case.id, "visitor-errors");
  await assert.rejects(updateSession(token, "visitor-errors", { type: "evidence", id: second.evidence[0].id }), { code: "EVIDENCE_NOT_FOUND" });
  await assert.rejects(updateSession(token, "visitor-errors", { type: "verdict", id: second.suspects[0].id }), { code: "SUSPECT_NOT_FOUND" });
  changeLocal((data) => { data.sessions[hashToken(token)].expiresAt = new Date(Date.now() - 1000).toISOString(); });
  await assert.rejects(updateSession(token, "visitor-errors", { type: "hint", id: bundle.evidence[0].id }), { code: "SESSION_EXPIRED" });
});

test("score explains deductions and clamps to zero", () => {
  assert.deepEqual(calculateScore(240, 1, 1), { base: 100, hintsPenalty: 10, timePenalty: 8, mistakesPenalty: 5, total: 77 });
  assert.equal(calculateScore(1800, 8, 2).total, 0);
});

test("generated case validation rejects duplicate suspects, evidence, spoilers and chronology errors", () => {
  const good = generateLocalCase(); validateGeneratedCase(good); validateGeneratedCase(getFallbackCase());
  const duplicate = structuredClone(good); duplicate.suspects[1].name = duplicate.suspects[0].name;
  assert.throws(() => validateGeneratedCase(duplicate), /Duplicate suspects/);
  const repeated = structuredClone(good); repeated.evidence[1] = repeated.evidence[0];
  assert.throws(() => validateGeneratedCase(repeated));
  const spoiler = structuredClone(good); spoiler.evidence[0].hint = "Виновник: " + spoiler.suspects[spoiler.culprit_index].name;
  assert.throws(() => validateGeneratedCase(spoiler), /answer/);
  const time = structuredClone(good); time.evidence[1].content.lines.reverse();
  assert.throws(() => validateGeneratedCase(time), /timeline/);
});

test("AI retries malformed output, retains successful output locally and provides explicit fallback", async () => {
  const fetchOriginal = global.fetch;
  process.env.OPENROUTER_API_KEY = "test-only-placeholder";
  let calls = 0;
  const payload = generateLocalCase();
  global.fetch = async (_url, options) => {
    calls++;
    if (calls === 2) assert(JSON.parse(options.body).messages[0].content.includes("JSON"), "Retry includes validation feedback");
    return Response.json({ choices: [{ message: { content: calls === 1 ? "invalid JSON" : "```json\n" + JSON.stringify(payload) + "\n```" } }] });
  };
  try {
    const result = await generateCase("previous", "ai");
    assert.equal(calls, 2); assert.equal(result.generation.mode, "ai"); assert.equal(result.bundle.case.title, payload.title);
    assert(!JSON.stringify(result).includes("culprit"));
    global.fetch = async () => Response.json({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(payload) } }] });
    await assert.rejects(generateCase("previous", "ai"), { code: "AI_UNAVAILABLE" });
    global.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(generateCase("previous", "ai"), { code: "AI_PROVIDER_UNAVAILABLE" });
    const fallback = await generateCase("previous", "auto"); assert.equal(fallback.generation.mode, "local");
    const fixed = await generateCase("", "fallback"); assert.equal(fixed.bundle.case.title, getFallbackCase().title);
    let limitedCalls = 0;
    global.fetch = async () => { limitedCalls++; return new Response("limited", { status: 429, headers: { "Retry-After": "60" } }); };
    await assert.rejects(generateCase("", "ai"), (error) => error.code === "AI_RATE_LIMITED" && error.details.upstreamStatus === 429 && error.details.retryAfterSeconds === 60);
    assert.equal(limitedCalls, 1, "Do not immediately retry a rate-limited model");
    let overloadedCalls = 0;
    global.fetch = async () => { overloadedCalls++; return Response.json({ error: { code: 503, message: "Upstream error from Nvidia: Service temporarily overloaded" } }); };
    await assert.rejects(generateCase("", "ai"), (error) => error.code === "AI_PROVIDER_UNAVAILABLE" && error.details.upstreamStatus === 503);
    assert.equal(overloadedCalls, 2);
    let recoveredCalls = 0;
    global.fetch = async () => ++recoveredCalls === 1 ? Response.json({ error: { code: 503 } }) : Response.json({ choices: [{ message: { content: JSON.stringify(payload) } }] });
    assert.equal((await generateCase("", "ai")).generation.mode, "ai");
    global.fetch = async () => Response.json({ error: { code: 402, message: "No credits" } });
    await assert.rejects(generateCase("", "ai"), { code: "AI_CREDITS_REQUIRED" });
    global.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
    await assert.rejects(generateCase("", "ai"), { code: "AI_TIMEOUT" });
    global.fetch = async () => ({ json: async () => { throw new DOMException("Body timed out", "TimeoutError"); } });
    await assert.rejects(generateCase("", "ai"), { code: "AI_TIMEOUT" });
  } finally { global.fetch = fetchOriginal; delete process.env.OPENROUTER_API_KEY; }
});
