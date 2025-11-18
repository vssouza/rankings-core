// benchmarks/swiss-standings.bench.ts
//
// Simple Swiss standings benchmark for rankings-core.
// Generates synthetic data for N players over R rounds and times computeStandings.

import { performance } from "node:perf_hooks";
// Adjust this import to match your project entry if needed:
import { computeStandings, MatchResult } from "../src";

type PlayerId = string;

interface BenchConfig {
  players: number;
  rounds: number;
  iterations: number;
}

/**
 * Generate a deterministic Swiss-like set of matches.
 * - All players start at 0 points.
 * - Each round, players are paired in order (0 vs 1, 2 vs 3, ...)
 * - Lower index always wins (to keep things simple & deterministic).
 */
function generateSwissMatches(cfg: BenchConfig): { matches: any[]; players: PlayerId[] } {
  if (cfg.players % 2 !== 0) {
    throw new Error("This simple benchmark expects an even number of players.");
  }

  const players: PlayerId[] = [];
  for (let i = 0; i < cfg.players; i++) {
    players.push(`P${i + 1}`);
  }

  const matches: any[] = [];

  for (let round = 1; round <= cfg.rounds; round++) {
    for (let i = 0; i < players.length; i += 2) {
      const a = players[i];
      const b = players[i + 1];

      matches.push({
        id: `r${round}-${a}`,
        round,
        playerId: a,
        opponentId: b,
        result: MatchResult.WIN,
        gameWins: 2,
        gameLosses: 0,
      });
      matches.push({
        id: `r${round}-${b}`,
        round,
        playerId: b,
        opponentId: a,
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
      });
    }
  }

  return { matches, players };
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

async function main() {
  const cfg: BenchConfig = {
    players: 2048,
    rounds: 9,
    iterations: 20, // you can bump this if it's still very fast
  };

  console.log("=== rankings-core Swiss standings benchmark ===");
  console.log(`Players    : ${cfg.players}`);
  console.log(`Rounds     : ${cfg.rounds}`);
  console.log(`Iterations : ${cfg.iterations}`);
  console.log("");

  const { matches } = generateSwissMatches(cfg);

  // Warm-up run
  computeStandings({
    mode: "swiss",
    matches,
    options: {
      eventId: "BENCH-SWISS-WARMUP",
    },
  });

  const t0 = performance.now();

  for (let i = 0; i < cfg.iterations; i++) {
    const rows = computeStandings({
      mode: "swiss",
      matches,
      options: {
        eventId: `BENCH-SWISS-${i}`,
      },
    });

    if (i === cfg.iterations - 1) {
      const top = rows[0];
      console.log(
        `Last run champion: ${top.playerId}, matchPoints=${top.matchPoints}`
      );
    }
  }

  const t1 = performance.now();
  const totalMs = t1 - t0;
  const perIter = totalMs / cfg.iterations;

  console.log("");
  console.log(`Total time: ${formatMs(totalMs)} for ${cfg.iterations} iterations`);
  console.log(`Per run  : ${formatMs(perIter)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
