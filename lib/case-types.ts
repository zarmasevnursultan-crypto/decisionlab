export type EvidenceType = "log" | "metadata" | "network" | "testimony";
export type CaseResolution = { suspectName: string; findings: { title: string; detail: string; explanation: string }[] };
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

// What the UI is allowed to see. Deliberately has no culprit_id / culprit_index anywhere
// on this type — the server loader must never put the answer in here.
export type CaseBundle = {
  source: "supabase" | "fallback" | "local";
  case: PublicCase;
  suspects: Suspect[];
  evidence: Evidence[];
};

export type ApiResponse<T> = { success: true; data: T; message: string } | { success: false; error: { code: string; message: string; details?: Record<string, string | number> } };
export type ScoreBreakdown = { base: number; hintsPenalty: number; timePenalty: number; mistakesPenalty: number; total: number };
export type InvestigationProgress = { studiedEvidence: number; totalEvidence: number; progress: number; hintsUsed: number; attempts: number; sections: Record<EvidenceSection, { studied: number; total: number }> };
export type SessionSnapshot = {
  id: string; revision: number; caseId: string; caseTitle: string; status: "active" | "completed" | "expired" | "abandoned";
  startedAt: string; completedAt: string | null; serverTime: string; elapsedSeconds: number; remainingSeconds: number;
  studiedEvidenceIds: string[]; usedHintIds: string[]; hints: Record<string, string>;
  attemptedSuspectIds: string[]; hintsUsed: number; attempts: number; wrongAttempts: number;
  score: number; breakdown: ScoreBreakdown; progress: InvestigationProgress; efficiency: number;
  resolution?: CaseResolution;
};
export type VerdictResult = { correct: boolean; session: SessionSnapshot };
export type HistoryEntry = { sessionId: string; caseId: string; title: string; completedAt: string; score: number; elapsedSeconds: number; hintsUsed: number; attempts: number; studiedEvidence: number; totalEvidence: number };
export type Statistics = { completed: number; averageScore: number; bestScore: number; averageSeconds: number; hintsUsed: number; attempts: number; sampleLimit: number };
export type HealthStatus = { status: "ok" | "degraded"; services: { application: "ok"; database: "ok" | "unavailable" | "not_configured"; ai: "configured_not_checked" | "not_configured" }; checkedAt: string };
export type GenerationResult = { bundle: CaseBundle; generation: { mode: "ai" | "local" | "fallback"; attempts: number; notice: string } };
