// test/standings/forfeit.retirement.test.ts
import { describe, it, expect } from 'vitest';

import {
  createForfeitMatchesForRetirements,
  MatchResult,
} from '../../src/standings';
import type { Match } from '../../src/standings';

describe('createForfeitMatchesForRetirements', () => {
  it('creates mirrored FORFEIT_WIN / FORFEIT_LOSS entries when exactly one side retires', () => {
    const round = 4;
    const pairings = [
      { a: 'A', b: 'B' },
      { a: 'C', b: 'D' },
    ] as const;

    const retired = ['B']; // only B retires in this round

    const forfeits = createForfeitMatchesForRetirements({
      round,
      pairings,
      retired,
      existingMatches: [],
      idPrefix: 'TESTFORF',
    });

    // One pairing affected → 2 mirrored matches
    expect(forfeits).toHaveLength(2);

    const winnerPerspective = forfeits.find(
      (m) => m.playerId === 'A' && m.opponentId === 'B'
    ) as Match;
    const loserPerspective = forfeits.find(
      (m) => m.playerId === 'B' && m.opponentId === 'A'
    ) as Match;

    expect(winnerPerspective).toBeDefined();
    expect(loserPerspective).toBeDefined();

    // Round + results
    expect(winnerPerspective.round).toBe(round);
    expect(loserPerspective.round).toBe(round);

    expect(winnerPerspective.result).toBe(MatchResult.FORFEIT_WIN);
    expect(loserPerspective.result).toBe(MatchResult.FORFEIT_LOSS);

    // We intentionally leave gameWins / gameLosses undefined so forfeits
    // affect match points & match-based tiebreaks but not GWP/OGWP.
    expect(winnerPerspective.gameWins).toBeUndefined();
    expect(winnerPerspective.gameLosses).toBeUndefined();
    expect(loserPerspective.gameWins).toBeUndefined();
    expect(loserPerspective.gameLosses).toBeUndefined();

    // Second pairing (C vs D) is untouched (no retirements there)
    expect(
      forfeits.some(
        (m) =>
          (m.playerId === 'C' && m.opponentId === 'D') ||
          (m.playerId === 'D' && m.opponentId === 'C')
      )
    ).toBe(false);
  });

  it('does nothing when both players or neither player in a pairing are retired', () => {
    const round = 3;
    const pairings = [
      { a: 'A', b: 'B' }, // both retired
      { a: 'C', b: 'D' }, // neither retired
    ] as const;

    const retired = ['A', 'B', 'E']; // E isn’t in pairings at all

    const forfeits = createForfeitMatchesForRetirements({
      round,
      pairings,
      retired,
    });

    // No pairing where exactly one side is retired → no synthetic matches
    expect(forfeits).toHaveLength(0);
  });

  it('does not create forfeit matches when a real result already exists for that pairing/round', () => {
    const round = 5;
    const pairings = [{ a: 'P1', b: 'P2' }] as const;
    const retired = ['P2'];

    const existingMatches: Match[] = [
      {
        id: 'real-r5-p1-p2',
        round,
        playerId: 'P1',
        opponentId: 'P2',
        result: MatchResult.WIN,
        gameWins: 2,
        gameLosses: 0,
        gameDraws: 0,
      },
      {
        id: 'real-r5-p2-p1',
        round,
        playerId: 'P2',
        opponentId: 'P1',
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
        gameDraws: 0,
      },
    ];

    const forfeits = createForfeitMatchesForRetirements({
      round,
      pairings,
      retired,
      existingMatches,
    });

    // Since a real result is already present for (P1,P2,round),
    // the helper must not fabricate a second synthetic result.
    expect(forfeits).toHaveLength(0);
  });
});
