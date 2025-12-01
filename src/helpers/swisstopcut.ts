// src/helpers/swisstopcut.ts
// Convenience helpers for building a top cut from Swiss standings.

import type { StandingRow } from "../standings/types";
import type { SeedEntry } from "../pairings/singleelimination";

export interface TopCutSeed extends SeedEntry {
  /** The Swiss rank this seed came from (1 = best). */
  sourceRank: number;
}

/**
 * Compute top-cut seeds from final Swiss standings.
 *
 * Typical usage:
 *   const swiss = computeStandings({ mode: 'swiss', ... });
 *   const seeds = computeTopCutSeeds(swiss, 8);
 *   const bracket = generateSingleEliminationBracket(seeds, { thirdPlace: true });
 *
 * Behaviour:
 * - Filters out rows with `retired === true` (dropped players can't make top cut).
 * - Sorts by Swiss `rank` ascending, then by tie-breaks as a safety net.
 * - Seeds are 1-based: best Swiss rank → seed 1, etc.
 * - `cutSize` is clamped to the number of eligible players.
 */
export function computeTopCutSeeds(
  swissStandings: ReadonlyArray<StandingRow>,
  cutSize: number
): TopCutSeed[] {
  if (!Number.isFinite(cutSize)) {
    throw new Error("computeTopCutSeeds: cutSize must be a finite number");
  }
  const size = Math.max(0, Math.floor(cutSize));
  if (size === 0) return [];

  // 1) Filter out retired / dropped players
  const eligible = swissStandings.filter((r) => !r.retired);

  if (eligible.length === 0) return [];

  // 2) Sort by Swiss rank first; fall back to tie-break fields if needed
  const sorted = [...eligible].sort((a, b) => {
    // primary: rank (1 = best)
    const r = (a.rank ?? 0) - (b.rank ?? 0);
    if (r !== 0) return r;

    // safety: tie-breaks in same order as Swiss engine
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (Math.abs(b.omwp - a.omwp) > 1e-12) return b.omwp - a.omwp;
    if (Math.abs(b.gwp - a.gwp) > 1e-12) return b.gwp - a.gwp;
    if (Math.abs(b.ogwp - a.ogwp) > 1e-12) return b.ogwp - a.ogwp;
    if (Math.abs(b.sb - a.sb) > 1e-12) return b.sb - a.sb;

    // last-resort stable ordering
    return a.playerId.localeCompare(b.playerId);
  });

  const slice = sorted.slice(0, Math.min(size, sorted.length));

  // 3) Map to SeedEntry + metadata
  return slice.map((row, idx) => ({
    playerId: row.playerId,
    seed: idx + 1,       // 1-based seeds
    sourceRank: row.rank // remember where they came from
  }));
}
