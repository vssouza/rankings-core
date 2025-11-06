// test/pairings/singleelimination.test.ts
// Thorough test suite for single-elimination pairings & bracket utilities
// Framework: Vitest

import { describe, it, expect } from 'vitest';
import {
  seedPositions,
  generateSingleEliminationBracket,
  autoAdvanceByes,
  applyResult,
  type SeedEntry,
} from '../../src/pairings/singleelimination';

// ----------------------------- helpers -----------------------------
function idsOfRound(bracket: ReturnType<typeof generateSingleEliminationBracket>, round: number) {
  return bracket.rounds[round - 1].map((m) => m.id);
}

function slotPid(s: any): string | undefined {
  return s && s.kind === 'seed' ? s.playerId : undefined;
}

// ------------------------------ tests ------------------------------

describe('seedPositions()', () => {
  it('throws on non power-of-two', () => {
    expect(() => seedPositions(3)).toThrowError(/power of two/i);
    expect(() => seedPositions(6)).toThrowError(/power of two/i);
  });

  it('returns the standard interleaved order for size=2,4,8', () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('generateSingleEliminationBracket()', () => {
  it('errors when no entrants are provided', () => {
    expect(() => generateSingleEliminationBracket([], {})).toThrowError(/no entrants/i);
  });

  it('creates round ids and winner wiring for a full 8-player field', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'P1', seed: 1 },
      { playerId: 'P2', seed: 2 },
      { playerId: 'P3', seed: 3 },
      { playerId: 'P4', seed: 4 },
      { playerId: 'P5', seed: 5 },
      { playerId: 'P6', seed: 6 },
      { playerId: 'P7', seed: 7 },
      { playerId: 'P8', seed: 8 },
    ];
    const b = generateSingleEliminationBracket(seeds, { bestOf: 2 /* even → normalized to 3 */ });

    // meta
    expect(b.meta).toEqual({ size: 8, entrants: 8, byes: 0, thirdPlace: false });

    // round structure: 4 → 2 → 1
    expect(b.rounds.length).toBe(3);
    expect(idsOfRound(b, 1)).toEqual(['R1-M1', 'R1-M2', 'R1-M3', 'R1-M4']);
    expect(idsOfRound(b, 2)).toEqual(['R2-M1', 'R2-M2']);
    expect(idsOfRound(b, 3)).toEqual(['R3-M1']);

    // bestOf normalized to odd
    b.rounds.flat().forEach((m) => expect(m.bestOf % 2).toBe(1));

    // winner wiring from R1 to R2
    expect(b.rounds[0][0].winnerTo).toBe('R2-M1');
    expect(b.rounds[0][1].winnerTo).toBe('R2-M1');
    expect(b.rounds[0][2].winnerTo).toBe('R2-M2');
    expect(b.rounds[0][3].winnerTo).toBe('R2-M2');
  });

  it('inserts BYEs when entrants < power-of-two size and reports meta correctly', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
      { playerId: 'E', seed: 5 },
    ];
    const b = generateSingleEliminationBracket(seeds, {});
    expect(b.meta.size).toBe(8);
    expect(b.meta.byes).toBe(3);

    // first round has 4 matches; at least three BYE sides overall
    const byeCount = b.rounds[0].reduce(
      (acc, m) => acc + (m.a?.kind === 'bye' ? 1 : 0) + (m.b?.kind === 'bye' ? 1 : 0),
      0
    );
    expect(byeCount).toBeGreaterThanOrEqual(3);
  });
});

describe('autoAdvanceByes()', () => {
  it('advances entrants through single-sided BYE matches', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
      { playerId: 'E', seed: 5 },
    ];
    const b = generateSingleEliminationBracket(seeds, {});

    // After generation, autoAdvanceByes has already run once (R1 only).
    // Verify that some R2 slots have concrete players as a result.
    const r2 = b.rounds[1];
    expect(r2).toBeDefined();
    const anyFilled = r2.some((m) => slotPid(m.a) || slotPid(m.b));
    expect(anyFilled).toBe(true);

    // Re-running should be idempotent
    autoAdvanceByes(b);
    const anyFilled2 = r2.some((m) => slotPid(m.a) || slotPid(m.b));
    expect(anyFilled2).toBe(true);
  });
});

describe('applyResult()', () => {
  it('throws when match id is unknown', () => {
    const seeds: SeedEntry[] = [{ playerId: 'A', seed: 1 }, { playerId: 'B', seed: 2 }];
    const b = generateSingleEliminationBracket(seeds, {});
    expect(() => applyResult(b, 'NOPE', { winner: 'A' })).toThrow(/not found/i);
  });

  it('throws when both sides are empty (should not happen in normal generation)', () => {
    const seeds: SeedEntry[] = [{ playerId: 'A', seed: 1 }, { playerId: 'B', seed: 2 }];
    const b = generateSingleEliminationBracket(seeds, {});
    // surgically blank a match to simulate malformed state
    const m = b.rounds[0][0];
    (m as any).a = undefined; (m as any).b = undefined;
    expect(() => applyResult(b, m.id, { winner: 'A' })).toThrow(/has no players/i);
  });

  it('routes winners forward correctly in a 4-player bracket', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
    ];
    const b = generateSingleEliminationBracket(seeds, {});

    // Round 1 = semifinals (2 matches)
    const [sf1, sf2] = b.rounds[0];

    applyResult(b, sf1.id, { winner: 'A' });
    applyResult(b, sf2.id, { winner: 'D' });

    // Round 2 = final (1 match)
    const final = b.rounds[1][0];
    const fA = (final.a as any)?.playerId;
    const fB = (final.b as any)?.playerId;

    expect([fA, fB].sort()).toEqual(['A', 'D'].sort());
  });

  it('routes winners from quarterfinals to semis and then to final in an 8-player bracket', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
      { playerId: 'E', seed: 5 },
      { playerId: 'F', seed: 6 },
      { playerId: 'G', seed: 7 },
      { playerId: 'H', seed: 8 },
    ];
    const b = generateSingleEliminationBracket(seeds, {});

    // Round 1 = quarterfinals (4 matches)
    const [q1, q2, q3, q4] = b.rounds[0];
    applyResult(b, q1.id, { winner: 'A' });
    applyResult(b, q2.id, { winner: 'B' });
    applyResult(b, q3.id, { winner: 'C' });
    applyResult(b, q4.id, { winner: 'D' });

    // Round 2 = semifinals (2 matches)
    const [s1, s2] = b.rounds[1];
    applyResult(b, s1.id, { winner: 'A' });
    applyResult(b, s2.id, { winner: 'C' });

    // Round 3 = final
    const final = b.rounds[2][0];
    const fA = (final.a as any)?.playerId;
    const fB = (final.b as any)?.playerId;
    expect([fA, fB].sort()).toEqual(['A', 'C'].sort());
  });

  it('routes semifinal losers to bronze when thirdPlace=true (4 entrants)', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
    ];
    const b = generateSingleEliminationBracket(seeds, { thirdPlace: true });

    // Round 1 = semifinals
    const [s1, s2] = b.rounds[0];
    applyResult(b, s1.id, { winner: 'A' }); // loser is B
    applyResult(b, s2.id, { winner: 'C' }); // loser is D

    const bronze = b.thirdPlace!;
    const bronzeA = slotPid(bronze.a);
    const bronzeB = slotPid(bronze.b);
    expect([bronzeA, bronzeB].sort()).toEqual(['B', 'D'].sort());
  });

  it('accepts explicit winner by playerId in early-byed matches', () => {
    const seeds: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
      { playerId: 'E', seed: 5 }, // triggers BYEs to size 8
    ];
    const b = generateSingleEliminationBracket(seeds, {});

    // Find a round-1 match where A participates (possibly with a BYE) and mark A winner by id
    const r1 = b.rounds[0];
    const mA = r1.find((m) => slotPid(m.a) === 'A' || slotPid(m.b) === 'A')!;
    applyResult(b, mA.id, { winner: 'A' });

    // A should be placed in the wired next-round slot
    const next = b.rounds[1].find((m) => slotPid(m.a) === 'A' || slotPid(m.b) === 'A');
    expect(next).toBeDefined();
  });
});

describe('third place match shape', () => {
  it('is present only when thirdPlace=true and semis count is 2', () => {
    const seeds4: SeedEntry[] = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
    ];
    const b1 = generateSingleEliminationBracket(seeds4, { thirdPlace: true });
    expect(b1.thirdPlace?.id).toBe('BRONZE');

    const b2 = generateSingleEliminationBracket(seeds4, { thirdPlace: false });
    expect(b2.thirdPlace).toBeUndefined();
  });
});
