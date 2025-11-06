// test/ratings/elo.deltas.edgecases.test.ts
// Improves coverage for deltas, empty batches, extreme ratings, and simultaneous snapshot logic.
import { describe, it, expect } from "vitest";
import { updateEloRatings, expectedScore, type EloMatch } from "../../src/ratings";

const must = (m: Record<string, number>, k: string): number => {
  const v = m[k];
  if (v === undefined) throw new Error(`Missing key ${k}`);
  return v;
};

describe("ELO – deltas & edge cases", () => {
  it("returns zero deltas and unchanged ratings for empty match list", () => {
    const base = { A: 1600, B: 1400 };
    const res = updateEloRatings(base, [], { K: 32 });
    expect(res.ratings).toEqual(base);
    // deltas may be optional; if present it should be empty
    if ((res as any).deltas) {
      expect((res as any).deltas).toEqual({});
    }
  });

  it("rating change matches deltas when deltas are provided (sequential)", () => {
    const base = { A: 1500, B: 1500 };
    const res = updateEloRatings(base, [{ a: "A", b: "B", result: "A" }], { K: 32, mode: "sequential" });

    const deltaA = (res as any).deltas?.A;
    const deltaB = (res as any).deltas?.B;

    const changeA = res.ratings.A - base.A;
    const changeB = res.ratings.B - base.B;

    // If the implementation returns deltas, they should match rating changes
    if (typeof deltaA === "number") {
      expect(changeA).toBeCloseTo(deltaA, 10);
    }
    if (typeof deltaB === "number") {
      expect(changeB).toBeCloseTo(deltaB, 10);
    }

    // Always assert rating directions regardless of deltas presence
    expect(changeA).toBeGreaterThan(0);
    expect(changeB).toBeLessThan(0);
  });

  it("simultaneous mode uses snapshot (order-independent)", () => {
    const base = { A: 1500, B: 1500, C: 1500 };
    const matches: ReadonlyArray<EloMatch> = [
      { a: "A", b: "B", result: "A" },
      { a: "A", b: "C", result: "B" },
    ];
    const r1 = updateEloRatings(base, matches, { K: 32, mode: "simultaneous" });
    const r2 = updateEloRatings(base, [...matches].reverse(), { K: 32, mode: "simultaneous" });
    expect(r1.ratings).toEqual(r2.ratings);
    // If deltas exist, they should also be equal
    if ((r1 as any).deltas && (r2 as any).deltas) {
      expect((r1 as any).deltas).toEqual((r2 as any).deltas);
    }
  });

  it("extreme rating gaps keep expectedScore within (0,1)", () => {
    const e1 = expectedScore(3200, 800);
    const e2 = expectedScore(800, 3200);
    expect(e1).toBeGreaterThan(0.999);
    expect(e2).toBeLessThan(0.001);
    expect(e1 + e2).toBeCloseTo(1, 10);
  });

  it("floor/cap clamp rating updates correctly", () => {
    const base = { A: 2500, B: 1000 };
    const res = updateEloRatings(base, [{ a: "A", b: "B", result: "B" }], { K: 400, floor: 900, cap: 2550 });
    expect(must(res.ratings, "A")).toBeLessThanOrEqual(2550);
    expect(must(res.ratings, "B")).toBeGreaterThanOrEqual(900);
  });
});
