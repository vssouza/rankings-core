// test/ratings/elo.wasm.fallback.test.ts
// Covers WASM fallback paths (load failure): expectedScoreAsync & updateEloRatingsWasm
import { describe, it, expect, vi } from "vitest";

describe("ELO – WASM fallback on load error", () => {
  it("expectedScoreAsync falls back to pure TS expectedScore", async () => {
    vi.resetModules();
    vi.doMock("../../src/ratings/wasm/wasm-bridge", () => ({
      getWasm: () => Promise.reject(new Error("no wasm")),
    }));

    const mod = await import("../../src/ratings/elo");
    const vAsync = await mod.expectedScoreAsync(1600, 1400);
    const vSync = mod.expectedScore(1600, 1400);
    expect(vAsync).toBeCloseTo(vSync, 12);
  });

  it("updateEloRatingsWasm matches updateEloRatings when WASM missing", async () => {
    vi.resetModules();
    vi.doMock("../../src/ratings/wasm/wasm-bridge", () => ({
      getWasm: () => Promise.reject(new Error("no wasm")),
    }));

    const { updateEloRatingsWasm, updateEloRatings } = await import("../../src/ratings/elo");

    const base = { A: 1500, B: 1500, C: 1500 };
    const matches = [
      { a: "A", b: "B", result: "A" },
      { a: "A", b: "C", result: "draw" },
    ] as const;

    const wasmRes = await updateEloRatingsWasm(base, matches, { K: 24, KDraw: 12, mode: "sequential" });
    const tsRes   =        updateEloRatings(base, matches, { K: 24, KDraw: 12, mode: "sequential" });

    expect(wasmRes.ratings).toEqual(tsRes.ratings);
    expect(wasmRes.deltas).toEqual(tsRes.deltas);
  });
});
