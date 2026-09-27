import { create } from "zustand";
import type { SessionSnapshot } from "./case-types";

type GameState = {
  session: SessionSnapshot | null;
  receivedAt: number;
  syncSession: (session: SessionSnapshot) => void;
};

// The server is authoritative. Zustand only mirrors acknowledged snapshots.
export const useGameStore = create<GameState>((set) => ({
  session: null,
  receivedAt: 0,
  syncSession: (session) => set((state) => {
    const current = state.session;
    if (current && (session.id === current.id ? session.revision < current.revision || (session.revision === current.revision && session.serverTime < current.serverTime) : session.startedAt < current.startedAt)) return state;
    return { session, receivedAt: Date.now() };
  }),
}));
