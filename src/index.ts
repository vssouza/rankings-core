// src/index.ts
// Public package entrypoint: types + re-exports for standings, pairings, ratings, etc.

// ---------------------------------------------------------
// Standings core types & options (re-exported from types module)
// ---------------------------------------------------------

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
  RetirementMode,
} from "./standings/types";

export {MatchResult} from "./standings/types";

// ---------------------------------------------------------
// Standings engines
// ---------------------------------------------------------

export {
  computeStandings,
  type ComputeStandingsRequest,
  tagRetired,
  createForfeitMatchesForRetirements,
  type ForfeitRetirementInput,
} from "./standings";

export {
  computeStandingsSafe,
  createForfeitMatchesForRetirementsSafe,
} from "./standings/safe";

// If you want to expose the single-elim engine directly as well:
export {computeSingleEliminationStandings} from "./standings/singleelimination";

// ---------------------------------------------------------
// Pairings facade + modes
// ---------------------------------------------------------

export {
  generatePairings,
  generatePairingsDeprecated,
  type PairingMode,
  type PairingRequest,
  type PairingResult,
} from "./pairings";

export {generatePairingsSafe} from "./pairings/safe";

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
  updateRatings,
  updateEloRatings,
  expectedScore,
  type EloOptions,
} from "./ratings";
export {updateRatingsSafe, updateEloRatingsSafe} from "./ratings/safe";
export {validateRatingRequest} from "./validations/ratings";

// ---------------------------------------------------------
// Top cut helpers (Swiss → Single Elimination seeds)
// ---------------------------------------------------------

export {computeTopCutSeeds, type TopCutSeed} from "./helpers/swisstopcut";

export {
  mergeSwissTopCutStandings,
  type TopCutStandingLike,
} from "./helpers/swisstopcutmerger";

// ---------------------------------------------------------
// Public validation surface (small + intentional)
// ---------------------------------------------------------
// Expose only request validators (useful for UI/preflight validation),
// plus the structured error types + exception for catchable "safe" calls.

export {validateComputeStandingsRequest} from "./validations/standings";

export {validatePairingRequest} from "./validations/pairings";

export {validateForfeitRetirementInput} from "./validations/forfeit";

export {ValidationException} from "./validations/errors";
export type {ValidationError, ValidationResult} from "./validations/errors";

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
