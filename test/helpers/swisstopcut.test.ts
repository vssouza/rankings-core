// test/helpers/swisstopcut.test.ts
import { describe, it, expect } from "vitest";
import {
  computeTopCutSeeds,
  type StandingRow,
} from "../../src";

describe("computeTopCutSeeds", () => {
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

  it("seeds by Swiss rank and skips retired players", () => {
    const rows: StandingRow[] = [
      { playerId: "A", rank: 1, retired: false, ...baseRow(), matchPoints: 12 },
      { playerId: "B", rank: 2, retired: true,  ...baseRow(), matchPoints: 9 },
      { playerId: "C", rank: 3, retired: false, ...baseRow(), matchPoints: 9 },
      { playerId: "D", rank: 4, retired: false, ...baseRow(), matchPoints: 6 },
    ];

    const seeds = computeTopCutSeeds(rows, 3);

    expect(seeds.map((s) => s.playerId)).toEqual(["A", "C", "D"]);
    expect(seeds.map((s) => s.seed)).toEqual([1, 2, 3]);
    expect(seeds.map((s) => s.sourceRank)).toEqual([1, 3, 4]);
  });

  it("clamps cutSize to available eligible players", () => {
    const rows: StandingRow[] = [
      { playerId: "A", rank: 1, ...baseRow(), retired: false },
    ];

    const seeds = computeTopCutSeeds(rows, 8);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].playerId).toBe("A");
    expect(seeds[0].seed).toBe(1);
    expect(seeds[0].sourceRank).toBe(1);
  });

  it("returns an empty array when cutSize <= 0", () => {
    const rows: StandingRow[] = [
      { playerId: "A", rank: 1, ...baseRow(), retired: false },
      { playerId: "B", rank: 2, ...baseRow(), retired: false },
    ];

    expect(computeTopCutSeeds(rows, 0)).toEqual([]);
    expect(computeTopCutSeeds(rows, -5)).toEqual([]);
  });

  it("returns an empty array when all players are retired", () => {
    const rows: StandingRow[] = [
      { playerId: "A", rank: 1, ...baseRow(), retired: true },
      { playerId: "B", rank: 2, ...baseRow(), retired: true },
    ];

    const seeds = computeTopCutSeeds(rows, 8);
    expect(seeds).toEqual([]);
  });

  it("throws when cutSize is not a finite number", () => {
    const rows: StandingRow[] = [
      { playerId: "A", rank: 1, ...baseRow(), retired: false },
    ];

    expect(() =>
      computeTopCutSeeds(rows, NaN as any)
    ).toThrow(/cutSize must be a finite number/i);

    expect(() =>
      computeTopCutSeeds(rows, Infinity as any)
    ).toThrow(/cutSize must be a finite number/i);
  });

  it("uses tie-breakers then playerId as last-resort ordering when ranks match", () => {
    const rows: StandingRow[] = [
      // Same rank, different matchPoints (exercise matchPoints branch)
      {
        playerId: "P_MP_HIGH",
        rank: 1,
        retired: false,
        ...baseRow(),
        matchPoints: 12,
        omwp: 0.50,
        gwp: 0.50,
        ogwp: 0.50,
        sb: 5,
      },
      {
        playerId: "P_MP_LOW",
        rank: 1,
        retired: false,
        ...baseRow(),
        matchPoints: 9,
        omwp: 0.80,   // better OMWP but lower MP, should still be behind
        gwp: 0.80,
        ogwp: 0.80,
        sb: 10,
      },

      // Same rank + same tiebreaks, only playerId differs (hit localeCompare fallback)
      {
        playerId: "A_ALPHA",
        rank: 2,
        retired: false,
        ...baseRow(),
        matchPoints: 6,
        omwp: 0.60,
        gwp: 0.60,
        ogwp: 0.60,
        sb: 3,
      },
      {
        playerId: "Z_OMEGA",
        rank: 2,
        retired: false,
        ...baseRow(),
        matchPoints: 6,
        omwp: 0.60,
        gwp: 0.60,
        ogwp: 0.60,
        sb: 3,
      },
    ];

    const seeds = computeTopCutSeeds(rows, 4);

    // First, MP-based ordering for rank 1 players
    const firstTwo = seeds.slice(0, 2).map((s) => s.playerId);
    expect(firstTwo).toEqual(["P_MP_HIGH", "P_MP_LOW"]);

    // Then, for rank 2 players with identical tie-breaks,
    // ordering falls back to playerId.localeCompare → A_ALPHA before Z_OMEGA
    const lastTwo = seeds.slice(2).map((s) => s.playerId);
    expect(lastTwo).toEqual(["A_ALPHA", "Z_OMEGA"]);
  });
});
