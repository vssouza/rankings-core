import { describe, it, expect } from "vitest";
import { MatchResult } from "../../src/standings";
import type { Match, StandingRow, SingleEliminationStandingRow } from "../../src/standings";

import { ValidationException } from "../../src/validation/errors";
import { computeStandingsSafe } from "../../src/standings/safe";

describe("computeStandingsSafe", () => {
  it('delegates to swiss when mode is "swiss"', () => {
    const matches: Match[] = [
      { id: "r1-a", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WIN, gameWins: 2, gameLosses: 0, gameDraws: 0 },
      { id: "r1-b", round: 1, playerId: "B", opponentId: "A", result: MatchResult.LOSS, gameWins: 0, gameLosses: 2, gameDraws: 0 },
    ];

    const res = computeStandingsSafe({
      mode: "swiss",
      matches,
      options: { eventId: "swiss-safe" },
    }) as StandingRow[];

    expect(res).toHaveLength(2);
    expect(res[0].playerId).toBe("A");
  });

  it('delegates to roundrobin when mode is "roundrobin"', () => {
    const matches: Match[] = [
      { id: "ab", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WIN,  gameWins: 2, gameLosses: 0, gameDraws: 0 },
      { id: "bc", round: 2, playerId: "B", opponentId: "C", result: MatchResult.WIN,  gameWins: 2, gameLosses: 1, gameDraws: 0 },
      { id: "ca", round: 3, playerId: "C", opponentId: "A", result: MatchResult.DRAW, gameWins: 1, gameLosses: 1, gameDraws: 1 },
    ];

    const res = computeStandingsSafe({
      mode: "roundrobin",
      matches,
      options: { eventId: "rr-safe", acceptSingleEntryMatches: true },
    }) as StandingRow[];

    expect(res.map((r) => r.playerId).sort()).toEqual(["A", "B", "C"].sort());
  });

  it('delegates to singleelimination when mode is "singleelimination"', () => {
    const matches: Match[] = [
      // semis
      { id: "sf1-a", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WIN },
      { id: "sf1-b", round: 1, playerId: "B", opponentId: "A", result: MatchResult.LOSS },
      { id: "sf2-c", round: 1, playerId: "C", opponentId: "D", result: MatchResult.WIN },
      { id: "sf2-d", round: 1, playerId: "D", opponentId: "C", result: MatchResult.LOSS },
      // final
      { id: "f-a", round: 2, playerId: "A", opponentId: "C", result: MatchResult.WIN },
      { id: "f-c", round: 2, playerId: "C", opponentId: "A", result: MatchResult.LOSS },
    ];

    const res = computeStandingsSafe({
      mode: "singleelimination",
      matches,
      options: { eventId: "se-safe", seeding: { A: 1, C: 2, B: 3, D: 4 } },
    }) as SingleEliminationStandingRow[];

    expect(res).toHaveLength(4);
    expect(res[0].playerId).toBe("A");
    expect(res[0].eliminationRound).toBe(3);
  });

  // ---- validation behaviour ----

  it("throws ValidationException on invalid mode", () => {
    expect(() =>
      computeStandingsSafe({
        mode: "nope",
        matches: [],
      } as any)
    ).toThrow(ValidationException);
  });

  it("throws ValidationException when opponentId is null but result is not BYE", () => {
    expect(() =>
      computeStandingsSafe({
        mode: "swiss",
        matches: [{ id: "x", round: 1, playerId: "A", opponentId: null, result: MatchResult.WIN }],
      } as any)
    ).toThrow(ValidationException);
  });

  it("throws ValidationException for roundrobin missing mirror when acceptSingleEntryMatches=false", () => {
    expect(() =>
      computeStandingsSafe({
        mode: "roundrobin",
        matches: [
          { id: "m1", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WIN, gameWins: 2, gameLosses: 0, gameDraws: 0 },
          // missing B vs A
        ],
        options: { acceptSingleEntryMatches: false },
      } as any)
    ).toThrow(ValidationException);
  });
});
