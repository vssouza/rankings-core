// src/index.ts
// Public package entrypoint: types + re-exports for standings, pairings, ratings, etc.

// ---------------------------------------------------------
// Standings core types & options (re-exported from types module)
// ---------------------------------------------------------
// This avoids duplication and guarantees that the public-facing
// types always match what the engines actually use internally.

export type {
  PlayerID,
  Match,
  StandingRow,
  SingleEliminationStandingRow,
  PointsConfig,
  TiebreakFloors,
  TiebreakVirtualByeOptions,
  ComputeSwissOptions,
  ComputeRoundRobinOptions,
  ComputeSingleEliminationOptions,
} from "./standings/types";

export { MatchResult } from "./standings/types";

// ---------------------------------------------------------
// Standings engines
// ---------------------------------------------------------

export {
  computeStandings,
  type ComputeStandingsRequest,
} from "./standings";

// If you want to expose the single-elim engine directly as well:
export {
  computeSingleEliminationStandings,
} from "./standings/singleelimination";

// ---------------------------------------------------------
// Pairings facade + modes
// ---------------------------------------------------------

export {
  generatePairings,
  generatePairingsDeprecated, // consider marking deprecated in ./pairings
  type PairingMode,
  type PairingRequest,
  type PairingResult,
} from "./pairings";

// ---------------------------------------------------------
// Swiss pairing specific (optional; also reachable via ./pairings)
// ---------------------------------------------------------

export {
  generateSwissPairings,
  type SwissPairingOptions,
  type SwissPairingResult,
} from "./pairings/swiss";

// ---------------------------------------------------------
// Round-robin pairing specific (optional re-exports)
// ---------------------------------------------------------

export {
  buildRoundRobinSchedule,
  getRoundRobinRound,
  type RoundRobinOptions,
  type RoundDefinition,
} from "./pairings/roundrobin";

// ---------------------------------------------------------
// Single-elimination pairing utilities
// ---------------------------------------------------------

export {
  generateSingleEliminationBracket,
  applyResult,
  autoAdvanceByes,
  seedPositions,
  type SeedEntry as SingleElimSeedEntry,
  type Bracket as SingleElimBracket,
} from "./pairings/singleelimination";

// ---------------------------------------------------------
// Ratings (ELO)
// ---------------------------------------------------------

export {
  updateEloRatings,
  type EloOptions,
} from "./ratings";

// ---------------------------------------------------------
// (Optional) WASM bridge
// ---------------------------------------------------------
// If/when you want to expose the WASM bridge as part of the public API,
// uncomment this block and commit to its surface:
//
// export {
//   getWasm as getRatingsWasm,
//   type Exports as RatingsWasmExports,
// } from "./wasm/wasm-bridge";
