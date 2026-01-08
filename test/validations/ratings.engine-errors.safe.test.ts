// test/validations/ratings.engine-errors.safe.test.ts

import {describe, it, expect, vi} from "vitest";
import {ValidationException} from "../../src/validations/errors";

vi.mock("../../src/ratings/index", () => ({
  updateRatings: vi.fn(() => {
    throw new Error("boom from ratings engine");
  }),
  updateEloRatings: vi.fn(() => {
    throw new Error("boom from elo engine");
  }),
  expectedScore: vi.fn(() => 0.5),
}));

import {updateRatingsSafe, updateEloRatingsSafe} from "../../src/ratings/safe";

describe("ratings safe wrappers wrap engine errors", () => {
  it("updateRatingsSafe wraps engine Error into ValidationException", () => {
    expect(() =>
      updateRatingsSafe({
        mode: "elo",
        matches: [{a: "A", b: "B", result: "A"}],
      } as any)
    ).toThrow(ValidationException);
  });

  it("updateEloRatingsSafe wraps engine Error into ValidationException", () => {
    expect(() =>
      updateEloRatingsSafe(
        {A: 1500, B: 1500},
        [{a: "A", b: "B", result: "A"}],
        {K: 32}
      )
    ).toThrow(ValidationException);
  });
});
