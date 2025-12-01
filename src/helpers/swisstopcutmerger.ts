// src/helpers/swisstopcutmerger.ts
// Merge Swiss standings + top cut standings into a single final table.

/**
 * This helper is intentionally **purely order-based**:
 *
 * - It uses Swiss rows as the source of truth for each player's data.
 * - It uses the top-cut standings ONLY to decide which players go
 *   to the top and in what order.
 * - It then re-numbers `rank` from 1..N in the merged array.
 *
 * Typical pipeline:
 *
 *   const swiss = computeStandings({ mode: 'swiss', matches, options });
 *   const seeds = computeTopCutSeeds(swiss, 8);
 *   const bracket = generateSingleEliminationBracket(seeds, { thirdPlace: true });
 *   // ... play out the bracket, adapt matches into standings matches ...
 *   const topCut = computeStandings({
 *     mode: 'singleelimination',
 *     matches: seMatches,
 *     options: { ... }
 *   });
 *
 *   const final = mergeSwissTopCutStandings(swiss, topCut);
 *
 * `final` is a plain StandingRow[] where:
 *   - All top-cut players appear first, ordered by their top-cut rank.
 *   - All remaining players follow, ordered by their Swiss rank.
 *   - `rank` is recomputed 1..N.
 */

import type {
  PlayerID,
  StandingRow,
} from "../standings/types";

// Minimal shape we need from the top-cut standings.
// SingleEliminationStandingRow is structurally compatible with this.
export interface TopCutStandingLike {
  playerId: PlayerID;
  /**
   * Top-cut position (1 = champion, 2 = finalist, etc.).
   * This is what we use to order the cut players at the top.
   */
  rank: number;
  /**
   * Optional: if your top-cut rows also carry an eliminationRound
   * (like SingleEliminationStandingRow), you can keep it here.
   * The merger itself does not currently use this field, but tests
   * and consumers are free to pass it through.
   */
  eliminationRound?: number;
}

/**
 * Merge Swiss standings and top-cut standings into a single final table.
 *
 * @param swissStandings  Final Swiss standings (usually from computeStandings(mode: 'swiss')).
 * @param topCutStandings Final top-cut standings
 *                        (e.g. from computeStandings(mode: 'singleelimination')).
 *
 * @returns New array of StandingRow, re-ranked from 1..N:
 *          - Top-cut players first, by top-cut rank.
 *          - Remaining players afterward, by Swiss rank.
 */
export function mergeSwissTopCutStandings<
  T extends StandingRow,
  U extends TopCutStandingLike
>(
  swissStandings: ReadonlyArray<T>,
  topCutStandings: ReadonlyArray<U>
): T[] {
  // Fast path: no top cut, just normalize ranks and return a shallow copy.
  if (!topCutStandings.length) {
    const out = swissStandings.map((row) => ({ ...row }));
    out.sort(bySwissOrder);
    out.forEach((row, idx) => {
      row.rank = idx + 1;
    });
    return out;
  }

  // Index Swiss rows by playerId for quick lookup.
  const swissById: Record<PlayerID, T> = Object.create(null);
  for (const row of swissStandings) {
    swissById[row.playerId] = row;
  }

  // 1) Top-cut players in top-cut rank order.
  const topCutSorted = [...topCutStandings].sort((a, b) => {
    const dr = (a.rank ?? 0) - (b.rank ?? 0);
    if (dr !== 0) return dr;
    // extremely rare tie: keep deterministic
    return a.playerId.localeCompare(b.playerId);
  });

  const seen = new Set<PlayerID>();
  const merged: T[] = [];

  for (const tc of topCutSorted) {
    const base = swissById[tc.playerId];
    if (!base) {
      // Defensive: if the top-cut standings mention a player
      // that isn't in Swiss, just skip them.
      continue;
    }
    seen.add(tc.playerId);
    merged.push({ ...base, rank: 0 });
  }

  // 2) Remaining field in Swiss order (excluding top-cut players).
  const swissRemainder = swissStandings
    .filter((row) => !seen.has(row.playerId))
    .map((row) => ({ ...row }));

  swissRemainder.sort(bySwissOrder);

  // 3) Concatenate and recompute global rank.
  const all = merged.concat(swissRemainder);
  all.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  return all;
}

// ---------- internal helpers ----------

// Consistent Swiss ordering (rank asc → tie-breakers → playerId)
function bySwissOrder(a: StandingRow, b: StandingRow): number {
  const ra = a.rank ?? 0;
  const rb = b.rank ?? 0;

  if (ra !== rb) return ra - rb;

  // Fallback to the same tie-break chain used in Swiss/RR engines
  if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
  if (Math.abs(b.omwp - a.omwp) > 1e-12) return b.omwp - a.omwp;
  if (Math.abs(b.gwp - a.gwp) > 1e-12) return b.gwp - a.gwp;
  if (Math.abs(b.ogwp - a.ogwp) > 1e-12) return b.ogwp - a.ogwp;
  if (Math.abs(b.sb - a.sb) > 1e-12) return b.sb - a.sb;

  return a.playerId.localeCompare(b.playerId);
}
