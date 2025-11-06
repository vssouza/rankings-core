// test/pairings/index.facade.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ✅ Hoist-safe inline mocks (no outer variables referenced)
vi.mock('../../src/pairings/swiss', () => ({
  generateSwissPairings: vi.fn(() => ({
    pairings: [{ a: 'S1', b: 'S2' }],
    bye: 'S3',
    downfloats: { S2: 1 },
    rematchesUsed: [{ a: 'S1', b: 'S2' }],
  })),
}));

vi.mock('../../src/pairings/roundrobin', () => ({
  getRoundRobinRound: vi.fn(
    (players: ReadonlyArray<string>, roundNumber: number) => ({
      round: roundNumber,
      pairings: players.length >= 2 ? [{ a: players[0], b: players[1] }] : [],
      byes: players.slice(2),
    })
  ),
  buildRoundRobinSchedule: vi.fn(),
}));

// Now import facade under test + the mocked modules (to assert calls)
import {
  generatePairings,
  type PairingRequest,
  type PairingResult,
} from '../../src/pairings/index';

import * as swiss from '../../src/pairings/swiss';
import * as rr from '../../src/pairings/roundrobin';

import type { SingleElimSeedEntry } from '../../src/pairings';
import {
  generateSingleEliminationBracket, // only for sanity in one test
} from '../../src/pairings/singleelimination';

function pidFromSlot(s: any): string | undefined {
  return s && s.kind === 'seed' ? s.playerId : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pairings/index facade — swiss mode', () => {
  it('passes through swiss results (pairings, bye, downfloats, rematchesUsed)', () => {
    const standings = [
      { playerId: 'S1', rank: 1, matchPoints: 0, mwp: 0, omwp: 0, gwp: 0, ogwp: 0, sb: 0, wins: 0, losses: 0, draws: 0, byes: 0, roundsPlayed: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, penalties: 0, opponents: [] },
      { playerId: 'S2', rank: 2, matchPoints: 0, mwp: 0, omwp: 0, gwp: 0, ogwp: 0, sb: 0, wins: 0, losses: 0, draws: 0, byes: 0, roundsPlayed: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, penalties: 0, opponents: [] },
      { playerId: 'S3', rank: 3, matchPoints: 0, mwp: 0, omwp: 0, gwp: 0, ogwp: 0, sb: 0, wins: 0, losses: 0, draws: 0, byes: 0, roundsPlayed: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, penalties: 0, opponents: [] },
    ] as any;
    const history: any[] = [];

    const req: PairingRequest = {
      mode: 'swiss',
      standings,
      history,
      options: { avoidRematches: true } as any,
    };

    const res: PairingResult = generatePairings(req);

    expect(swiss.generateSwissPairings).toHaveBeenCalledTimes(1);
    expect(res.pairings).toEqual([{ a: 'S1', b: 'S2' }]);
    expect(res.bye).toBe('S3');
    expect(res.downfloats).toEqual({ S2: 1 });
    expect(res.rematchesUsed).toEqual([{ a: 'S1', b: 'S2' }]);
    expect(res.round).toBeUndefined();
    expect(res.byes).toBeUndefined();
    expect(res.bracket).toBeUndefined();
  });
});

describe('pairings/index facade — roundrobin mode', () => {
  it('maps getRoundRobinRound() into facade result (pairings, first bye, round, byes)', () => {
    const players = ['R1', 'R2', 'R3'];
    const req: PairingRequest = {
      mode: 'roundrobin',
      players,
      roundNumber: 2,
      options: { fixed: true } as any,
    };

    const res: PairingResult = generatePairings(req);

    expect(rr.getRoundRobinRound).toHaveBeenCalledTimes(1);
    expect(res.round).toBe(2);
    expect(res.pairings).toEqual([{ a: 'R1', b: 'R2' }]);
    expect(res.bye).toBe('R3');
    expect(res.byes).toEqual(['R3']);
    expect(res.downfloats).toBeUndefined();
    expect(res.rematchesUsed).toBeUndefined();
    expect(res.bracket).toBeUndefined();
  });
});

describe('pairings/index facade — singleelimination mode', () => {
  it('returns round 1 pairings and BYEs for a 5-entrant field (8-size bracket)', () => {
    const seeds: ReadonlyArray<SingleElimSeedEntry> = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
      { playerId: 'E', seed: 5 },
    ];

    const req: PairingRequest = {
      mode: 'singleelimination',
      seeds,
      options: { bestOf: 3, thirdPlace: true },
      roundNumber: 1,
    };

    const res: PairingResult = generatePairings(req);

    expect(res.round).toBe(1);
    expect(res.bracket).toBeDefined();
    expect(Array.isArray(res.pairings)).toBe(true);

    const r1 = res.bracket!.rounds[0];
    const rawByes: string[] = [];
    const rawPairs: Array<{ a: string; b: string }> = [];
    for (const m of r1) {
      const a = pidFromSlot(m.a);
      const b = pidFromSlot(m.b);
      if (a && !b) rawByes.push(a);
      else if (b && !a) rawByes.push(b);
      else if (a && b) rawPairs.push({ a, b });
    }

    if (rawByes.length) {
      expect(res.byes).toBeDefined();
      expect(res.byes!.length).toBe(rawByes.length);
      expect(new Set(res.byes)).toEqual(new Set(rawByes));
    } else {
      expect(res.byes).toBeUndefined();
    }

    for (const p of res.pairings) {
      const found = rawPairs.some(
        (q) => (q.a === p.a && q.b === p.b) || (q.a === p.b && q.b === p.a),
      );
      expect(found).toBe(true);
    }
  });

  it('returns empty pairings for an unresolved future round but still returns the bracket', () => {
    const seeds: ReadonlyArray<SingleElimSeedEntry> = [
      { playerId: 'A', seed: 1 },
      { playerId: 'B', seed: 2 },
      { playerId: 'C', seed: 3 },
      { playerId: 'D', seed: 4 },
      { playerId: 'E', seed: 5 },
      { playerId: 'F', seed: 6 },
      { playerId: 'G', seed: 7 },
      { playerId: 'H', seed: 8 },
    ];

    // Sanity: generator creates expected structure
    const sanity = generateSingleEliminationBracket(seeds, {});
    expect(sanity.rounds.length).toBe(3); // 4 → 2 → 1

    const req: PairingRequest = {
      mode: 'singleelimination',
      seeds,
      roundNumber: 2, // semis, unresolved without R1 results
    };
    const res: PairingResult = generatePairings(req);

    expect(res.round).toBe(2);
    expect(res.pairings).toEqual([]);
    expect(res.byes).toBeUndefined();
    expect(res.bracket).toBeDefined();
  });
});
