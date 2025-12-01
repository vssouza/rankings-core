// test/e2e/singleelimination-doubleloss.e2e.ts
import { describe, it, expect } from 'vitest';
import { computeStandings, MatchResult } from '../../src';
import type { SingleEliminationStandingRow } from '../../src';

describe('single elimination e2e — double-loss final (no champion)', () => {
  it('handles a double loss in the FINAL (no champion) and uses seeding to order the two finalists', () => {
    // Bracket:
    // R1 (semis)
    //   A vs B  → A wins
    //   C vs D  → C wins
    //
    // R2 (final)
    //   A vs C  → both recorded as LOSS (double-loss final)
    //
    // Expectation:
    //   - No player gets "champion" eliminationRound (maxRound + 1)
    //   - A and C both have eliminationRound = 2
    //   - Seeding breaks tie between them: A (seed 1) above C (seed 2)
    //   - B and D eliminated in R1 (eliminationRound = 1)

    const matches = [
      // --- Semifinal 1: A vs B ---
      {
        id: 'sf1-a',
        round: 1,
        playerId: 'A',
        opponentId: 'B',
        result: MatchResult.WIN,
        gameWins: 2,
        gameLosses: 0,
        gameDraws: 0,
      },
      {
        id: 'sf1-b',
        round: 1,
        playerId: 'B',
        opponentId: 'A',
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
        gameDraws: 0,
      },

      // --- Semifinal 2: C vs D ---
      {
        id: 'sf2-c',
        round: 1,
        playerId: 'C',
        opponentId: 'D',
        result: MatchResult.WIN,
        gameWins: 2,
        gameLosses: 1,
        gameDraws: 0,
      },
      {
        id: 'sf2-d',
        round: 1,
        playerId: 'D',
        opponentId: 'C',
        result: MatchResult.LOSS,
        gameWins: 1,
        gameLosses: 2,
        gameDraws: 0,
      },

      // --- FINAL: A vs C — both recorded as LOSS (double loss) ---
      {
        id: 'f-a',
        round: 2,
        playerId: 'A',
        opponentId: 'C',
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
        gameDraws: 0,
      },
      {
        id: 'f-c',
        round: 2,
        playerId: 'C',
        opponentId: 'A',
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
        gameDraws: 0,
      },
    ];

    const rows = computeStandings({
      mode: 'singleelimination',
      matches,
      options: {
        eventId: 'SE-DOUBLE-LOSS',
        // Seeding used to order players eliminated in same round
        seeding: {
          A: 1,
          C: 2,
          B: 3,
          D: 4,
        },
      },
    }) as SingleEliminationStandingRow[];

    expect(rows.length).toBe(4);

    const byId: Record<string, SingleEliminationStandingRow> = Object.fromEntries(
      rows.map((r) => [r.playerId, r as SingleEliminationStandingRow]),
    );

    const a = byId['A'];
    const b = byId['B'];
    const c = byId['C'];
    const d = byId['D'];

    // Sanity: all players present
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
    expect(d).toBeDefined();

    // maxRound = 2 (final)
    // No-one should get eliminationRound = maxRound + 1 (3)
    expect(rows.every((r) => r.eliminationRound <= 2)).toBe(true);

    // Finalists both eliminated in round 2 (the final)
    expect(a.eliminationRound).toBe(2);
    expect(c.eliminationRound).toBe(2);

    // Semifinal losers eliminated in round 1
    expect(b.eliminationRound).toBe(1);
    expect(d.eliminationRound).toBe(1);

    // Seeding used to break tie between finalists (both elimRound=2)
    // A has better seed than C, so A should rank above C
    expect(a.rank).toBeLessThan(c.rank);
    expect(a.rank).toBe(1);
    expect(c.rank).toBe(2);

    // Losers ranked below finalists
    expect(b.rank).toBeGreaterThan(2);
    expect(d.rank).toBeGreaterThan(2);
  });
});
