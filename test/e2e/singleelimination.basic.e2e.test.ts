// test/e2e/singleelimination-basic.e2e.test.ts
import { describe, it, expect } from "vitest";
// Adjust to your real entry points:
import { computeStandings, MatchResult } from "../../src";
import type { SingleEliminationStandingRow } from "../../src/standings/types";

describe("E2E · Single Elimination standings (4-player bracket)", () => {
  it("computes eliminationRound and ranks correctly for a simple bracket", () => {
    const matches = [
      // Round 1 (semifinals)
      { id: "sf-a", round: 1, playerId: "A", opponentId: "D", result: MatchResult.WIN },
      { id: "sf-d", round: 1, playerId: "D", opponentId: "A", result: MatchResult.LOSS },
      { id: "sf-b", round: 1, playerId: "B", opponentId: "C", result: MatchResult.WIN },
      { id: "sf-c", round: 1, playerId: "C", opponentId: "B", result: MatchResult.LOSS },

      // Round 2 (final)
      { id: "f-a", round: 2, playerId: "A", opponentId: "B", result: MatchResult.WIN },
      { id: "f-b", round: 2, playerId: "B", opponentId: "A", result: MatchResult.LOSS },
    ];

    const rawRows = computeStandings({
      mode: "singleelimination",
      matches,
      options: {
        eventId: "E2E-SE-BASIC",
        seeding: { A: 1, B: 2, C: 3, D: 4 },
      },
    });

    // Tell TS these are single-elimination rows:
    const rows = rawRows as SingleEliminationStandingRow[];

    // Ensure we have all four players
    expect(rows.map((r) => r.playerId).sort()).toEqual(["A", "B", "C", "D"].sort());

    // Order by computed rank
    const ordered = [...rows].sort((a, b) => a.rank - b.rank);

    expect(ordered[0].playerId).toBe("A"); // champion
    expect(ordered[1].playerId).toBe("B"); // runner-up

    const maxRound = Math.max(...matches.map((m) => m.round));

    const champ = rows.find((r) => r.playerId === "A")!;
    expect(champ.eliminationRound).toBe(maxRound + 1);

    const runnerUp = rows.find((r) => r.playerId === "B")!;
    expect(runnerUp.eliminationRound).toBe(maxRound);

    const c = rows.find((r) => r.playerId === "C")!;
    const d = rows.find((r) => r.playerId === "D")!;
    expect(c.eliminationRound).toBe(1);
    expect(d.eliminationRound).toBe(1);
  });
});
