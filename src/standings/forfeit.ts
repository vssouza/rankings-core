// src/standings/forfeit.ts
// Helpers for handling "forfeit" retirements in Swiss-style events.

import type { Match, PlayerID } from "./types";
import { MatchResult } from "./types";

export interface ForfeitRetirementInput {
  /**
   * Round number (1-based) for which we are applying forfeits.
   * This should be the round whose pairings you already generated.
   */
  round: number;

  /**
   * Pairings for this round (typically from generateSwissPairings or your own logic).
   * Only concrete pairings (a,b); BYEs should not be included here.
   */
  pairings: ReadonlyArray<{ a: PlayerID; b: PlayerID }>;

  /**
   * Players who are retiring *with forfeit* in this round.
   * For each pairing where exactly one side is retired, we will synthesize a
   * FORFEIT_WIN for the opponent and FORFEIT_LOSS for the retired player.
   */
  retired: ReadonlyArray<PlayerID>;

  /**
   * Optional: existing matches for this event.
   * Used to avoid synthesizing duplicate results if a real result already exists
   * for (playerId, opponentId, round).
   */
  existingMatches?: ReadonlyArray<Match>;

  /**
   * Optional prefix for generated match ids.
   * Default: "FORFEIT".
   */
  idPrefix?: string;
}

/**
 * Create mirrored FORFEIT_WIN / FORFEIT_LOSS matches for the given round's pairings,
 * where exactly one side of a pairing is in the `retired` list.
 *
 * Behaviour:
 *  - If both players in a pairing are retired → no synthetic match is created.
 *  - If neither is retired → no synthetic match is created.
 *  - If a result for this (unordered) pair+round already exists in existingMatches,
 *    no synthetic match is created (we assume the round was actually played).
 *
 * Note:
 *  - We do NOT set gameWins/gameLosses here; they stay undefined, so forfeit
 *    affects match points and match-based tiebreaks but not GWP/OGWP.
 */
export function createForfeitMatchesForRetirements(
  input: ForfeitRetirementInput
): Match[] {
  const {
    round,
    pairings,
    retired,
    existingMatches = [],
    idPrefix = "FORFEIT",
  } = input;

  const retiredSet = new Set<PlayerID>(retired);

  const pairKey = (p1: PlayerID, p2: PlayerID, r: number): string => {
    const [a, b] = p1 < p2 ? [p1, p2] : [p2, p1];
    return `${r}::${a}::${b}`;
  };

  // Track pairs that already have a real match result recorded for this round
  const seenPairs = new Set<string>();
  for (const m of existingMatches) {
    if (m.round !== round) continue;
    if (m.opponentId === null) continue; // BYE; ignore
    seenPairs.add(pairKey(m.playerId, m.opponentId, m.round));
  }

  const out: Match[] = [];

  for (const p of pairings) {
    const { a, b } = p;
    const aRetired = retiredSet.has(a);
    const bRetired = retiredSet.has(b);

    // Only handle the case where exactly one side is retired
    if ((aRetired && bRetired) || (!aRetired && !bRetired)) continue;

    const key = pairKey(a, b, round);
    if (seenPairs.has(key)) {
      // A real result already exists for this pairing/round; do not override it.
      continue;
    }

    const loser: PlayerID = aRetired ? a : b;
    const winner: PlayerID = aRetired ? b : a;

    const baseId = `${idPrefix}-${round}-${winner}-vs-${loser}`;

    // Winner perspective
    out.push({
      id: `${baseId}-WIN`,
      round,
      playerId: winner,
      opponentId: loser,
      result: MatchResult.FORFEIT_WIN,
      // gameWins/gameLosses left undefined on purpose
    });

    // Loser perspective (mirrored)
    out.push({
      id: `${baseId}-LOSS`,
      round,
      playerId: loser,
      opponentId: winner,
      result: MatchResult.FORFEIT_LOSS,
    });

    seenPairs.add(key);
  }

  return out;
}
