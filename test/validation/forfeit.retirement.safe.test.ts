import { describe, it, expect } from "vitest";
import { MatchResult } from "../../src/standings";
import type { Match } from "../../src/standings";

import { ValidationException } from "../../src/validation/errors";
import { createForfeitMatchesForRetirementsSafe } from "../../src/standings/safe";

describe("createForfeitMatchesForRetirementsSafe", () => {
  it("smoke: valid input produces mirrored forfeits", () => {
    const forfeits = createForfeitMatchesForRetirementsSafe({
      round: 4,
      pairings: [{ a: "A", b: "B" }, { a: "C", b: "D" }],
      retired: ["B"],
      existingMatches: [],
      idPrefix: "TESTFORF",
    }) as Match[];

    expect(forfeits).toHaveLength(2);

    const winner = forfeits.find((m) => m.playerId === "A" && m.opponentId === "B")!;
    const loser = forfeits.find((m) => m.playerId === "B" && m.opponentId === "A")!;

    expect(winner.result).toBe(MatchResult.FORFEIT_WIN);
    expect(loser.result).toBe(MatchResult.FORFEIT_LOSS);
    expect(winner.gameWins).toBeUndefined();
    expect(loser.gameWins).toBeUndefined();
  });

  it("throws ValidationException when round is invalid", () => {
    expect(() =>
      createForfeitMatchesForRetirementsSafe({
        round: 0,
        pairings: [{ a: "A", b: "B" }],
        retired: ["B"],
      } as any)
    ).toThrow(ValidationException);
  });

  it("throws ValidationException when pairing has a === b", () => {
    expect(() =>
      createForfeitMatchesForRetirementsSafe({
        round: 1,
        pairings: [{ a: "A", b: "A" }],
        retired: ["A"],
      } as any)
    ).toThrow(ValidationException);
  });
});
