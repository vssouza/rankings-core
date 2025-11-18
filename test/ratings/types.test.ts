// test/ratings/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  isDraw,
  DEFAULT_RATING,
  type EloMatch,
  type EloOptions,
  type EloResult,
  type RatingMode,
} from '../../src/ratings/types';

describe('ratings/types helpers & shapes', () => {
  it('isDraw correctly identifies draw results', () => {
    const win: EloResult = 'A';
    const loss: EloResult = 'B';
    const draw: EloResult = 'draw';

    expect(isDraw(draw)).toBe(true);
    expect(isDraw(win)).toBe(false);
    expect(isDraw(loss)).toBe(false);
  });

  it('DEFAULT_RATING is the expected base rating', () => {
    expect(DEFAULT_RATING).toBe(1500);
  });

  it('EloMatch and EloOptions can be constructed without runtime issues', () => {
    // This is mostly a type-level sanity check, but also makes sure
    // the module loads fine at runtime.
    const match: EloMatch = {
      a: 'Alice',
      b: 'Bob',
      result: 'draw',
      weight: 2,
    };

    const opts: EloOptions = {
      K: 32,
      KDraw: 24,
      drawScore: 0.6,
      perPlayerK: { Alice: 40 },
      initialRating: 1600,
      floor: 1200,
      cap: 2000,
      mode: 'sequential',
    };

    const mode: RatingMode = 'elo';

    // These expectations are trivial, but they ensure the values are
    // actually constructed and keep the lines "executed" for coverage.
    expect(match.a).toBe('Alice');
    expect(match.b).toBe('Bob');
    expect(mode).toBe('elo');
    expect(opts.K).toBe(32);
    expect(opts.drawScore).toBe(0.6);
  });
});
