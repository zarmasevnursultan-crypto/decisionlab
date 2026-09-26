import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("../lib/fallback-case.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""));
const nonempty = value => typeof value === "string" && value.trim().length > 0;
assert(nonempty(data.title) && nonempty(data.briefing));
assert(data.suspects.length >= 2 && data.suspects.length <= 3);
assert(Number.isInteger(data.culprit_index) && data.culprit_index >= 0 && data.culprit_index < data.suspects.length);
assert(data.evidence.length >= 6 && data.evidence.length <= 8);
for (const suspect of data.suspects) {
  for (const key of ["name", "role", "description"]) assert(nonempty(suspect[key]), key);
}
for (const item of data.evidence) {
  assert(["mail", "logs", "files", "people"].includes(item.section));
  for (const key of ["title", "subtitle", "hint"]) assert(nonempty(item[key]), key);
  assert.equal(typeof item.danger, "boolean");
  const c = item.content;
  switch (item.type) {
    case "log":
      assert(c.lines.length > 0);
      for (const line of c.lines) assert(nonempty(line.text) && typeof line.anomaly === "boolean");
      break;
    case "metadata":
      assert(c.entries.length > 0);
      for (const entry of c.entries) assert(nonempty(entry.key) && nonempty(entry.value));
      break;
    case "network":
      assert(c.connections.length > 0);
      for (const edge of c.connections) assert(nonempty(edge.from) && nonempty(edge.to) && nonempty(edge.label) && typeof edge.anomaly === "boolean");
      break;
    case "testimony": assert(nonempty(c.speaker) && nonempty(c.quote)); break;
    default: assert.fail(`Unknown evidence type: ${item.type}`);
  }
}
assert.equal(new Set(data.evidence.map(item => item.type)).size, 4);
console.log(`Fallback valid: ${data.suspects.length} suspects, ${data.evidence.length} artifacts, all 4 types.`);
