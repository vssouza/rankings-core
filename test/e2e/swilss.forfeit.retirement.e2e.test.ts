// test/e2e/swiss.forfeit.retirement.e2e.test.ts
import { describe, it, expect } from "vitest";
import {
  computeStandings,
  generateSwissPairings,
  MatchResult,
  tagRetired,
  createForfeitMatchesForRetirements,
  type Match,
  type StandingRow,
} from "../../src";

describe("Swiss retirement with forfeit – end-to-end flow", () => {
  /**
   * Scenario:
   *   Players: A, B, C
   *
   *   R1:
   *     A beats B (2–0)
   *     C gets BYE
   *
   *   R2:
   *     C beats A (2–0)
   *     B gets BYE
   *
   *   → We then:
   *     1. Compute standings after R2.
   *     2. Generate Swiss pairings for R3.
   *     3. Mark ONE of the paired players as retiring with forfeit.
   *     4. Use createForfeitMatchesForRetirements to synthesize forfeit results.
   *     5. Recompute standings and verify:
   *        - Opponent gained MP and a win.
   *        - Retired player gained a loss.
   *     6. Tag the retired player and generate R4 pairings:
   *        - Retired player should NOT appear in pairings or as bye.
   */

  const baseMatches: Match[] = [
    // --- Round 1: A vs B, C gets BYE
    {
      id: "r1-A-B-a",
      round: 1,
      playerId: "A",
      opponentId: "B",
      result: MatchResult.WIN,
      gameWins: 2,
      gameLosses: 0,
      gameDraws: 0,
    },
    {
      id: "r1-B-A-b",
      round: 1,
      playerId: "B",
      opponentId: "A",
      result: MatchResult.LOSS,
      gameWins: 0,
      gameLosses: 2,
      gameDraws: 0,
    },
    {
      id: "r1-C-bye",
      round: 1,
      playerId: "C",
      opponentId: null,
      result: MatchResult.BYE,
      gameWins: 0,
      gameLosses: 0,
      gameDraws: 0,
    },

    // --- Round 2: C vs A, B gets BYE
    {
      id: "r2-C-A-c",
      round: 2,
      playerId: "C",
      opponentId: "A",
      result: MatchResult.WIN,
      gameWins: 2,
      gameLosses: 0,
      gameDraws: 0,
    },
    {
      id: "r2-A-C-a",
      round: 2,
      playerId: "A",
      opponentId: "C",
      result: MatchResult.LOSS,
      gameWins: 0,
      gameLosses: 2,
      gameDraws: 0,
    },
    {
      id: "r2-B-bye",
      round: 2,
      playerId: "B",
      opponentId: null,
      result: MatchResult.BYE,
      gameWins: 0,
      gameLosses: 0,
      gameDraws: 0,
    },
  ];

  it("gives the opponent a forfeit win and excludes the retired player from future Swiss pairings", () => {
    const eventId = "SWISS-FORFEIT-E2E";

    // --- Step 1: standings after Round 2
    const afterR2 = computeStandings({
      mode: "swiss",
      matches: baseMatches,
      options: { eventId },
    }) as StandingRow[];

    // Snapshot of MP before forfeits
    const mpBefore: Record<string, number> = {};
    for (const row of afterR2) {
      mpBefore[row.playerId] = row.matchPoints;
    }

    // --- Step 2: generate Swiss pairings for Round 3
    const pairingsR3 = generateSwissPairings(afterR2, baseMatches, {
      eventId,
    });

    // Sanity: we expect at least one concrete pairing
    expect(pairingsR3.pairings.length).toBeGreaterThanOrEqual(1);

    const firstPair = pairingsR3.pairings[0];
    const playerA = firstPair.a;
    const playerB = firstPair.b;

    // We'll retire playerB with forfeit in this round
    const retiringThisRound = [playerB];

    // --- Step 3: synthesize FORFEIT_WIN / FORFEIT_LOSS matches for Round 3
    const forfeitMatches = createForfeitMatchesForRetirements({
      round: 3,
      pairings: pairingsR3.pairings,
      retired: retiringThisRound,
      existingMatches: baseMatches,
    });

    // Exactly 2 mirrored matches should be created for this pairing
    expect(forfeitMatches).toHaveLength(2);

    const allMatchesWithForfeit = [...baseMatches, ...forfeitMatches];

    // --- Step 4: recompute standings after applying forfeits
    const afterR3 = computeStandings({
      mode: "swiss",
      matches: allMatchesWithForfeit,
      options: { eventId },
    }) as StandingRow[];

    const rowA = afterR3.find((r) => r.playerId === playerA)!;
    const rowB = afterR3.find((r) => r.playerId === playerB)!;

    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();

    // Default Swiss points are 3 (win), 1 (draw), 0 (loss), 3 (bye).
    // Forfeit should behave like a win/loss for match points.
    expect(rowA.matchPoints).toBeGreaterThan(mpBefore[playerA]);
    expect(rowB.matchPoints).toBe(mpBefore[playerB]); // loss adds 0 MP

    // Also reflect an additional win/loss in record
    expect(rowA.wins).toBeGreaterThan(
      (afterR2.find((r) => r.playerId === playerA)?.wins ?? 0),
    );
    expect(rowB.losses).toBeGreaterThan(
      (afterR2.find((r) => r.playerId === playerB)?.losses ?? 0),
    );

    // --- Step 5: mark the retired player as retired for all FUTURE rounds
    const tagged = tagRetired(afterR3, retiringThisRound);

    const retiredRow = tagged.find((r) => r.playerId === playerB)!;
    expect(retiredRow.retired).toBe(true);

    // --- Step 6: generate Round 4 Swiss pairings; retired player should not appear
    const pairingsR4 = generateSwissPairings(tagged, allMatchesWithForfeit, {
      eventId,
    });

    const allPairedIds = pairingsR4.pairings
      .flatMap((p) => [p.a, p.b])
      .filter(Boolean);

    expect(allPairedIds).not.toContain(playerB);
    if (pairingsR4.bye) {
      expect(pairingsR4.bye).not.toBe(playerB);
    }
  });
});
