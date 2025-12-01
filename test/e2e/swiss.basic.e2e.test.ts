import { describe, it, expect } from "vitest";
// Adjust this import if your entry point differs:
import { computeStandings, MatchResult } from "../../src";

describe("E2E · Swiss standings (simple 4-player event)", () => {
  it("produces correct final ranking across 3 rounds", () => {
    // 4 players, 3 rounds, no byes, no draws.
    //
    // R1: A beats B, C beats D
    // R2: A beats C, B beats D
    // R3: A beats D, B beats C
    //
    // Final match points (3 for win, 0 for loss):
    // A: 3 wins = 9 pts
    // B: 2 wins = 6 pts
    // C: 1 win  = 3 pts
    // D: 0 wins = 0 pts

    const matches = [
      // Round 1
      { id: "r1-a", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WIN },
      { id: "r1-b", round: 1, playerId: "B", opponentId: "A", result: MatchResult.LOSS },
      { id: "r1-c", round: 1, playerId: "C", opponentId: "D", result: MatchResult.WIN },
      { id: "r1-d", round: 1, playerId: "D", opponentId: "C", result: MatchResult.LOSS },

      // Round 2
      { id: "r2-a", round: 2, playerId: "A", opponentId: "C", result: MatchResult.WIN },
      { id: "r2-c", round: 2, playerId: "C", opponentId: "A", result: MatchResult.LOSS },
      { id: "r2-b", round: 2, playerId: "B", opponentId: "D", result: MatchResult.WIN },
      { id: "r2-d", round: 2, playerId: "D", opponentId: "B", result: MatchResult.LOSS },

      // Round 3
      { id: "r3-a", round: 3, playerId: "A", opponentId: "D", result: MatchResult.WIN },
      { id: "r3-d", round: 3, playerId: "D", opponentId: "A", result: MatchResult.LOSS },
      { id: "r3-b", round: 3, playerId: "B", opponentId: "C", result: MatchResult.WIN },
      { id: "r3-c", round: 3, playerId: "C", opponentId: "B", result: MatchResult.LOSS },
    ];

    const rows = computeStandings({
      mode: "swiss",
      matches,
      options: {
        eventId: "E2E-SWISS-BASIC",
        // use defaults for points/tiebreaks; this scenario has no ties on MP
      },
    });

    const order = rows.map((r) => r.playerId);
    expect(order).toEqual(["A", "B", "C", "D"]);

    const mpById = Object.fromEntries(rows.map((r) => [r.playerId, r.matchPoints]));
    // Using default 3/1/0, but we only have wins/losses so 3 per win
    expect(mpById["A"]).toBe(9);
    expect(mpById["B"]).toBe(6);
    expect(mpById["C"]).toBe(3);
    expect(mpById["D"]).toBe(0);
  });
});
