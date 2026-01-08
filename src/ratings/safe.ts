// src/ratings/safe.ts

import {updateRatings, updateEloRatings} from "./index";
import {ValidationException} from "../validations/errors";
import {
  validateRatingRequest,
  validateRatingResult,
} from "../validations/ratings";
import type {
  EloMatch,
  EloOptions,
  EloUpdateResult,
  RatingRequest,
} from "./types";
import type {PlayerID} from "../standings/types";

export function updateRatingsSafe(req: unknown) {
  const r = validateRatingRequest(req);
  if (!r.ok) throw new ValidationException(r.errors);

  try {
    const out = updateRatings(r.value);

    const vr = validateRatingResult(out, r.value);
    if (!vr.ok) throw new ValidationException(vr.errors);

    return out;
  } catch (err) {
    if (err instanceof ValidationException) throw err;

    if (err instanceof Error) {
      throw new ValidationException([
        {path: "req", code: "custom", message: err.message},
      ]);
    }

    throw err;
  }
}

/**
 * Convenience safe wrapper for the direct ELO API.
 * Validates using the same RatingRequest schema internally.
 */
export function updateEloRatingsSafe(
  base: unknown,
  matches: unknown,
  options?: unknown
): EloUpdateResult {
  const req: RatingRequest = {
    mode: "elo",
    base: (base ?? {}) as Record<PlayerID, number>,
    matches: (matches ?? []) as EloMatch[],
    options: options as EloOptions | undefined,
  };

  // Reuse the same safe path (request + result validation + engine wrapping)
  return updateRatingsSafe(req) as EloUpdateResult;
}
