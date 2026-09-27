import { create } from "zustand";

type GameState = {
  foundEvidenceIds: string[];
  hintsUsed: number;
  usedHintIds: string[];
  markEvidenceFound: (evidenceId: string) => void;
  recordHint: (evidenceId: string, total: number) => void;
  clearEvidence: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  foundEvidenceIds: [],
  hintsUsed: 0,
  usedHintIds: [],
  markEvidenceFound: (evidenceId) =>
    set((state) => state.foundEvidenceIds.includes(evidenceId)
      ? state
      : { foundEvidenceIds: [...state.foundEvidenceIds, evidenceId] }),
  recordHint: (evidenceId, total) => set((state) => state.usedHintIds.includes(evidenceId)
    ? state
    : { usedHintIds: [...state.usedHintIds, evidenceId], hintsUsed: total }),
  clearEvidence: () => set({ foundEvidenceIds: [], hintsUsed: 0, usedHintIds: [] }),
}));
