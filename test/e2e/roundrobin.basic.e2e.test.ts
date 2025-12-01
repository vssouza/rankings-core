import { describe, it, expect } from "vitest";
// Adjust this import if needed:
import { computeStandings, MatchResult } from "../../src/";

describe("E2E · Round-Robin standings (4-player full league)", () => {
  it("computes final table for a full double-sided RR", () => {
    // 4 players: each plays every other once (3 rounds total).
    //
    // Results:
    // A beats B, C, D -> 3-0
    // B beats C, D    -> 2-1
    // C beats D       -> 1-2
    // D loses all     -> 0-3

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
      mode: "roundrobin",
      matches,
      options: {
        eventId: "E2E-RR-BASIC",
        acceptSingleEntryMatches: true,
      },
    });

    const order = rows.map((r) => r.playerId);
    expect(order).toEqual(["A", "B", "C", "D"]);

    const mpById = Object.fromEntries(rows.map((r) => [r.playerId, r.matchPoints]));
    expect(mpById["A"]).toBe(9);
    expect(mpById["B"]).toBe(6);
    expect(mpById["C"]).toBe(3);
    expect(mpById["D"]).toBe(0);
  });
});
