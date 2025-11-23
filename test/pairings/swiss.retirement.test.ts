// test/pairings/swiss.retirement.test.ts
import { describe, it, expect } from "vitest";
import {
  generateSwissPairings,
} from "../../src/pairings/swiss";
import type {
  StandingRow,
  Match,
  PlayerID,
} from "../../src/standings/types";

const mkStanding = (
  playerId: PlayerID,
  matchPoints: number,
  extra?: Partial<StandingRow>
): StandingRow => ({
  playerId,
  rank: 0,
  matchPoints,
  mwp: 1,
  omwp: 1,
  gwp: 1,
  ogwp: 1,
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
  ...extra,
});

describe("generateSwissPairings – retirement support", () => {
  it("skips players marked as retired when generating pairings", () => {
    const standings: StandingRow[] = [
      mkStanding("A", 9),
      mkStanding("B", 9, { retired: true }), // dropped
      mkStanding("C", 6),
      mkStanding("D", 3),
    ];

    const history: Match[] = []; // no constraints

    const res = generateSwissPairings(standings, history, {
      eventId: "retire-test",
    });

    const pairedIds = new Set<PlayerID>(
      res.pairings.flatMap((p) => [p.a, p.b])
    );
    if (res.bye) pairedIds.add(res.bye);

    // B is retired → must not appear anywhere
    expect(pairedIds.has("B")).toBe(false);

    // Everyone else should still appear (paired or bye)
    expect(pairedIds.has("A")).toBe(true);
    expect(pairedIds.has("C")).toBe(true);
    expect(pairedIds.has("D")).toBe(true);
  });

  it("behaves as before when no players are retired", () => {
    const standings: StandingRow[] = [
      mkStanding("A", 9),
      mkStanding("B", 9),
      mkStanding("C", 6),
      mkStanding("D", 3),
    ];

    const history: Match[] = [];

    const res = generateSwissPairings(standings, history, {
      eventId: "no-retire",
    });

    const pairedIds = new Set<PlayerID>(
      res.pairings.flatMap((p) => [p.a, p.b])
    );
    if (res.bye) pairedIds.add(res.bye);

    expect(pairedIds.has("A")).toBe(true);
    expect(pairedIds.has("B")).toBe(true);
    expect(pairedIds.has("C")).toBe(true);
    expect(pairedIds.has("D")).toBe(true);
  });
});
