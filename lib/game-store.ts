import { create } from "zustand";

type GameState = {
  foundEvidenceIds: string[];
  markEvidenceFound: (evidenceId: string) => void;
  clearEvidence: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  foundEvidenceIds: [],
  markEvidenceFound: (evidenceId) =>
    set((state) => state.foundEvidenceIds.includes(evidenceId)
      ? state
      : { foundEvidenceIds: [...state.foundEvidenceIds, evidenceId] }),
  clearEvidence: () => set({ foundEvidenceIds: [] }),
}));
