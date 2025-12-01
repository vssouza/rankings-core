// test/helpers/swisstopcutmerger.test.ts
import { describe, it, expect } from "vitest";
import {
  type StandingRow,
  mergeSwissTopCutStandings,
} from "../../src";
import type { TopCutStandingLike } from "../../src/helpers/swisstopcutmerger";

const baseRow = (): Omit<StandingRow, "playerId" | "rank"> => ({
  matchPoints: 0,
  mwp: 0,
  omwp: 0,
  gwp: 0,
  ogwp: 0,
  sb: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  byes: 0,
  roundsPlayed: 0,
  gameWins: 0,
  gameLosses: 0,
  gameDraws: 0,
  penalties: 0,
  opponents: [],
});

describe("mergeSwissTopCutStandings", () => {
  it("returns Swiss standings re-ranked when there is no top cut", () => {
    const swiss: StandingRow[] = [
      { playerId: "A", rank: 2, ...baseRow(), matchPoints: 6 },
      { playerId: "B", rank: 1, ...baseRow(), matchPoints: 9 },
      { playerId: "C", rank: 3, ...baseRow(), matchPoints: 3 },
    ];

    const merged = mergeSwissTopCutStandings(swiss, []);

    // Should just be Swiss order by rank, re-ranked 1..N
    expect(merged.map((r) => r.playerId)).toEqual(["B", "A", "C"]);
    expect(merged.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("puts top-cut players first, ordered by top-cut rank", () => {
    const swiss: StandingRow[] = [
      // Swiss ranks: B (1), A (2), C (3), D (4)
      { playerId: "A", rank: 2, ...baseRow(), matchPoints: 9 },
      { playerId: "B", rank: 1, ...baseRow(), matchPoints: 9 },
      { playerId: "C", rank: 3, ...baseRow(), matchPoints: 6 },
      { playerId: "D", rank: 4, ...baseRow(), matchPoints: 3 },
    ];

    const topCut: TopCutStandingLike[] = [
      // In the top cut, C actually wins, B is finalist.
      { playerId: "C", rank: 1, eliminationRound: 3 },
      { playerId: "B", rank: 2, eliminationRound: 3 },
    ];

    const merged = mergeSwissTopCutStandings(swiss, topCut);

    // Top-cut players first, in top-cut order: C (1), B (2), then A, D.
    expect(merged.map((r) => r.playerId)).toEqual(["C", "B", "A", "D"]);
    // Ranks should be recomputed 1..N
    expect(merged.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("skips top-cut players that are not present in Swiss", () => {
    const swiss: StandingRow[] = [
      { playerId: "A", rank: 1, ...baseRow(), matchPoints: 9 },
      { playerId: "B", rank: 2, ...baseRow(), matchPoints: 6 },
    ];

    const topCut: TopCutStandingLike[] = [
      { playerId: "X", rank: 1, eliminationRound: 2 }, // not in Swiss
      { playerId: "A", rank: 2, eliminationRound: 2 }, // valid
    ];

    const merged = mergeSwissTopCutStandings(swiss, topCut);

    // "X" should be ignored; A comes first (from top cut), then B by Swiss order.
    expect(merged.map((r) => r.playerId)).toEqual(["A", "B"]);
    expect(merged.map((r) => r.rank)).toEqual([1, 2]);
  });
});
