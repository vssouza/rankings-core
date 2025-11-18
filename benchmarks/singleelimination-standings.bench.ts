// benchmarks/singleelimination-standings.bench.ts
//
// Single Elimination standings benchmark for rankings-core.
// 2048 players → 2047 matches → 4094 match records.
//
// We simulate a pure single-elim tree:
// - Start with P1..P2048
// - Each round, players are paired in order; lower index always wins.
// - 11 rounds total (2^11 = 2048)
//
// This stresses computeSingleEliminationStandings (via computeStandings with mode:"singleelimination")
// and the seeding/eliminationRound logic on a large bracket.

import { performance } from "node:perf_hooks";
import { computeStandings, MatchResult } from "../src";
import type { SingleEliminationStandingRow } from "../src/standings/types";

type PlayerId = string;

interface BenchConfig {
  players: number;    // must be a power of two
  iterations: number;
}

/**
 * Generate a full single-elimination bracket worth of matches:
 * - `players` must be a power of two (e.g., 2048).
 * - Round 1 pairs P1 vs P2, P3 vs P4, ...
 * - Winners advance; losers are eliminated.
 * - Lower index always wins for determinism.
 *
 * Returns both the list of match records (two entries per match)
 * and the ordered list of initial players.
 */
function generateSingleElimMatches(cfg: BenchConfig): { matches: any[]; players: PlayerId[] } {
  const { players: count } = cfg;

  if (!isPowerOfTwo(count)) {
    throw new Error(`single-elim benchmark expects power-of-two players, got ${count}`);
  }

  const players: PlayerId[] = Array.from({ length: count }, (_, i) => `P${i + 1}`);
  const matches: any[] = [];

  let current = [...players];
  let round = 1;

  while (current.length > 1) {
    const nextRound: PlayerId[] = [];

    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];

      // by construction, a is the "higher seed" (lower index), and always wins
      matches.push({
        id: `r${round}-${a}-vs-${b}-a`,
        round,
        playerId: a,
        opponentId: b,
        result: MatchResult.WIN,
        gameWins: 2,
        gameLosses: 0,
      });

      matches.push({
        id: `r${round}-${a}-vs-${b}-b`,
        round,
        playerId: b,
        opponentId: a,
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
      });

      nextRound.push(a); // winner advances
    }

    current = nextRound;
    round++;
  }

  return { matches, players };
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function pretty(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

async function main() {
  const cfg: BenchConfig = {
    players: 2048,
    iterations: 50,
  };

  console.log("=== rankings-core Single Elimination standings benchmark ===");
  console.log(`Players    : ${cfg.players}`);
  console.log(`Matches    : ${cfg.players - 1} (≈ ${(cfg.players - 1) * 2} player match rows)`);
  console.log(`Iterations : ${cfg.iterations}`);
  console.log("");

  console.log("Generating match data...");
  const { matches, players } = generateSingleElimMatches(cfg);

  // Build a seeding map: P1 -> 1, P2 -> 2, ..., P2048 -> 2048
  const seeding: Record<string, number> = {};
  players.forEach((pid, idx) => {
    seeding[pid] = idx + 1;
  });

  console.log("Warm-up run...");
  computeStandings({
    mode: "singleelimination",
    matches,
    options: {
      eventId: "SE-WARMUP",
      seeding,
    },
  });

  const t0 = performance.now();

  for (let i = 0; i < cfg.iterations; i++) {
    const rawRows = computeStandings({
      mode: "singleelimination",
      matches,
      options: {
        eventId: `SE-${i}`,
        seeding,
      },
    });

    // Narrow the type so TS knows about eliminationRound
    const rows = rawRows as SingleEliminationStandingRow[];

    if (i === cfg.iterations - 1) {
      const champ = rows[0];
      console.log(
        `Last run champion: ${champ.playerId}, ` +
        `eliminationRound=${champ.eliminationRound}, ` +
        `matchPoints=${champ.matchPoints}`
      );
    }
  }

  const t1 = performance.now();

  const total = t1 - t0;
  const per = total / cfg.iterations;

  console.log("");
  console.log(`Total time : ${pretty(total)} (${cfg.iterations} runs)`);
  console.log(`Per run    : ${pretty(per)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
