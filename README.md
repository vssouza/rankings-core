# 🏆 rankings-core

A zero-dependency TypeScript library to compute and manage **tournament standings**, **pairings**, and **ratings** — supporting **Swiss**, **Round-Robin**, and **Single Elimination** formats — with modern tie-breakers such as **Buchholz (OMW%)**, **Game Win % (GWP)**, **Opponent Game Win % (OGWP)**, and **Sonneborn–Berger (SB)**.  

Includes **ELO rating updates** for leagues and persistent skill tracking, plus an optional **WebAssembly (WASM)** build for ultra-fast browser use.

Repo: [rankings-core GitHub](https://github.com/vssouza/rankings-core)

---

## ✨ Features

- 🧮 **Standings**
  - Swiss · Round-Robin · Single Elimination modes
  - Head-to-head resolving inside tie blocks (Swiss & RR)
  - Sonneborn–Berger (SB), OMW%, GWP, OGWP
  - Deterministic seed-based fallback ordering
  - BYEs, forfeits, penalties, and *double-losses* handled correctly
  - `acceptSingleEntryMatches` for lenient ingestion (auto-mirrors missing results)
  - `eliminationRound` field for Single Elimination to indicate round reached  
    - Non-champions: `eliminationRound === last.round`  
    - Champion: `eliminationRound === maxRound + 1`  
  - Optional bronze match semantics (via `useBronzeMatch` in single-elim standings)
  - **Virtual Bye Player** for Swiss tie-breakers — include BYE rounds in OMW%/OGWP calculations as if played vs a fixed virtual opponent
  - **Retired / dropped players** — mark players as retired on `StandingRow` (or via `tagRetired`) so Swiss pairings skip them when generating future rounds

- 🤝 **Pairings**
  - Swiss pairing generator (avoids rematches, assigns/rotates byes, light backtracking)
  - Swiss pairings respect `StandingRow.retired` and never pair or assign a BYE to dropped players
  - Round-Robin schedule generator (supports odd/even players, stable byes)
  - Single Elimination bracket generator — build bracket from seeds, auto-advance R1 BYEs, route losers to bronze match if enabled
  - Seed interleaving helper (`seedPositions(size)`) for standard 1-vs-N placement

- 📈 **Ratings**
  - ELO updates (sequential & simultaneous batch modes)
  - Custom K, KDraw, per-player K, caps/floors, and `drawScore`
  - Reasonable defaults so you can get started quickly

- ⚙️ **Engineering**
  - 100% TypeScript, zero runtime dependencies
  - Vitest test suite with high coverage on core logic
  - Optional WebAssembly target for in-browser speedups

---

## 📦 Installation

```bash
npm install rankings-core
# or
yarn add rankings-core
# or
pnpm add rankings-core
```

---

## 🧩 Standings API

The library computes standings for:

- **Swiss** tournaments
- **Round-Robin** tournaments
- **Single Elimination** brackets

> NOTE: The examples below assume a `computeStandings` dispatcher of the form  
> `computeStandings({ mode: "swiss" | "roundrobin" | "singleelimination", matches, options })`.  
> If you prefer, you can also call the mode-specific helpers (e.g. `computeSingleEliminationStandings`) directly.

---

### Swiss example (with Virtual Bye Player)

```ts
import { computeStandings, MatchResult } from "rankings-core";

const matches = [
  { id: "r1-a", round: 1, playerId: "A", opponentId: null, result: MatchResult.BYE },
  { id: "r1-b", round: 1, playerId: "B", opponentId: "C", result: MatchResult.WIN },
  { id: "r1-c", round: 1, playerId: "C", opponentId: "B", result: MatchResult.LOSS },

  { id: "r2-a", round: 2, playerId: "A", opponentId: "B", result: MatchResult.WIN },
  { id: "r2-b", round: 2, playerId: "B", opponentId: "A", result: MatchResult.LOSS },
];

// Enable the virtual-bye feature (optional)
const swiss = computeStandings({
  mode: "swiss",
  matches,
  options: {
    eventId: "SWISS-VIRTUAL",
    tiebreakVirtualBye: {
      enabled: true,
      mwp: 0.5, // virtual opponent match win%
      gwp: 0.5, // virtual opponent game win%
    },
  },
});

console.table(
  swiss.map((r) => ({
    Rank: r.rank,
    Player: r.playerId,
    MP: r.matchPoints,
    OMW: r.omwp.toFixed(3),
    OGWP: r.ogwp.toFixed(3),
    GWP: r.gwp.toFixed(3),
  }))
);
```

**Virtual bye behaviour:**
- Each BYE a player receives contributes a **virtual opponent** into OMW%/OGWP.
- The virtual opponent is *not* shown anywhere, only affects tie-break math.
- You control its “strength” via `tiebreakVirtualBye.mwp` and `gwp`.
- Respects tie-break floors like `tiebreakFloors.opponentPctFloor`.

---

### Swiss – Retired / dropped players

For Swiss events you can mark players as **retired/dropped** so they no longer
receive pairings or BYEs in future rounds.

1. Compute standings as usual.
2. Tag which players have retired (via `tagRetired` or by setting `retired: true` yourself).
3. Generate Swiss pairings from those tagged standings.

```ts
import {
  computeStandings,
  generateSwissPairings,
  MatchResult,
  tagRetired,
} from "rankings-core";

const matches = [
  // Round 1
  { id: "r1-a1", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WIN },
  { id: "r1-b1", round: 1, playerId: "B", opponentId: "A", result: MatchResult.LOSS },
  { id: "r1-c1", round: 1, playerId: "C", opponentId: "D", result: MatchResult.WIN },
  { id: "r1-d1", round: 1, playerId: "D", opponentId: "C", result: MatchResult.LOSS },
];

// 1) Compute Swiss standings after Round 1
const swissRows = computeStandings({
  mode: "swiss",
  matches,
  options: { eventId: "MY-SWISS" },
});

// 2) Suppose B drops from the event
const retiredIds = ["B"];

// Use helper to mark dropped players (adds `retired?: boolean` to StandingRow)
const standingsWithRetired = tagRetired(swissRows, retiredIds);

// 3) Generate pairings for the next round
const pairingResult = generateSwissPairings(standingsWithRetired, matches, {
  eventId: "MY-SWISS",
  // retirementMode is reserved for future behaviour; currently both modes act as "withdraw"
  retirementMode: "withdraw",
});

// pairingResult.pairings and pairingResult.bye will never include player "B"
```

Notes:
- `StandingRow` has an optional `retired?: boolean` flag.
- Swiss pairings (`generateSwissPairings`) ignore rows where `retired === true`:
  - They will not be paired.
  - They will never receive the BYE.
- You can either set `retired` yourself or use the `tagRetired(rows, retiredIds)` helper.

---

### Round-Robin example (with single-entry ingestion)

```ts
import { computeStandings, MatchResult } from "rankings-core";

const matches = [
  {
    id: "m1-a",
    round: 1,
    playerId: "A",
    opponentId: "B",
    result: MatchResult.WIN,
    gameWins: 2,
    gameLosses: 0,
  },
  {
    id: "m2-a",
    round: 1,
    playerId: "C",
    opponentId: "A",
    result: MatchResult.WIN,
    gameWins: 2,
    gameLosses: 0,
  },
];

const rr = computeStandings({
  mode: "roundrobin",
  matches,
  options: {
    eventId: "RR-DEMO",
    // if only one side of a match is provided, the library will mirror it
    acceptSingleEntryMatches: true,
  },
});

console.table(rr);
```

---

### Single Elimination example (standings)

```ts
import { computeStandings, MatchResult } from "rankings-core";

const matches = [
  // Semifinals
  { id: "sf1-a", round: 1, playerId: "A", opponentId: "B", result: MatchResult.WWIN },
  { id: "sf1-b", round: 1, playerId: "B", opponentId: "A", result: MatchResult.LOSS },
  { id: "sf2-c", round: 1, playerId: "C", opponentId: "D", result: MatchResult.WIN },
  { id: "sf2-d", round: 1, playerId: "D", opponentId: "C", result: MatchResult.LOSS },

  // Final
  { id: "f-a", round: 2, playerId: "A", opponentId: "C", result: MatchResult.WIN },
  { id: "f-c", round: 2, playerId: "C", opponentId: "A", result: MatchResult.LOSS },
];

const standings = computeStandings({
  mode: "singleelimination",
  matches,
  options: {
    eventId: "SE-DEMO",
    seeding: { A: 1, C: 2, B: 3, D: 4 },
    // useBronzeMatch: true  // if you run a separate bronze match
  },
});

console.table(
  standings.map((r) => ({
    Rank: r.rank,
    Player: r.playerId,
    EliminationRound: r.eliminationRound,
  }))
);
```

**`eliminationRound` semantics:**
- Let `maxRound` be the deepest round seen in `matches`.
- If a player **wins** a match in `maxRound`, they are the champion:  
  `eliminationRound = maxRound + 1`.
- Otherwise, `eliminationRound = last.round` where they played.
- In a **double-loss final** (no champion), both finalists receive:  
  `eliminationRound = maxRound`, and are ordered by seeding as a fallback.

---

### `computeStandings` options (overview)

```ts
type Mode = "swiss" | "roundrobin" | "singleelimination";

interface ComputeStandingsRequest {
  mode: Mode;
  matches: Match[];
  options?: {
    eventId?: string;

    // common
    applyHeadToHead?: boolean;
    tiebreakFloors?: {
      opponentPctFloor?: number; // floor for opponent pct in OMW%, OGWP
    };
    points?: {
      win?: number;
      draw?: number;
      loss?: number;
      bye?: number;
    };
    acceptSingleEntryMatches?: boolean;

    // seeding & penalties
    seeding?: Record<string, number>;
    // useBronzeMatch?: boolean; // single-elim semantic flag (if enabled in code)

    // Swiss only: virtual bye opponent
    tiebreakVirtualBye?: {
      enabled?: boolean;
      mwp?: number; // match win% of virtual opponent
      gwp?: number; // game win% of virtual opponent
    };

    // Retirement mode (reserved for future behaviour expansion)
    // Currently, Swiss pairings treat `StandingRow.retired === true` as "withdrawn"
    // when you call `generateSwissPairings` with those rows.
    retirementMode?: "withdraw" | "forfeit";
  };
}
```

---

## ♻️ Pairings & Brackets

The library includes pairing helpers for Swiss, Round-Robin, and Single Elimination.  
The exact facades may differ depending on how you wire them; below are typical usage patterns.

---

### Swiss Pairings (example facade)

```ts
import { generatePairings } from "rankings-core";

const standings = [
  { playerId: "A", matchPoints: 9, rank: 1, opponents: [] },
  { playerId: "B", matchPoints: 9, rank: 2, opponents: [] },
  { playerId: "C", matchPoints: 6, rank: 3, opponents: [] },
  { playerId: "D", matchPoints: 6, rank: 4, opponents: [] },
  { playerId: "E", matchPoints: 3, rank: 5, opponents: [] },
];

const result = generatePairings({
  mode: "swiss",
  standings,
  history: [], // previous rounds' pairings for rematch avoidance
  options: {
    eventId: "ROUND-3",
    protectTopN: 2, // optional: avoid top vs top until needed
  },
});

console.log(result);
/*
{
  pairings: [ { a: "A", b: "B" }, { a: "C", b: "D" } ],
  bye: "E",
  downfloats: {...},
  rematchesUsed: []
}
*/
```

You can also pass in standings that include `retired: true` (for example, via `tagRetired(...)`):

```ts
const taggedStandings = [
  { playerId: "A", matchPoints: 9, rank: 1, opponents: [], retired: false },
  { playerId: "B", matchPoints: 9, rank: 2, opponents: [], retired: true }, // dropped
  { playerId: "C", matchPoints: 6, rank: 3, opponents: [], retired: false },
  { playerId: "D", matchPoints: 6, rank: 4, opponents: [], retired: false },
];

const nextRound = generatePairings({
  mode: "swiss",
  standings: taggedStandings,
  history: [],
  options: { eventId: "ROUND-4" },
});

// Player "B" will not appear in `nextRound.pairings` or as `nextRound.bye`
```

---

### Round-Robin Pairings (per round)

```ts
import { generatePairings } from "rankings-core";

const rr = generatePairings({
  mode: "roundrobin",
  players: ["A", "B", "C", "D", "E"],
  roundNumber: 2,
});

console.log(rr);
/*
{
  pairings: [ { a: "A", b: "C" }, { a: "B", b: "D" } ],
  round: 2,
  byes: ["E"],
  bye: "E"
}
*/
```

Or build all rounds up front:

```ts
import { buildRoundRobinSchedule } from "rankings-core";

const rounds = buildRoundRobinSchedule(["A", "B", "C", "D"]);
/*
[
  { round: 1, pairings: [{ a: "A", b: "B" }, { a: "C", b: "D" }], byes: [] },
  { round: 2, pairings: [{ a: "A", b: "C" }, { a: "B", b: "D" }], byes: [] },
  { round: 3, pairings: [{ a: "A", b: "D" }, { a: "B", b: "C" }], byes: [] }
]
*/
```

---

### Single Elimination Bracket (low-level)

```ts
import {
  generateSingleEliminationBracket,
  applyResult,
  autoAdvanceByes,
  seedPositions,
} from "rankings-core";

const bracket = generateSingleEliminationBracket(
  [
    { playerId: "A", seed: 1 },
    { playerId: "B", seed: 2 },
    { playerId: "C", seed: 3 },
    { playerId: "D", seed: 4 },
    { playerId: "E", seed: 5 },
  ],
  { bestOf: 3, thirdPlace: true }
);

// R1 BYEs auto-advance on generation; you can call this again if you mutate:
autoAdvanceByes(bracket);

// Report a result by match id (best-of is managed by your app, you just send winner):
applyResult(bracket, "R1-M1", { winner: "A" });

// Semifinal losers route to the "BRONZE" match automatically when `thirdPlace: true`.

console.log(seedPositions(8)); // [1, 8, 4, 5, 2, 7, 3, 6]
```

This bracket structure is compatible with `computeSingleEliminationStandings` if you adapt its matches into the standing `Match[]` format.

---

## 📊 Ratings (ELO)

```ts
import { updateEloRatings } from "rankings-core";

const base = { Alice: 1500, Bob: 1500 };
const matches = [{ a: "Alice", b: "Bob", result: "A" }];

const { ratings } = updateEloRatings(base, matches, { K: 32 });

console.log(ratings);
// -> { Alice: 1516, Bob: 1484 }
```

Advanced options:

```ts
interface EloOptions {
  K?: number;                         // base K (default 32)
  KDraw?: number;                     // K used on draws (default = K)
  perPlayerK?: Record<string, number>;

  drawScore?: number;                 // default 0.5 (e.g., 0.6 for near-wins)
  floor?: number;
  cap?: number;                       // rating bounds
  initialRating?: number;             // unseen players (default 1500)

  mode?: "sequential" | "simultaneous";
}
```

---

## ⚡ WebAssembly (optional)

The project includes an optional **WASM build** for performance-critical browser use (e.g. large, client-side Swiss events).

Typical pattern:

1. Build the WASM artifact (e.g. `ratings.wasm`) using your build script.
2. Serve it as a static asset in your app.
3. Use a small loader/bridge to instantiate it and call the exported functions.

> The exact wire-up depends on your bundler and deployment environment. The TypeScript implementation remains the primary, portable implementation; WASM is an opt-in speedup layer.

Example consumer-side sketch:

```ts
let wasmInstance: WebAssembly.Instance | null = null;

export async function initRatingsWasm(url = "/ratings.wasm") {
  const res = await fetch(url);
  const bytes = await res.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {});
  wasmInstance = instance;
}

export function expectedScoreWasm(rA: number, rB: number): number {
  if (!wasmInstance) throw new Error("WASM not initialized");
  const fn = (wasmInstance.exports as any).expectedScore as (a: number, b: number) => number;
  return fn(rA, rB);
}
```

Then decide at runtime whether to use JS or WASM:

```ts
let useWasm = false;

initRatingsWasm()
  .then(() => { useWasm = true; })
  .catch(() => { useWasm = false; });

export function expectedScore(rA: number, rB: number): number {
  if (useWasm) return expectedScoreWasm(rA, rB);
  // Pure TS fallback:
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}
```

---

## 🧪 Testing

The project uses **Vitest** for unit tests and coverage.

Typical commands:

```bash
npm test
# or
npx vitest run --coverage
```

Core areas covered:

- Swiss standings (points, OMW%, OGWP, SB, head-to-head)
- Round-Robin standings & schedules
- Single Elimination standings (`eliminationRound`, double-loss finals, seeding fallback)
- Swiss & RR pairing rules and rematch avoidance
- Retirement support for Swiss pairings via `StandingRow.retired` and `tagRetired`
- ELO rating updates and edge cases

Some glue code (e.g. internal WASM loaders) may be intentionally excluded from coverage to keep the signal focused on core logic.

---

## 🧭 Migration notes

If you’re upgrading from earlier versions:

- Existing Swiss & Round-Robin code continues to work with the same underlying logic.
- Single Elimination now has:
  - A dedicated standings engine with an `eliminationRound` field.
  - Bracket helpers for generating and updating single-elim brackets.
- Support for **double-loss finals**:
  - Both finalists can be recorded as `LOSS` in the final.
  - No champion is produced.
  - Both receive `eliminationRound = maxRound` and are ordered via seeding fallback.
- Swiss can optionally use the **virtual bye** feature for tie-break calculations.
- Swiss pairings now support **retired/dropped players**:
  - Mark players as retired (`StandingRow.retired = true` or via `tagRetired`).
  - Retired players are excluded from future pairings and BYEs.

---

## 🗺️ Roadmap

- [x] Swiss standings & pairings  
- [x] Round-Robin standings & full schedules  
- [x] Unified standings entrypoint by mode  
- [x] `acceptSingleEntryMatches` (lenient ingestion)  
- [x] Optional WebAssembly build for browsers  
- [x] Single Elimination bracket + standings (`eliminationRound`)  
- [x] Virtual bye player for Swiss tie-breakers  
- [x] Retired/dropped Swiss players (`StandingRow.retired`, `tagRetired`)  
- [ ] Additional rating systems (e.g. Glicko-2)  
- [ ] JSON schema / input validation helpers  

---

## 📜 License

MIT © 2025 — `rankings-core` authors
