// benchmarks/roundrobin-standings.bench.ts
//
// Round-Robin standings benchmark for rankings-core.
// 64 players → 2016 matches → 4032 match records.
//
// This is a realistic scale for many events and great for performance tracking.

import { performance } from "node:perf_hooks";
import { computeStandings, MatchResult } from "../src";

type PlayerId = string;

interface BenchConfig {
  players: number;
  iterations: number;
}

/**
 * Generate a full single round-robin (i < j).
 * Lower index always wins for determinism.
 */
function generateRoundRobinMatches(cfg: BenchConfig) {
  const players: PlayerId[] = Array.from(
    { length: cfg.players },
    (_, i) => `P${i + 1}`
  );

  const matches: any[] = [];
  let roundCounter = 1;

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]; // winner
      const b = players[j]; // loser

      matches.push({
        id: `r${roundCounter}-${a}-vs-${b}-a`,
        round: roundCounter,
        playerId: a,
        opponentId: b,
        result: MatchResult.WIN,
        gameWins: 2,
        gameLosses: 0,
      });

      matches.push({
        id: `r${roundCounter}-${a}-vs-${b}-b`,
        round: roundCounter,
        playerId: b,
        opponentId: a,
        result: MatchResult.LOSS,
        gameWins: 0,
        gameLosses: 2,
      });

      roundCounter++;
    }
  }

  return { matches, players };
}

function pretty(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

async function main() {
  const cfg: BenchConfig = {
    players: 64,
    iterations: 50,
  };

  console.log("=== rankings-core Round-Robin standings benchmark ===");
  console.log(`Players    : ${cfg.players}`);
  console.log(`Matches    : 2016 (4032 player match rows)`);
  console.log(`Iterations : ${cfg.iterations}`);
  console.log("");

  console.log("Generating match data...");
  const { matches } = generateRoundRobinMatches(cfg);

  console.log("Warm-up run...");
  computeStandings({
    mode: "roundrobin",
    matches,
    options: { eventId: "RR-WARMUP", acceptSingleEntryMatches: true },
  });

  const t0 = performance.now();

  for (let i = 0; i < cfg.iterations; i++) {
    const rows = computeStandings({
      mode: "roundrobin",
      matches,
      options: { eventId: `RR-${i}`, acceptSingleEntryMatches: true },
    });

    if (i === cfg.iterations - 1) {
      const top = rows[0];
      console.log(
        `Last run top player: ${top.playerId}, matchPoints=${top.matchPoints}`
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
