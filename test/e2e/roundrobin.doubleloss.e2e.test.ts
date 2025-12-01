// test/e2e/roundrobin-doubleloss.e2e.ts
import { describe, it, expect } from 'vitest';
import { computeStandings, MatchResult } from '../../src';
import type { StandingRow } from '../../src';

describe('round-robin e2e — double-loss pairing (no winner recorded)', () => {
  it('handles a match where both players are recorded as LOSS without crashing', () => {
    // Minimal round-robin style event:
    //
    // Round 1:
    //   A vs B  → both recorded as LOSS (double loss / penalty case)
    //
    // This is mostly a “robustness + wiring” check, analogous to the swiss test:
    //  - computeStandings() must not throw
    //  - both players get rows
    //  - wins/losses/matchPoints are consistent with default scoring
    //  - opponents[] wiring is correct
    //
    // We don't care about sophisticated tie-breaking here, just that the path works.

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
      mode: 'roundrobin',
      matches,
      options: {
        eventId: 'RR-DOUBLE-LOSS',
        // Use defaults for points/tiebreaks
      },
    }) as StandingRow[];

    // Expect exactly two rows: A and B
    expect(rows.length).toBe(2);

    const byId: Record<string, StandingRow> = Object.fromEntries(
      rows.map((r) => [r.playerId, r]),
    );

    const a = byId['A'];
    const b = byId['B'];

    expect(a).toBeDefined();
    expect(b).toBeDefined();

    // Both: 1 loss, no wins/draws/byes
    expect(a.wins).toBe(0);
    expect(a.losses).toBe(1);
    expect(a.draws).toBe(0);
    expect(a.byes).toBe(0);

    expect(b.wins).toBe(0);
    expect(b.losses).toBe(1);
    expect(b.draws).toBe(0);
    expect(b.byes).toBe(0);

    // Default points: 3/1/0/3 → loss = 0
    expect(a.matchPoints).toBe(0);
    expect(b.matchPoints).toBe(0);

    // Each lists the other as opponent
    expect(a.opponents).toEqual(['B']);
    expect(b.opponents).toEqual(['A']);

    // Engine still assigns deterministic ranks (1 & 2)
    const ranks = rows.map((r) => r.rank).sort((x, y) => x - y);
    expect(ranks).toEqual([1, 2]);
  });
});
