import type { Evidence, PublicCase, Suspect } from "./case-types";

type CaseRow = PublicCase & { culprit_id: string | null };
type SessionRow = {
  id: string; case_id: string; token_hash: string; started_at: string;
  expires_at: string; hints_used: number; completed_at: string | null;
};
type AttemptRow = {
  id: string; session_id: string; case_id: string; suspect_id: string;
  correct: boolean; score: number; created_at: string;
};
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};
// Mirrors the checked-in migration; regenerate with Supabase CLI after deployment.
export type Database = {
  public: {
    Tables: {
      cases: Table<CaseRow, "title" | "briefing">;
      suspects: Table<Suspect, "case_id" | "name" | "role" | "description">;
      evidence: Table<Evidence, "case_id" | "type" | "section" | "title" | "subtitle" | "content" | "hint" | "position">;
      sessions: Table<SessionRow, "case_id" | "token_hash">;
      attempts: Table<AttemptRow, "session_id" | "case_id" | "suspect_id" | "correct" | "score">;
    };
    Views: { public_cases: { Row: PublicCase; Relationships: [] } };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
