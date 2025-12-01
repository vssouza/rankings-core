// test/e2e/swiss.topcut.retirement.e2e.test.ts
import { describe, it, expect } from "vitest";

import {
  computeStandings,
  generatePairings,
  generateSingleEliminationBracket,
  applyResult,
  MatchResult,
  tagRetired,
  computeTopCutSeeds,
  mergeSwissTopCutStandings,
  type StandingRow,
  type PlayerID,
} from "../../src";

// Helper to build 64 players: P01..P64
function buildPlayers(count: number): PlayerID[] {
  return Array.from({ length: count }, (_, i) =>
    `P${String(i + 1).padStart(2, "0")}`
  );
}

// Minimal initial Swiss standings for Round 1 (all 0-0, ranked by id)
function buildInitialSwissStandings(players: PlayerID[]): StandingRow[] {
  return players.map((playerId, idx) => ({
    playerId,
    rank: idx + 1,
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
  }));
}

// Helper for reading playerIds from single-elim slots
const pidFromSlot = (s: any): string | undefined =>
  s && s.kind === "seed" ? s.playerId : undefined;

describe("E2E – 64-player Swiss → top cut with retirements", () => {
  it("runs Swiss with retirements, builds top cut seeds, and merges final standings", () => {
    const EVENT_ID = "E2E-SWISS-TOPCUT-64";
    const ROUNDS = 6;
    const CUT_SIZE = 8;

    const players = buildPlayers(64);
    const allMatches: {
      id: string;
      round: number;
      playerId: PlayerID;
      opponentId: PlayerID | null;
      result: MatchResult;
      gameWins: number;
      gameLosses: number;
      gameDraws: number;
    }[] = [];

    // Track retired player IDs across rounds
    const retired = new Set<PlayerID>();

    // ---------------- Swiss phase with retirements ----------------
    for (let round = 1; round <= ROUNDS; round++) {
      let standingsForPairings: StandingRow[];

      if (round === 1) {
        // Round 1: synthetic initial Swiss standings based on seeding
        standingsForPairings = buildInitialSwissStandings(players);
      } else {
        // Compute Swiss standings from all previous matches
        const swissRows = computeStandings({
          mode: "swiss",
          matches: allMatches,
          options: { eventId: EVENT_ID },
        }) as StandingRow[];

        // Re-apply previously retired flags
        const withExistingRetired = swissRows.map((r) =>
          retired.has(r.playerId) ? { ...r, retired: true } : r
        );

        // At a chosen point (e.g. after Round 3), retire some low-ranked players
        if (round === 4) {
          const sortedByRank = [...withExistingRetired].sort(
            (a, b) => a.rank - b.rank
          );
          // Retire the bottom 4 players who are not already retired
          const newlyRetired = sortedByRank
            .slice(-4)
            .map((r) => r.playerId)
            .filter((pid) => !retired.has(pid));

          newlyRetired.forEach((pid) => retired.add(pid));
        }

        standingsForPairings = tagRetired(
          withExistingRetired,
          Array.from(retired)
        );
      }

      // Generate Swiss pairings for this round, respecting retired players
      const pairingResult = generatePairings({
        mode: "swiss",
        standings: standingsForPairings,
        history: allMatches,
        options: {
          eventId: EVENT_ID,
          // Swiss pairings treat retired === true as withdrawn; this keeps
          // the option wired up for future behaviour extensions.
          retirementMode: "withdraw",
        } as any,
      });

      const roundPairings = pairingResult.pairings;
      const roundBye = pairingResult.bye;

      // Assert: no retired players appear in pairings or as the BYE
      for (const p of roundPairings) {
        expect(retired.has(p.a)).toBe(false);
        expect(retired.has(p.b)).toBe(false);
      }
      if (roundBye) {
        expect(retired.has(roundBye)).toBe(false);
      }

      // Create match results for this round.
      // Deterministic rule: odd rounds → "a" wins, even rounds → "b" wins.
      for (const p of roundPairings) {
        const winnerIsA = round % 2 === 1;
        const winner = winnerIsA ? p.a : p.b;
        const loser = winnerIsA ? p.b : p.a;

        allMatches.push(
          {
            id: `r${round}-${winner}-vs-${loser}-W`,
            round,
            playerId: winner,
            opponentId: loser,
            result: MatchResult.WIN,
            gameWins: 2,
            gameLosses: 0,
            gameDraws: 0,
          },
          {
            id: `r${round}-${loser}-vs-${winner}-L`,
            round,
            playerId: loser,
            opponentId: winner,
            result: MatchResult.LOSS,
            gameWins: 0,
            gameLosses: 2,
            gameDraws: 0,
          }
        );
      }

      // BYE result, if any
      if (roundBye) {
        allMatches.push({
          id: `r${round}-${roundBye}-BYE`,
          round,
          playerId: roundBye,
          opponentId: null,
          result: MatchResult.BYE,
          gameWins: 2,
          gameLosses: 0,
          gameDraws: 0,
        });
      }
    }

    // Final Swiss standings after all rounds
    const finalSwiss = computeStandings({
      mode: "swiss",
      matches: allMatches,
      options: { eventId: EVENT_ID },
    }) as StandingRow[];

    // Propagate retirement flags into final standings
    const finalWithRetired = tagRetired(
      finalSwiss,
      Array.from(retired)
    ) as StandingRow[];

    // ---------------- Top cut seeding via helper ----------------

    const seeds = computeTopCutSeeds(finalWithRetired, CUT_SIZE);

    // Basic invariants for seeds
    expect(seeds.length).toBe(CUT_SIZE);
    // No retired players in the cut
    for (const s of seeds) {
      expect(retired.has(s.playerId)).toBe(false);
    }
    // Seeds should be ordered by increasing sourceRank (best Swiss first)
    const sourceRanks = seeds.map((s) => s.sourceRank);
    for (let i = 1; i < sourceRanks.length; i++) {
      expect(sourceRanks[i]).toBeGreaterThanOrEqual(sourceRanks[i - 1]);
    }

    // ---------------- Single-elim top cut phase ----------------

    // Build a single-elimination bracket from these seeds
    const bracket = generateSingleEliminationBracket(seeds, {
      thirdPlace: true,
    });

    expect(bracket.meta.entrants).toBe(CUT_SIZE);
    expect(bracket.meta.size).toBe(8); // next power-of-two of 8 is 8
    expect(bracket.rounds[0].length).toBe(4); // 8 players → 4 quarterfinals

    // Build a seed map so we can deterministically decide winners:
    // lower seed number always wins.
    const seedMap: Record<PlayerID, number> = Object.create(null);
    for (const s of seeds) {
      seedMap[s.playerId] = s.seed;
    }

    const seMatches: {
      id: string;
      round: number;
      playerId: PlayerID;
      opponentId: PlayerID | null;
      result: MatchResult;
      gameWins: number;
      gameLosses: number;
      gameDraws: number;
    }[] = [];

    // Play through all bracket rounds
    for (const round of bracket.rounds) {
      for (const m of round) {
        const a = pidFromSlot(m.a);
        const b = pidFromSlot(m.b);
        if (!a || !b) continue; // should not happen for 8-player full bracket

        const winner =
          (seedMap[a] ?? Number.MAX_SAFE_INTEGER) <
          (seedMap[b] ?? Number.MAX_SAFE_INTEGER)
            ? a
            : b;
        const loser = winner === a ? b : a;

        applyResult(bracket, m.id, { winner });

        seMatches.push(
          {
            id: `${m.id}-${winner}-W`,
            round: m.round,
            playerId: winner,
            opponentId: loser,
            result: MatchResult.WIN,
            gameWins: 2,
            gameLosses: 0,
            gameDraws: 0,
          },
          {
            id: `${m.id}-${loser}-L`,
            round: m.round,
            playerId: loser,
            opponentId: winner,
            result: MatchResult.LOSS,
            gameWins: 0,
            gameLosses: 2,
            gameDraws: 0,
          }
        );
      }
    }

    // Bronze match (if present) will have its slots filled after semis
    if (bracket.thirdPlace) {
      const m = bracket.thirdPlace;
      const a = pidFromSlot(m.a);
      const b = pidFromSlot(m.b);
      if (a && b) {
        const winner =
          (seedMap[a] ?? Number.MAX_SAFE_INTEGER) <
          (seedMap[b] ?? Number.MAX_SAFE_INTEGER)
            ? a
            : b;
        const loser = winner === a ? b : a;

        applyResult(bracket, m.id, { winner });

        seMatches.push(
          {
            id: `${m.id}-${winner}-W`,
            round: m.round,
            playerId: winner,
            opponentId: loser,
            result: MatchResult.WIN,
            gameWins: 2,
            gameLosses: 0,
            gameDraws: 0,
          },
          {
            id: `${m.id}-${loser}-L`,
            round: m.round,
            playerId: loser,
            opponentId: winner,
            result: MatchResult.LOSS,
            gameWins: 0,
            gameLosses: 2,
            gameDraws: 0,
          }
        );
      }
    }

    // Compute top-cut standings from the single-elim matches
    const topCutStandings = computeStandings({
      mode: "singleelimination",
      matches: seMatches,
      options: {
        eventId: `${EVENT_ID}-TOPCUT`,
        // seeding is optional here for this test; ordering is driven by results
      },
    }) as any[];

    // ---------------- Merge Swiss + top cut into final table ----------------

    const merged = mergeSwissTopCutStandings(finalWithRetired, topCutStandings as any);

    // Basic invariants for merged table
    expect(merged.length).toBe(finalSwiss.length);
    expect(new Set(merged.map((r) => r.playerId))).toEqual(
      new Set(finalSwiss.map((r) => r.playerId))
    );

    const mergedTopIds = merged.slice(0, CUT_SIZE).map((r) => r.playerId);
    const cutIds = new Set(seeds.map((s) => s.playerId));

    // All top-cut players should be in the first CUT_SIZE ranks
    for (const id of cutIds) {
      expect(mergedTopIds).toContain(id);
    }

    // No retired players should appear in the top cut zone
    for (const id of mergedTopIds) {
      expect(retired.has(id)).toBe(false);
    }

    // Champion from top cut should be merged rank 1.
    // Our deterministic winner logic makes the lowest seed the champion.
    const expectedChampion = seeds[0].playerId;
    expect(merged[0].playerId).toBe(expectedChampion);
  });
});
