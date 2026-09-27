import type { ScoreBreakdown } from "./case-types";
export function calculateDisplayScore(seconds: number, hints: number, mistakes: number): ScoreBreakdown {
  const hintsPenalty = hints * 10, timePenalty = Math.floor(seconds / 30), mistakesPenalty = mistakes * 5;
  return { base: 100, hintsPenalty, timePenalty, mistakesPenalty, total: Math.max(0, 100 - hintsPenalty - timePenalty - mistakesPenalty) };
}
