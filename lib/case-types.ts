export type EvidenceType = "log" | "metadata" | "network" | "testimony";
export type EvidenceSection = "mail" | "logs" | "files" | "people";
export type EvidenceContent =
  | { lines: { text: string; anomaly: boolean }[] }
  | { entries: { key: string; value: string }[] }
  | { connections: { from: string; to: string; label: string; anomaly: boolean }[] }
  | { speaker: string; quote: string };
export type PublicCase = { id: string; title: string; briefing: string; created_at: string };
export type Suspect = { id: string; case_id: string; name: string; role: string; description: string };
export type Evidence = {
  id: string; case_id: string; type: EvidenceType; section: EvidenceSection;
  title: string; subtitle: string; danger: boolean; content: EvidenceContent;
  hint: string; position: number;
};
