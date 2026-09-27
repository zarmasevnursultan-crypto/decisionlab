import type { CaseBundle } from "./case-types";

export function publicCase(bundle: CaseBundle): CaseBundle {
  return {
    source: bundle.source,
    case: { id: bundle.case.id, title: bundle.case.title, briefing: bundle.case.briefing, created_at: bundle.case.created_at },
    suspects: bundle.suspects.map(({ id, case_id, name, role, description }) => ({ id, case_id, name, role, description })),
    evidence: bundle.evidence.map(({ id, case_id, type, section, title, subtitle, danger, content, position }) => ({ id, case_id, type, section, title, subtitle, danger, content, position, hint: "" })),
  };
}
