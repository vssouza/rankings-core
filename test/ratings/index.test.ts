// test/ratings/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Hoist-safe mock of the underlying ELO module so we can assert calls/returns.
 * Do this BEFORE importing the module under test.
 */
vi.mock('../../src/ratings/elo', () => {
  return {
    updateEloRatings: vi.fn((base: Record<string, number> = {}, matches: any[] = [], opts: any = {}) => {
      // return a predictable shape so tests can assert values
      return {
        ratings: {
          ...base,
          Alice: (base.Alice ?? 1500) + 10,
          Bob: (base.Bob ?? 1500) - 10,
        },
        // NOTE: This 'meta' is a mock-only convenience; the real type may not have it.
        meta: { K: opts?.K ?? 32, count: matches.length },
      };
    }),
    expectedScore: vi.fn((_rA: number, _rB: number) => {
      // deterministic stand-in implementation
      return 0.75; // constant for plumbing tests
    }),
  };
});

// Module under test (uses mocked elo)
import * as ratings from '../../src/ratings/index';
// Also pull the mock back in to assert calls
import * as eloMock from '../../src/ratings/elo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ratings/index public surface', () => {
  it('exports updateEloRatings, expectedScore, and updateRatings', () => {
    expect(typeof ratings.updateEloRatings).toBe('function');
    expect(typeof ratings.expectedScore).toBe('function');
    expect(typeof ratings.updateRatings).toBe('function');
  });
});

describe('updateRatings facade (mode: elo)', () => {
  it('routes to updateEloRatings with provided args and returns its result', () => {
    const base = { Alice: 1500, Bob: 1500 };
    const matches = [{ a: 'Alice', b: 'Bob', result: 'A' }];
    const opts = { K: 24 };

    const res = ratings.updateRatings({
      mode: 'elo',
      base,
      matches,
      options: opts,
    } as any);

    // Called once with correct arguments
    expect((eloMock.updateEloRatings as any)).toHaveBeenCalledTimes(1);
    expect((eloMock.updateEloRatings as any)).toHaveBeenCalledWith(base, matches, opts);

    // Ratings updated as per mock
    expect(res.ratings).toEqual({ Alice: 1510, Bob: 1490 });

    // 'meta' is mock-only; access via cast to avoid type errors if missing in real type
    const meta = (res as any).meta;
    expect(meta).toBeDefined();
    expect(meta.K).toBe(24);
    expect(meta.count).toBe(1);
  });

  it('applies default base when omitted', () => {
    const res = ratings.updateRatings({
      mode: 'elo',
      matches: [],
      options: { K: 16 },
    } as any);

    expect((eloMock.updateEloRatings as any)).toHaveBeenCalledWith({}, [], { K: 16 });
    const meta = (res as any).meta;
    expect(meta).toBeDefined();
    expect(meta.K).toBe(16);
    expect(meta.count).toBe(0);
  });
});

describe('Direct re-exports', () => {
  it('updateEloRatings re-export calls underlying elo.updateEloRatings', () => {
    const out = ratings.updateEloRatings({ Alice: 1600, Bob: 1600 }, [], { K: 40 } as any);
    expect((eloMock.updateEloRatings as any)).toHaveBeenCalledTimes(1);
    expect(out.ratings.Alice).toBe(1610);
    expect(out.ratings.Bob).toBe(1590);
    const meta = (out as any).meta;
    expect(meta).toBeDefined();
    expect(meta.K).toBe(40);
  });

  it('expectedScore re-export calls underlying elo.expectedScore', () => {
    const s = ratings.expectedScore(1700, 1500);
    expect((eloMock.expectedScore as any)).toHaveBeenCalledTimes(1);
    expect((eloMock.expectedScore as any)).toHaveBeenCalledWith(1700, 1500);
    expect(s).toBe(0.75);
  });
});

describe('Unsupported modes', () => {
  it('throws a helpful error for unknown rating modes', () => {
    expect(() =>
      ratings.updateRatings({ mode: 'glicko2', base: {}, matches: [] } as any),
    ).toThrow(/Unsupported rating mode/i);
  });
});
