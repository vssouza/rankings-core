// src/pairings/index.ts
import type { StandingRow, PlayerID, Match } from '../standings/types';
import {
  generateSwissPairings,
  type SwissPairingOptions,
  type SwissPairingResult,
} from './swiss';
import {
  buildRoundRobinSchedule,
  getRoundRobinRound,
  type RoundRobinOptions,
  type RoundDefinition,
} from './roundrobin';

// --- single-elimination imports
import {
  generateSingleEliminationBracket,
  type SeedEntry as SingleElimSeedEntry,
  type Bracket as SingleElimBracket,
} from './singleelimination';

export type PairingMode = 'swiss' | 'roundrobin' | 'singleelimination';

export type PairingRequest =
  | {
      mode: 'swiss';
      standings: ReadonlyArray<StandingRow>;
      history: ReadonlyArray<Match>;
      options?: SwissPairingOptions;
    }
  | {
      mode: 'roundrobin';
      players: ReadonlyArray<PlayerID>;
      roundNumber: number; // 1-based
      options?: RoundRobinOptions;
    }
  | {
      mode: 'singleelimination';
      seeds: ReadonlyArray<SingleElimSeedEntry>; // { playerId, seed }
      options?: { bestOf?: number; thirdPlace?: boolean };
      /**
       * Optional: which round to extract pairings for (1-based).
       * If omitted, returns round 1. The full bracket is always returned in `bracket`.
       */
      roundNumber?: number;
    };

/** Normalized result shape for the facade. */
export interface PairingResult {
  pairings: { a: PlayerID; b: PlayerID }[];
  bye?: PlayerID;
  // Swiss-only
  downfloats?: Record<PlayerID, number>;
  rematchesUsed?: { a: PlayerID; b: PlayerID }[];
  // RR-only and Single-Elim also use this multi-bye field
  round?: number;
  byes?: PlayerID[];
  // single-elim
  bracket?: SingleElimBracket;
}

/** Strategy facade for pairing generation. */
export function generatePairings(req: PairingRequest): PairingResult {
  if (req.mode === 'swiss') {
    const r = generateSwissPairings(req.standings, req.history, req.options);
    return {
      pairings: r.pairings,
      bye: r.bye,
      downfloats: r.downfloats,
      rematchesUsed: r.rematchesUsed,
    };
  }

  if (req.mode === 'roundrobin') {
    const rd: RoundDefinition = getRoundRobinRoundOrThrow(
      req.players,
      req.roundNumber,
      req.options,
    );
    return {
      pairings: rd.pairings,
      bye: rd.byes[0],
      round: rd.round,
      byes: rd.byes,
    };
  }

  if (req.mode === 'singleelimination') {
    // NOTE: Array.from() coerces ReadonlyArray -> mutable array to satisfy older generator signature
    const bracket = generateSingleEliminationBracket(Array.from(req.seeds), req.options);
    const roundNumber = Math.max(1, Math.floor(req.roundNumber ?? 1));
    const round = bracket.rounds[roundNumber - 1] ?? [];

    const pairings: { a: PlayerID; b: PlayerID }[] = [];
    const byes: PlayerID[] = [];

    for (const m of round) {
      const a = slotPlayerId(m.a);
      const b = slotPlayerId(m.b);
      if (a && !b) byes.push(a);
      else if (b && !a) byes.push(b);
      else if (a && b) pairings.push({ a, b });
    }

    return {
      pairings,
      round: roundNumber,
      byes: byes.length ? byes : undefined,
      bracket,
    };
  }

  // Exhaustiveness guard for future modes
  const _exhaustive: never = req;
  return _exhaustive;
}

// helper with better typing
function getRoundRobinRoundOrThrow(
  players: ReadonlyArray<PlayerID>,
  round: number,
  opts?: RoundRobinOptions,
): RoundDefinition {
  return getRoundRobinRound(players, round, opts);
}

// ------------------------------
// Back-compat export (soft-deprecate)
// ------------------------------
/**
 * @deprecated Use `generatePairings` with `{ mode: 'swiss', ... }`
 * or call `generateSwissPairings` directly.
 */

export function generatePairingsDeprecated(
  standings: ReadonlyArray<StandingRow>,
  history: ReadonlyArray<Match>,
  options?: SwissPairingOptions,
): SwissPairingResult {
  return generateSwissPairings(standings, history, options);
}

// Re-exports (public API surface)
export {
  generateSwissPairings,
  type SwissPairingOptions,
  type SwissPairingResult,
} from './swiss';

export {
  buildRoundRobinSchedule,
  getRoundRobinRound,
  type RoundRobinOptions,
  type RoundDefinition,
} from './roundrobin';

// Single-elimination public surface
export {
  generateSingleEliminationBracket,
  type SeedEntry as SingleElimSeedEntry,
  type Bracket as SingleElimBracket,
} from './singleelimination';

// ------------------------------
// local helpers
// ------------------------------
function slotPlayerId(
  s?: { kind: 'seed'; playerId: PlayerID } | { kind: 'winner'; fromMatchId: string } | { kind: 'bye' }
): PlayerID | undefined {
  if (!s) return undefined;
  return s.kind === 'seed' ? s.playerId : undefined;
}
