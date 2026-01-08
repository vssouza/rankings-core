// src/ratings/index.ts
import {updateEloRatings, expectedScore} from "./elo";
import {updateRatingsSafe, updateEloRatingsSafe} from "./safe";

export type {
  RatingMode,
  RatingRequest,
  RatingResult,
  EloMatch,
  EloOptions,
  EloUpdateResult,
  EloResult,
} from "./types";

export {
  // raw engines
  updateEloRatings,
  expectedScore,

  // safe wrappers
  updateRatingsSafe,
  updateEloRatingsSafe,
};

// Generic facade – lets callers choose a mode now or later
export function updateRatings(req: import("./types").RatingRequest) {
  if (req.mode === "elo") {
    const {base = {}, matches, options} = req;
    return updateEloRatings(base, matches, options);
  }

  throw new Error(`Unsupported rating mode: ${(req as any).mode}`);
}
