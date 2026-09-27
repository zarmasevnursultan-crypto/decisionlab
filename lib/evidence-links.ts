import type { CaseBundle, Evidence } from "./case-types";

export const evidenceText = (item: Evidence) => `${item.title} ${item.subtitle} ${JSON.stringify(item.content)}`;
// Shared identifiers are investigative leads, not conclusions about guilt.
export function evidenceLinks(item: Evidence, bundle: CaseBundle) {
  const text = evidenceText(item);
  const tokens = [...new Set(text.match(/\b[A-Z][A-Z0-9]*-[A-Z0-9]+\b|\b[\w.-]+\.(?:example|internal|zip|xlsx)\b/g) ?? [])];
  return bundle.evidence.filter((other) => other.id !== item.id).map((other) => ({ evidence: other, shared: tokens.filter((token) => evidenceText(other).includes(token)) })).filter((link) => link.shared.length > 0);
}
