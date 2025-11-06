import { describe, it, expect, vi } from 'vitest';

describe('WASM expectedScore parity (mocked)', () => {
  it('expectedScoreAsync (WASM) matches TS formula for several inputs', async () => {
    vi.resetModules();
    // Mock the wasm bridge to return a function with the same formula the AS implements.
    vi.doMock('../../wasm/wasm-bridge', () => ({
      getWasm: () => Promise.resolve({
        expectedScore: (rA: number, rB: number) =>
          1 / (1 + Math.pow(10, (rB - rA) / 400)),
      }),
    }));

    const { expectedScoreAsync, expectedScore } = await import('../../src/ratings/elo');

    const cases: Array<[number, number]> = [
      [1600, 1600],
      [1600, 1400],
      [1800, 1200],
      [1200, 1800],
      [2000, 1000],
    ];

    for (const [a, b] of cases) {
      const wasmVal = await expectedScoreAsync(a, b);
      const tsVal = expectedScore(a, b);
      expect(wasmVal).toBeCloseTo(tsVal, 12);
    }
  });
});
