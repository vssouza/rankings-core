// test/e2e/swiss-doubleloss.e2e.ts
import { describe, it, expect } from 'vitest';
import { computeStandings, MatchResult } from '../../src';
import type { StandingRow } from '../../src';

describe('swiss e2e — double-loss pairing (no winner recorded)', () => {
  it('handles a match where both players are recorded as LOSS without crashing', () => {
    // Minimal Swiss event:
    // Round 1: A vs B, both recorded as LOSS (double-loss / penalty case).
    //
    // We mainly care that:
    //  - computeStandings() does not throw
    //  - both players get a row
    //  - wins/losses/matchPoints are consistent with default scoring
    //  - opponents[] wiring is correct

    const matches = [
      {
        id: 'r1-a',
        round: 1,
        playerId: 'A',
        opponentId: 'B',
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
        gameDraws: 0,
      },
      {
        id: 'r1-b',
        round: 1,
        playerId: 'B',
        opponentId: 'A',
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
        gameDraws: 0,
      },
    ];

    const rows = computeStandings({
      mode: 'swiss',
      matches,
      options: {
        eventId: 'SWISS-DOUBLE-LOSS',
        // use all defaults for points/tiebreaks
      },
    }) as StandingRow[];

    // We should get exactly two rows: A and B
    expect(rows.length).toBe(2);

    const byId: Record<string, StandingRow> = Object.fromEntries(
      rows.map((r) => [r.playerId, r]),
    );

    const a = byId['A'];
    const b = byId['B'];

    expect(a).toBeDefined();
    expect(b).toBeDefined();

    // Both have 1 loss, no wins/draws/byes
    expect(a.wins).toBe(0);
    expect(a.losses).toBe(1);
    expect(a.draws).toBe(0);
    expect(a.byes).toBe(0);

    expect(b.wins).toBe(0);
    expect(b.losses).toBe(1);
    expect(b.draws).toBe(0);
    expect(b.byes).toBe(0);

    // Default Swiss points: 3/1/0/3 → loss = 0
    expect(a.matchPoints).toBe(0);
    expect(b.matchPoints).toBe(0);

    // Each should list the other as their only opponent
    expect(a.opponents).toEqual(['B']);
    expect(b.opponents).toEqual(['A']);

    // The engine must still assign deterministic ranks (1 & 2)
    const ranks = rows.map((r) => r.rank).sort((x, y) => x - y);
    expect(ranks).toEqual([1, 2]);
  });
});
