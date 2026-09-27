import "server-only";
import { randomUUID } from "node:crypto";
import type { CaseBundle } from "./case-types";
import type { GeneratedCase } from "./fallback-case.server";
import { stableUuid } from "./stable-id.server";
import { changeLocal, readLocal } from "./local-storage.server";
import { publicCase } from "./public-case";


export function registerLocalCase(payload: GeneratedCase): CaseBundle {
  const now = Date.now();
  const id = randomUUID();
  const suspects = payload.suspects.map((person, index) => ({
    id: stableUuid(`${id}:suspect:${index}`), case_id: id,
    name: person.name, role: person.role, description: person.description,
  }));
  // Explicit allowlist: the answer must never enter the serialized bundle.
  const bundle: CaseBundle = {
    source: "local",
    case: { id, title: payload.title, briefing: payload.briefing, created_at: new Date(now).toISOString() },
    suspects,
    evidence: payload.evidence.map((item, position) => ({
      id: stableUuid(`${id}:evidence:${position}`), case_id: id, position,
      type: item.type, section: item.section, title: item.title, subtitle: item.subtitle,
      danger: item.danger, content: item.content, hint: item.hint,
    })),
  };
  changeLocal((data) => { data.cases[id] = { bundle, culpritId: suspects[payload.culprit_index].id }; });
  return publicCase(bundle);
}

export function getLocalCase(id: string) {
  return readLocal().cases[id] ?? null;
}
