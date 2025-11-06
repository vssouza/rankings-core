// src/pairings/singleelimination.ts
// Single Elimination pairings + bracket utilities for rankings-core
// Zero-deps, deterministic, seed-based placement with optional bronze match.

export type PlayerId = string;

export type SeedEntry = {
  playerId: PlayerId;
  seed: number; // 1 = top seed
};

export type Slot =
  | { kind: 'seed'; seed: number; playerId: PlayerId }
  | { kind: 'winner'; fromMatchId: string }
  | { kind: 'bye' };

export type MatchId = string; // e.g., "R1-M3"

export type Match = {
  id: MatchId;
  round: number;         // 1-based
  indexInRound: number;  // 1-based
  bestOf: number;        // odd integer >=1
  a?: Slot;
  b?: Slot;
  winnerTo?: MatchId;    // next match for the winner
  loserTo?: MatchId;     // only used when thirdPlace = true for the two semifinals
  // Stored result so tests/adapters can read it later (optional)
  result?: { winnerId: PlayerId; loserId?: PlayerId; reason?: 'bye' | 'dq' | 'walkover' | 'forfeit' };
};

export type Bracket = {
  rounds: Match[][];     // rounds[0] is R1, etc.
  thirdPlace?: Match;    // optional bronze match
  meta: {
    size: number;        // power-of-two bracket size
    entrants: number;    // actual player count
    byes: number;
    thirdPlace: boolean;
  };
};

export type GenerateOptions = {
  bestOf?: number;       // default 1
  thirdPlace?: boolean;  // default false (creates bronze match if true)
};

/**
 * Generate a single-elimination bracket from seeded entrants.
 * - Deterministic, seed-driven placement using standard interleaving (1 vs N, 2 vs N-1, ...)
 * - Auto-inserts BYEs for top seeds when entrants < next power-of-two size.
 * - Builds winner routing and (optional) bronze match routing.
 */
export function generateSingleEliminationBracket(
  seedsIn: ReadonlyArray<SeedEntry>,
  opts: GenerateOptions = {}
): Bracket {
  if (!seedsIn.length) throw new Error('generateSingleEliminationBracket: no entrants');

  const bestOf = normalizeBestOf(opts.bestOf ?? 1);
  const thirdPlace = !!opts.thirdPlace;

  // Normalize + sort by seed asc (1 is best)
  const seeds = [...seedsIn].sort((a, b) => a.seed - b.seed);

  // Compute bracket size (power of two >= entrants)
  const entrants = seeds.length;
  const size = nextPow2(entrants);
  const byes = size - entrants;

  // Bracket position seed numbers in interleaved order: [1, N, 4, N-3, ...]
  const positions = seedPositions(size);

  // Map bracket positions -> Slot (seeded player or BYE)
  const slots: (Slot | undefined)[] = new Array(size);
  const seedMap = new Map<number, SeedEntry>();
  for (const s of seeds) seedMap.set(s.seed, s);

  for (let i = 0; i < size; i++) {
    const seedNumAtPos = positions[i];
    const entrant = seedMap.get(seedNumAtPos);
    if (entrant) {
      slots[i] = { kind: 'seed', seed: entrant.seed, playerId: entrant.playerId };
    } else {
      // entrants < size → this spot is a BYE
      slots[i] = { kind: 'bye' };
    }
  }

  // Round 1 matches pair adjacent slots: (0,1), (2,3), ...
  const rounds: Match[][] = [];
  const round1: Match[] = [];
  for (let i = 0; i < size; i += 2) {
    const idxInRound = i / 2 + 1;
    const id = makeMatchId(1, idxInRound);
    round1.push({
      id,
      round: 1,
      indexInRound: idxInRound,
      bestOf,
      a: slots[i],
      b: slots[i + 1],
    });
  }
  rounds.push(round1);

  // Build subsequent rounds and wire winnerTo links
  let prev = round1;
  let roundNum = 2;
  while (prev.length > 1) {
    const curr: Match[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const idxInRound = i / 2 + 1;
      const id = makeMatchId(roundNum, idxInRound);
      const m: Match = { id, round: roundNum, indexInRound: idxInRound, bestOf };
      // winners of prev[i] and prev[i+1] feed into this match
      prev[i].winnerTo = id;
      prev[i + 1].winnerTo = id;
      // initial unresolved slots reference earlier matches
      m.a = { kind: 'winner', fromMatchId: prev[i].id };
      m.b = { kind: 'winner', fromMatchId: prev[i + 1].id };
      curr.push(m);
    }
    rounds.push(curr);
    prev = curr;
    roundNum++;
  }

  // Optional bronze (third place) match: losers of the two semifinals
  let thirdPlaceMatch: Match | undefined;
  if (thirdPlace && rounds.length >= 2) {
    const semis = rounds[rounds.length - 2];
    if (semis.length === 2) {
      thirdPlaceMatch = {
        id: 'BRONZE',
        round: rounds.length, // conceptually same day as finals
        indexInRound: 1,
        bestOf,
        a: { kind: 'winner', fromMatchId: semis[0].id }, // loser routed via applyResult
        b: { kind: 'winner', fromMatchId: semis[1].id },
      };
      semis[0].loserTo = thirdPlaceMatch.id;
      semis[1].loserTo = thirdPlaceMatch.id;
    }
  }

  const bracket: Bracket = {
    rounds,
    thirdPlace: thirdPlaceMatch,
    meta: { size, entrants, byes, thirdPlace },
  };

  // Auto-advance BYE matches (only Round 1 can contain BYEs)
  autoAdvanceByes(bracket);

  return bracket;
}

/** Apply a result and advance winner (and bronze loser routing if enabled). */
export function applyResult(
  bracket: Bracket,
  matchId: MatchId,
  outcome: { winner: 'A' | 'B' | PlayerId; loserReason?: 'bye' | 'dq' | 'walkover' | 'forfeit' }
): void {
  const { match, parent, parentIdx } = findMatch(bracket, matchId);
  if (!match) throw new Error(`applyResult: match ${matchId} not found`);

  const aId = slotPlayerId(match.a);
  const bId = slotPlayerId(match.b);
  if (!aId && !bId) throw new Error(`applyResult: match ${matchId} has no players`);

  let winnerId: PlayerId | undefined;
  if (outcome.winner === 'A') winnerId = aId;
  else if (outcome.winner === 'B') winnerId = bId;
  else winnerId = outcome.winner; // explicit id

  // BYE-friendly fallback: if caller used 'A'/'B' but that side is empty and the other exists with a BYE
  if (!winnerId && outcome.loserReason === 'bye') {
    if (aId && !bId) winnerId = aId;
    else if (bId && !aId) winnerId = bId;
  }
  // Final defensive fallback (auto-advance): if exactly one concrete side exists, it wins.
  if (!winnerId && (!!aId !== !!bId)) {
    winnerId = (aId ?? bId)!;
  }

  if (!winnerId) throw new Error(`applyResult: winner not resolved for ${matchId}`);

  // Persist result
  const loserIdComputed = winnerId === aId ? bId : aId;
  match.result = { winnerId, loserId: loserIdComputed, reason: outcome.loserReason };

  // Advance winner to next match
  if (match.winnerTo) {
    const { match: next } = findMatch(bracket, match.winnerTo);
    if (!next) throw new Error(`applyResult: next match ${match.winnerTo} missing`);

    // Prefer replacing the placeholder that referenced this match
    if (next.a && isWinnerSlotOf(next.a, match.id)) {
      next.a = { kind: 'seed', seed: 0, playerId: winnerId };
    } else if (next.b && isWinnerSlotOf(next.b, match.id)) {
      next.b = { kind: 'seed', seed: 0, playerId: winnerId };
    } else if (!next.a || !slotPlayerId(next.a)) {
      // Deterministic fallback: fill first open or non-concrete slot
      next.a = { kind: 'seed', seed: 0, playerId: winnerId };
    } else {
      next.b = { kind: 'seed', seed: 0, playerId: winnerId };
    }
  }

  // Route loser to bronze if configured
  if (match.loserTo) {
    const loserId = winnerId === aId ? bId : aId;
    if (loserId) {
      const { match: bronze } = findMatch(bracket, match.loserTo);
      if (!bronze) throw new Error(`applyResult: bronze match ${match.loserTo} missing`);
      if (!bronze.a || !slotPlayerId(bronze.a)) bronze.a = { kind: 'seed', seed: 0, playerId: loserId };
      else bronze.b = { kind: 'seed', seed: 0, playerId: loserId };
    }
  }

  // Persist structural mutation
  if (parent) parent[parentIdx] = match;
}

/**
 * Auto-advance BYE matches (one side BYE -> opponent advances; both BYE -> no-op).
 * Only Round 1 can contain BYEs in a standard single-elim bracket.
 */
export function autoAdvanceByes(bracket: Bracket): void {
  const r1 = bracket.rounds[0] ?? [];
  for (const m of r1) {
    const aBye = m.a?.kind === 'bye';
    const bBye = m.b?.kind === 'bye';
    if (aBye && !bBye) {
      const pid = slotPlayerId(m.b!);
      if (pid) applyResult(bracket, m.id, { winner: pid, loserReason: 'bye' });
    } else if (bBye && !aBye) {
      const pid = slotPlayerId(m.a!);
      if (pid) applyResult(bracket, m.id, { winner: pid, loserReason: 'bye' });
    }
  }
}

// ------------------------- helpers -------------------------

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function normalizeBestOf(n: number): number {
  const x = Math.max(1, Math.floor(n));
  return x % 2 === 1 ? x : x + 1; // force odd
}

function makeMatchId(round: number, index: number): MatchId {
  return `R${round}-M${index}`;
}

/** Standard interleaved seed order for a power-of-two bracket. */
export function seedPositions(size: number): number[] {
  if (size & (size - 1)) throw new Error('seedPositions: size must be power of two');
  const order: number[] = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(n + 1 - s);
    }
    order.splice(0, order.length, ...next);
  }
  return order;
}

function slotPlayerId(s?: Slot): PlayerId | undefined {
  if (!s) return undefined;
  if (s.kind === 'seed') return s.playerId;
  return undefined; // winner slots are unresolved until filled
}

function isWinnerSlotOf(s: Slot, fromId: string): boolean {
  return s.kind === 'winner' && s.fromMatchId === fromId;
}

function findMatch(bracket: Bracket, id: MatchId): { match?: Match; parent?: Match[]; parentIdx: number } {
  for (const round of bracket.rounds) {
    for (let i = 0; i < round.length; i++) {
      if (round[i].id === id) return { match: round[i], parent: round, parentIdx: i };
    }
  }
  if (bracket.thirdPlace && bracket.thirdPlace.id === id) {
    return { match: bracket.thirdPlace, parent: undefined, parentIdx: -1 };
  }
  return { parentIdx: -1 };
}

// --- compatibility alias so either name works in tests/imports ---
export const generateSingleElimBracket = generateSingleEliminationBracket;
