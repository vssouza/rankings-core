import {describe, it, expect} from "vitest";
import {
  validateRatingRequest,
  validateRatingResult,
} from "../../src/validations/ratings";

describe("validations/ratings", () => {
  it("validateRatingRequest: happy path (elo)", () => {
    const r = validateRatingRequest({
      mode: "elo",
      base: {A: 1500, B: 1500},
      matches: [{a: "A", b: "B", result: "A", weight: 1}],
      options: {K: 32, mode: "sequential", drawScore: 0.5},
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.mode).toBe("elo");
      expect(r.value.matches).toHaveLength(1);
    }
  });

  it("validateRatingRequest: rejects non-object + invalid mode", () => {
    const r1 = validateRatingRequest("nope" as any);
    expect(r1.ok).toBe(false);

    const r2 = validateRatingRequest({mode: "glicko2"} as any);
    expect(r2.ok).toBe(false);
  });

  it("validateRatingRequest: catches match shape errors (self-match, bad result, negative weight)", () => {
    const r = validateRatingRequest({
      mode: "elo",
      matches: [
        {a: "A", b: "A", result: "A", weight: -1}, // self match + weight < 0
        {a: "A", b: 123, result: "nope"}, // b type + result enum
      ],
    } as any);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.path);
      expect(paths).toContain("req.matches[0]"); // self-match custom error at match path
      expect(paths).toContain("req.matches[0].weight");
      expect(paths).toContain("req.matches[1].b");
      expect(paths).toContain("req.matches[1].result");
    }
  });

  it("validateRatingRequest: options branches (floor>cap, drawScore out of range, K/KDraw negative, perPlayerK negative + wrong shape)", () => {
    const r = validateRatingRequest({
      mode: "elo",
      matches: [{a: "A", b: "B", result: "draw"}],
      options: {
        K: -1,
        KDraw: -2,
        floor: 2000,
        cap: 1000, // floor > cap
        drawScore: 2, // out of [0,1]
        perPlayerK: {A: -5}, // negative per-player
        mode: "simultaneous",
      },
    } as any);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain("min"); // K, KDraw, perPlayerK, drawScore, etc.
      // floor>cap is "custom"
      expect(
        r.errors.some((e) => e.code === "custom" && e.path === "req.options")
      ).toBe(true);
    }

    const r2 = validateRatingRequest({
      mode: "elo",
      matches: [{a: "A", b: "B", result: "A"}],
      options: {perPlayerK: "nope"}, // wrong shape
    } as any);

    expect(r2.ok).toBe(false);
  });

  it("validateRatingRequest: base record validation (empty key + non-finite)", () => {
    const r = validateRatingRequest({
      mode: "elo",
      matches: [{a: "A", b: "B", result: "A"}],
      base: {"": 1500, A: Infinity} as any,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some((e) => e.path === "req.base" && e.code === "custom")
      ).toBe(true); // empty key
      expect(
        r.errors.some((e) => e.path === "req.base.A" && e.code === "finite")
      ).toBe(true);
    }
  });

  it("validateRatingResult: happy path with optional deltas + mode discriminator", () => {
    const req = {
      mode: "elo",
      matches: [{a: "A", b: "B", result: "A"}],
      base: {A: 1500, B: 1500},
    } as any;

    const r = validateRatingResult(
      {
        mode: "elo",
        ratings: {A: 1516, B: 1484},
        deltas: {A: 16, B: -16},
      },
      req
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.ratings.A).toBe(1516);
      expect(r.value.deltas?.B).toBe(-16);
    }
  });

  it("validateRatingResult: rejects non-object / missing ratings / bad deltas record / bad res.mode", () => {
    const req = {mode: "elo", matches: []} as any;

    const r1 = validateRatingResult("nope" as any, req);
    expect(r1.ok).toBe(false);

    const r2 = validateRatingResult({deltas: {}} as any, req); // ratings missing
    expect(r2.ok).toBe(false);

    const r3 = validateRatingResult(
      {
        ratings: {A: 1500},
        deltas: {"": 1}, // empty key in deltas
      },
      req
    );
    expect(r3.ok).toBe(false);

    const r4 = validateRatingResult(
      {
        mode: "nope",
        ratings: {A: 1500},
      },
      req
    );
    expect(r4.ok).toBe(false);
  });
});
