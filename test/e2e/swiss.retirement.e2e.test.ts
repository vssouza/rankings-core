// test/e2e/swiss.retirement.e2e.test.ts
import { describe, it, expect } from "vitest";
import * as api from "../../src";
import type { Match, StandingRow, PlayerID } from "../../src";

const mkMatch = (
  id: string,
  round: number,
  playerId: PlayerID,
  opponentId: PlayerID | null,
  result: api.MatchResult
): Match => ({
  id,
  round,
  playerId,
  opponentId,
  result,
});

const tagRetired = (
  rows: ReadonlyArray<StandingRow>,
  retiredIds: ReadonlyArray<PlayerID>
): StandingRow[] => {
  const set = new Set(retiredIds);
  return rows.map((r) => ({ ...r, retired: set.has(r.playerId) }));
};

describe("E2E – Swiss retirement flow", () => {
  it("keeps previous results but skips retired players from future pairings", () => {
    // Round 1: full 4-player Swiss, everyone plays.
    // A beats B, C beats D.
    const r1Matches: Match[] = [
      mkMatch("R1-A-B-A", 1, "A", "B", api.MatchResult.WIN),
      mkMatch("R1-B-A-B", 1, "B", "A", api.MatchResult.LOSS),
      mkMatch("R1-C-D-C", 1, "C", "D", api.MatchResult.WIN),
      mkMatch("R1-D-C-D", 1, "D", "C", api.MatchResult.LOSS),
    ];

    // Compute standings after Round 1 via public dispatcher
    const standingsAfterR1 = api.computeStandings({
      mode: "swiss",
      matches: r1Matches,
      options: { eventId: "RET-E2E" },
    }) as StandingRow[];

    // Sanity: all four players are present
    const idsR1 = new Set(standingsAfterR1.map((r) => r.playerId));
    expect(idsR1).toEqual(new Set(["A", "B", "C", "D"]));

    // Now B retires/drops from the event
    const retiredIds: PlayerID[] = ["B"];
    const standingsWithRetired = tagRetired(standingsAfterR1, retiredIds);

    // Generate pairings for "Round 2" from these standings
    const pairingsRes = api.generatePairings({
      mode: "swiss",
      standings: standingsWithRetired,
      history: r1Matches,
      options: { eventId: "RET-E2E" },
    });

    const pairedIds = new Set<PlayerID>(
      pairingsRes.pairings.flatMap((p) => [p.a, p.b])
    );
    if (pairingsRes.bye) pairedIds.add(pairingsRes.bye);

    // B should NOT appear in any pairing or as a bye
    expect(pairedIds.has("B")).toBe(false);

    // All non-retired players should still appear (either paired or bye)
    expect(pairedIds.has("A")).toBe(true);
    expect(pairedIds.has("C")).toBe(true);
    expect(pairedIds.has("D")).toBe(true);
  });
});
