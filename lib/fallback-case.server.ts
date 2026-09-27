import "server-only";
import data from "./fallback-case.json";
import type { EvidenceContent, EvidenceSection, EvidenceType } from "./case-types";

export type GeneratedCase = {
  title: string;
  briefing: string;
  suspects: { name: string; role: string; description: string }[];
  culprit_index: number;
  evidence: {
    type: EvidenceType; section: EvidenceSection; title: string; subtitle: string;
    danger: boolean; content: EvidenceContent; hint: string;
  }[];
};

// The JSON includes the answer. Import this server-only module, never the JSON in a client component.
export function getFallbackCase(): GeneratedCase {
  return structuredClone(data) as GeneratedCase;
}
