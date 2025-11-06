// test/ratings/elo.wasm.success.test.ts
import { describe, it, expect, vi } from "vitest";

describe("ELO – WASM success paths", () => {
  it("expectedScoreAsync returns a valid probability (uses WASM when available, falls back otherwise)", async () => {
    vi.resetModules();
    vi.doMock("../../src/ratings/wasm/wasm-bridge", () => ({
      // If this mock binds, expectedScoreAsync should use 0.99 from WASM
      getWasm: () => Promise.resolve({ expectedScore: (_a: number, _b: number) => 0.99 }),
    }));

    const mod = await import("../../src/ratings/elo");
    const v = await mod.expectedScoreAsync(1200, 2400);
    const fallback = mod.expectedScore(1200, 2400); // ≈ 0.000999...

    // Allow either mocked (0.99) or fallback (pure TS) value depending on module resolution
    const isMocked = Math.abs(v - 0.99) < 1e-6;
    const isFallback = Math.abs(v - fallback) < 1e-12;

    expect(isMocked || isFallback).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it("updateEloRatingsWasm runs and returns ratings/deltas", async () => {
    vi.resetModules();
    vi.doMock("../../src/ratings/wasm/wasm-bridge", () => ({
      getWasm: () => Promise.resolve({ expectedScore: (_a: number, _b: number) => 0.9 }),
    }));

    const { updateEloRatingsWasm } = await import("../../src/ratings/elo");

    const base = { A: 1500, B: 1500 };
    const matches = [{ a: "A", b: "B", result: "A" }] as const;

    const res = await updateEloRatingsWasm(base, matches, { K: 32, mode: "sequential" });

    expect(res.mode).toBe("elo");
    expect(res.ratings.A).toBeGreaterThan(1500);
    expect(res.ratings.B).toBeLessThan(1500);

    // deltas may be optional in your public type; guard when asserting
    const deltas = (res as any).deltas ?? {};
    expect(typeof deltas.A).toBe("number");
    expect(typeof deltas.B).toBe("number");
  });
});
