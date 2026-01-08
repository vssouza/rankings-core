// test/validations/ratings.safe.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";

// ------------------------------
// Helpers
// ------------------------------

function expectValidationExceptionShape(
  e: unknown,
  opts?: {code?: string; path?: string; messageIncludes?: string}
) {
  expect(e).toBeTruthy();
  expect((e as any).name).toBe("ValidationException");
  const errors = (e as any).errors as Array<any> | undefined;
  expect(Array.isArray(errors)).toBe(true);
  expect(errors!.length).toBeGreaterThan(0);

  if (opts?.code) expect(errors![0].code).toBe(opts.code);
  if (opts?.path) expect(errors![0].path).toBe(opts.path);
  if (opts?.messageIncludes) {
    expect(String(errors![0].message)).toContain(opts.messageIncludes);
  }
}

// ------------------------------
// Default (happy-path) mocks
// ------------------------------
//
// IMPORTANT: mock the *elo engine* only.
// If safe.ts calls through the barrel (ratings/index.ts), that barrel imports
// updateEloRatings from ./elo — so this mock covers both paths.
//
vi.mock("../../src/ratings/elo", () => {
  return {
    updateEloRatings: vi.fn(
      (
        base: Record<string, number> = {},
        _matches: any[] = [],
        _opts: any = {}
      ) => ({
        mode: "elo",
        ratings: {
          ...base,
          A: (base.A ?? 1500) + 16,
          B: (base.B ?? 1500) - 16,
        },
        deltas: {A: 16, B: -16},
      })
    ),
    expectedScore: vi.fn((_a: number, _b: number) => 0.75),
  };
});

import * as eloMod from "../../src/ratings/elo";
import {updateEloRatingsSafe, updateRatingsSafe} from "../../src/ratings/safe";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ratings safe wrappers", () => {
  it("updateEloRatingsSafe validates and delegates to elo.updateEloRatings", () => {
    const out = updateEloRatingsSafe(
      {A: 1500, B: 1500},
      [{a: "A", b: "B", result: "A"}],
      {K: 32}
    );

    expect(eloMod.updateEloRatings as any).toHaveBeenCalledTimes(1);
    expect(out.ratings).toEqual({A: 1516, B: 1484});
  });

  it("updateRatingsSafe (mode=elo) validates and delegates", () => {
    const out = updateRatingsSafe({
      mode: "elo",
      base: {A: 1500, B: 1500},
      matches: [{a: "A", b: "B", result: "A"}],
      options: {K: 32},
    } as any);

    expect(eloMod.updateEloRatings as any).toHaveBeenCalledTimes(1);
    expect(out.ratings).toEqual({A: 1516, B: 1484});
  });

  it("throws ValidationException on invalid input (preflight validation)", () => {
    try {
      updateEloRatingsSafe(
        {A: 1500},
        // invalid: b should be string
        [{a: "A", b: 123 as any, result: "A"}],
        {K: 32}
      );
      throw new Error("expected to throw");
    } catch (e) {
      expectValidationExceptionShape(e, {path: "req.matches[0].b"});
    }
  });
});

describe("ratings safe wrappers — engine error wrapping", () => {
  it("wraps ELO engine Error into ValidationException (code=custom, path=req)", async () => {
    // isolate module graph for this test
    vi.resetModules();

    vi.doMock("../../src/ratings/elo", () => {
      return {
        updateEloRatings: vi.fn(() => {
          throw new Error("boom from elo engine");
        }),
        expectedScore: vi.fn((_a: number, _b: number) => 0.5),
      };
    });

    const {updateEloRatingsSafe: safe} = await import("../../src/ratings/safe");

    try {
      safe({A: 1500}, [{a: "A", b: "B", result: "A"}], {K: 32});
      throw new Error("expected to throw");
    } catch (e) {
      expectValidationExceptionShape(e, {
        code: "custom",
        path: "req",
        messageIncludes: "boom from elo engine",
      });
    }
  });

  it("wraps ratings facade engine Error into ValidationException (updateRatingsSafe)", async () => {
    vi.resetModules();

    vi.doMock("../../src/ratings/elo", () => {
      return {
        updateEloRatings: vi.fn(() => {
          throw new Error("boom from ratings facade engine");
        }),
        expectedScore: vi.fn((_a: number, _b: number) => 0.5),
      };
    });

    const {updateRatingsSafe: safe} = await import("../../src/ratings/safe");

    try {
      safe({
        mode: "elo",
        base: {A: 1500, B: 1500},
        matches: [{a: "A", b: "B", result: "A"}],
        options: {K: 32},
      } as any);
      throw new Error("expected to throw");
    } catch (e) {
      expectValidationExceptionShape(e, {
        code: "custom",
        path: "req",
        messageIncludes: "boom from ratings facade engine",
      });
    }
  });
});
