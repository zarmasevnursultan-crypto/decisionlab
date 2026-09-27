import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseBundle } from "./case-types";

export type PrivateCase = { bundle: CaseBundle; culpritId: string };
export type SessionState = { caseTitle: string; totalEvidence: number; studied: string[]; hints: string[]; attempts: { suspectId: string; correct: boolean; score: number }[]; abandonedAt: string | null };
export type StoredSession = {
  id: string; caseId: string; playerHash: string; tokenHash: string; startedAt: string; expiresAt: string;
  completedAt: string | null; revision: number; state: SessionState; privateCase: PrivateCase;
};
type LocalDatabase = { cases: Record<string, PrivateCase>; sessions: Record<string, StoredSession> };
// Single Node process, durable volume. All read/modify/write operations are synchronous and atomic.
const directory = () => process.env.DECISIONLAB_DATA_DIR || join(process.cwd(), ".decisionlab");
export function readLocal(): LocalDatabase {
  const path = join(directory(), "data.json");
  if (!existsSync(path)) return { cases: {}, sessions: {} };
  return JSON.parse(readFileSync(path, "utf8")) as LocalDatabase;
}
export function changeLocal<T>(update: (data: LocalDatabase) => T): T {
  const data = readLocal();
  const result = update(data);
  mkdirSync(directory(), { recursive: true });
  const path = join(directory(), "data.json");
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
  renameSync(temp, path);
  return result;
}
