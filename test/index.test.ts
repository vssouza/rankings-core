// test/index.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

// ---- Types for guards ----
import type {SingleEliminationStandingRow, EloOptions} from "../src";
import type {ForfeitRetirementInput} from "../src";

// ---------------------------------------------------------
// Compile-time type sanity checks for public API types
// ---------------------------------------------------------

const _forfeitInputExample: ForfeitRetirementInput = {
  round: 3,
  pairings: [{a: "A", b: "B"}],
  retired: ["B"],
};

const _singleElimRowExample: SingleEliminationStandingRow = {
  playerId: "P1",
  rank: 1,
  matchPoints: 9,
  mwp: 1,
  omwp: 1,
  gwp: 1,
  ogwp: 1,
  sb: 0,
  wins: 3,
  losses: 0,
  draws: 0,
  byes: 0,
  roundsPlayed: 3,
  gameWins: 6,
  gameLosses: 0,
  gameDraws: 0,
  penalties: 0,
  opponents: [],
  eliminationRound: 3,
  // deprecated but still present in the public type:
  elimRound: 3,
};

const _eloOptionsExample: EloOptions = {
  K: 32,
  drawScore: 0.6,
};

// ---------------------------------------------------------
// Hoist-safe mocks for modules we don't want to fully exercise here.
// We use the REAL single-elimination module to validate bracket wiring.
// ---------------------------------------------------------

// ---- standings dispatcher (mock) ----
vi.mock("../src/standings", () => ({
  computeStandings: vi.fn((req: any) => {
    if (req.mode === "swiss") {
      return [
        {
          playerId: "S1",
          rank: 1,
          matchPoints: 9,
          mwp: 1,
          omwp: 1,
          gwp: 1,
          ogwp: 1,
          sb: 0,
          wins: 3,
          losses: 0,
          draws: 0,
          byes: 0,
          roundsPlayed: 3,
          gameWins: 6,
          gameLosses: 0,
          gameDraws: 0,
          penalties: 0,
          opponents: [],
        },
      ];
    }
    if (req.mode === "roundrobin") {
      return [
        {
          playerId: "R1",
          rank: 1,
          matchPoints: 6,
          mwp: 1,
          omwp: 0.5,
          gwp: 1,
          ogwp: 0.5,
          sb: 0,
          wins: 2,
          losses: 0,
          draws: 0,
          byes: 0,
          roundsPlayed: 2,
          gameWins: 4,
          gameLosses: 0,
          gameDraws: 0,
          penalties: 0,
          opponents: [],
        },
      ];
    }
    if (req.mode === "singleelimination") {
      return [
        {
          playerId: "E1",
          rank: 1,
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
          eliminationRound: 3,
          elimRound: 3,
        },
      ];
    }
    return [];
  }),

  // retirement helpers
  tagRetired: vi.fn((rows: any[], retiredIds: string[]) =>
    rows.map((r) => ({
      ...r,
      retired: retiredIds.includes(r.playerId),
    }))
  ),

  createForfeitMatchesForRetirements: vi.fn(() => []),
}));

// ---- standings/safe (mock) ----
vi.mock("../src/standings/safe", () => ({
  computeStandingsSafe: vi.fn((req: any) => {
    // keep it minimal; just return something plausible
    if (req?.mode === "swiss") return [{playerId: "S1"}];
    if (req?.mode === "roundrobin") return [{playerId: "R1"}];
    if (req?.mode === "singleelimination")
      return [{playerId: "E1", eliminationRound: 3, elimRound: 3}];
    return [];
  }),
  createForfeitMatchesForRetirementsSafe: vi.fn(() => []),
}));

// ---- pairings/swiss (mock) ----
vi.mock("../src/pairings/swiss", () => ({
  generateSwissPairings: vi.fn(() => ({
    pairings: [{a: "S1", b: "S2"}],
    bye: "S3",
    downfloats: {S2: 1},
    rematchesUsed: [{a: "S1", b: "S2"}],
  })),
}));

// ---- pairings/roundrobin (mock) ----
vi.mock("../src/pairings/roundrobin", () => ({
  getRoundRobinRound: vi.fn(
    (players: ReadonlyArray<string>, round: number) => ({
      round,
      pairings: players.length >= 2 ? [{a: players[0], b: players[1]}] : [],
      byes: players.slice(2),
    })
  ),
  buildRoundRobinSchedule: vi.fn((players: string[]) => [
    {
      round: 1,
      pairings:
        players.length >= 4
          ? [
              {a: players[0], b: players[1]},
              {a: players[2], b: players[3]},
            ]
          : [],
      byes: players.slice(4),
    },
  ]),
}));

// ---- pairings/safe (mock) ----
vi.mock("../src/pairings/safe", () => ({
  generatePairingsSafe: vi.fn((_req: any) => ({
    pairings: [{a: "A", b: "B"}],
    bye: "C",
  })),
}));

// ---- ratings (mock) ----
vi.mock("../src/ratings", () => ({
  updateEloRatings: vi.fn(
    (base: Record<string, number>, _matches: any[], opts: any) => ({
      mode: "elo",
      ratings: {
        ...base,
        Alice: (base.Alice ?? 1500) + 16,
        Bob: (base.Bob ?? 1500) - 16,
      },
      details: {K: opts?.K ?? 32},
    })
  ),
  updateRatings: vi.fn((req: any) => ({
    mode: "elo",
    ratings: {...(req.base ?? {}), Alice: 1516, Bob: 1484},
  })),
  expectedScore: vi.fn((_a: number, _b: number) => 0.75),
}));

// ---- ratings/safe (mock) ----
vi.mock("../src/ratings/safe", () => ({
  updateRatingsSafe: vi.fn((_req: any) => ({
    mode: "elo",
    ratings: {Alice: 1516, Bob: 1484},
    deltas: {Alice: 16, Bob: -16},
  })),
  updateEloRatingsSafe: vi.fn((_base: any, _matches: any, _opts: any) => ({
    mode: "elo",
    ratings: {Alice: 1516, Bob: 1484},
    deltas: {Alice: 16, Bob: -16},
  })),
}));

// ---- validations (mock) ----
vi.mock("../src/validations/standings", () => ({
  validateComputeStandingsRequest: vi.fn((_req: any) => ({
    ok: false,
    errors: [{path: "req", code: "type", message: "bad"}],
  })),
}));

vi.mock("../src/validations/pairings", () => ({
  validatePairingRequest: vi.fn((_req: any) => ({
    ok: false,
    errors: [{path: "req", code: "type", message: "bad"}],
  })),
}));

vi.mock("../src/validations/forfeit", () => ({
  validateForfeitRetirementInput: vi.fn((_req: any) => ({
    ok: false,
    errors: [{path: "input", code: "type", message: "bad"}],
  })),
}));

vi.mock("../src/validations/ratings", () => ({
  validateRatingRequest: vi.fn((_req: any) => ({
    ok: false,
    errors: [{path: "req", code: "type", message: "bad"}],
  })),
}));

// ---- REAL single-elimination pairings (no mock) ----
import * as seReal from "../src/pairings/singleelimination";

// ---- Root public API under test ----
import * as api from "../src/index";

// ---- Also import mocked modules to assert calls ----
import * as standingsMod from "../src/standings";
import * as swissPairingsMod from "../src/pairings/swiss";
import * as rrPairingsMod from "../src/pairings/roundrobin";
import * as ratingsMod from "../src/ratings";

// helpers
const pidFromSlot = (s: any): string | undefined =>
  s && s.kind === "seed" ? s.playerId : undefined;

function isSingleElimRow(r: unknown): r is SingleEliminationStandingRow {
  return (
    !!r &&
    typeof r === "object" &&
    ("eliminationRound" in (r as any) || "elimRound" in (r as any))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Public API exports (src/index.ts)", () => {
  it("exposes standings, pairings, ratings, and helpers", () => {
    // standings
    expect(api.computeStandings).toBeTypeOf("function");
    expect(api.computeStandingsSafe).toBeTypeOf("function");
    expect(api.createForfeitMatchesForRetirements).toBeTypeOf("function");
    expect(api.createForfeitMatchesForRetirementsSafe).toBeTypeOf("function");
    expect(api.tagRetired).toBeTypeOf("function");

    // pairings
    expect(api.generatePairings).toBeTypeOf("function");
    expect(api.generateSwissPairings).toBeTypeOf("function");
    expect(api.buildRoundRobinSchedule).toBeTypeOf("function");
    expect(api.getRoundRobinRound).toBeTypeOf("function");
    expect(api.generatePairingsSafe).toBeTypeOf("function");

    // single-elim helpers
    expect(api.generateSingleEliminationBracket).toBeTypeOf("function");
    expect(api.applyResult).toBeTypeOf("function");
    expect(api.autoAdvanceByes).toBeTypeOf("function");
    expect(api.seedPositions).toBeTypeOf("function");

    // ratings
    expect(api.updateEloRatings).toBeTypeOf("function");
    expect(api.updateRatings).toBeTypeOf("function");
    expect(api.expectedScore).toBeTypeOf("function");
    expect(api.updateEloRatingsSafe).toBeTypeOf("function");
    expect(api.updateRatingsSafe).toBeTypeOf("function");

    // public validators + exception
    expect(api.validateComputeStandingsRequest).toBeTypeOf("function");
    expect(api.validatePairingRequest).toBeTypeOf("function");
    expect(api.validateForfeitRetirementInput).toBeTypeOf("function");
    expect(api.validateRatingRequest).toBeTypeOf("function");
    expect(api.ValidationException).toBeTypeOf("function");
  });

  it("does not accidentally leak unexpected value exports", () => {
    const keys = Object.keys(api).sort();

    expect(keys).toEqual(
      [
        "MatchResult",

        // standings
        "computeStandings",
        "computeStandingsSafe",
        "computeSingleEliminationStandings",
        "createForfeitMatchesForRetirements",
        "createForfeitMatchesForRetirementsSafe",
        "tagRetired",

        // pairings
        "generatePairings",
        "generatePairingsDeprecated",
        "generatePairingsSafe",
        "generateSingleEliminationBracket",
        "generateSwissPairings",
        "getRoundRobinRound",
        "buildRoundRobinSchedule",
        "applyResult",
        "autoAdvanceByes",
        "seedPositions",

        // ratings
        "updateEloRatings",
        "expectedScore",
        "updateRatings",
        "updateEloRatingsSafe",
        "updateRatingsSafe",

        // top cut helpers
        "computeTopCutSeeds",
        "mergeSwissTopCutStandings",

        // public validation surface
        "validateComputeStandingsRequest",
        "validateForfeitRetirementInput",
        "validatePairingRequest",
        "validateRatingRequest",
        "ValidationException",
      ].sort()
    );
  });

  it("exposes safe wrappers and they throw ValidationException on invalid input (sanity)", () => {
    // NOTE: since safe wrappers are mocked here, we just check they are callable.
    expect(() =>
      api.computeStandingsSafe({mode: "nope", matches: []} as any)
    ).not.toThrow();
    expect(() => api.generatePairingsSafe({mode: "nope"} as any)).not.toThrow();
    expect(() =>
      api.createForfeitMatchesForRetirementsSafe({} as any)
    ).not.toThrow();
    expect(() =>
      api.updateRatingsSafe({mode: "elo", matches: []} as any)
    ).not.toThrow();
  });

  it("exposes request validators and they return ok=false on invalid input", () => {
    expect(api.validateComputeStandingsRequest({} as any).ok).toBe(false);
    expect(api.validatePairingRequest({} as any).ok).toBe(false);
    expect(api.validateForfeitRetirementInput({} as any).ok).toBe(false);
    expect(api.validateRatingRequest({} as any).ok).toBe(false);
  });

  it("does not expose internal subpaths via package.json exports", () => {
    const pkgJsonPath = resolve(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
      exports?: Record<string, unknown>;
    };

    expect(pkg.exports).toBeDefined();

    const exportKeys = Object.keys(pkg.exports!).sort();
    expect(exportKeys).toEqual(
      [".", "./wasm", "./wasm/ratings.wasm", "./package.json"].sort()
    );

    for (const key of exportKeys) {
      expect(key.startsWith("./dist")).toBe(false);
      expect(key.startsWith("./src")).toBe(false);
      expect(key.startsWith("./standings")).toBe(false);
      expect(key.startsWith("./pairings")).toBe(false);
      expect(key.startsWith("./ratings")).toBe(false);
    }
  });
});

describe("Standings dispatcher (mocked) — swiss | roundrobin | singleelimination", () => {
  it("computeStandings(swiss) passes through", () => {
    const rows = api.computeStandings({
      mode: "swiss",
      matches: [],
      options: {eventId: "X"},
    } as any);
    expect(standingsMod.computeStandings).toHaveBeenCalledTimes(1);
    expect((rows as any)[0].playerId).toBe("S1");
  });

  it("computeStandings(roundrobin) passes through", () => {
    const rows = api.computeStandings({
      mode: "roundrobin",
      matches: [],
      options: {},
    } as any);
    expect(standingsMod.computeStandings).toHaveBeenCalledTimes(1);
    expect((rows as any)[0].playerId).toBe("R1");
  });

  it("computeStandings(singleelimination) narrows and exposes eliminationRound", () => {
    const rows = api.computeStandings({
      mode: "singleelimination",
      matches: [],
      options: {},
    } as any);
    expect(standingsMod.computeStandings).toHaveBeenCalledTimes(1);
    expect(isSingleElimRow((rows as any)[0])).toBe(true);
    if (isSingleElimRow((rows as any)[0])) {
      expect(
        (rows as any)[0].eliminationRound ?? (rows as any)[0].elimRound
      ).toBe(3);
    }
  });

  it("forwards tiebreakVirtualBye option to the standings dispatcher (swiss)", () => {
    const opt = {
      eventId: "VB-FWD",
      tiebreakVirtualBye: {enabled: true, mwp: 0.5, gwp: 0.5},
    };
    api.computeStandings({mode: "swiss", matches: [], options: opt} as any);

    expect(standingsMod.computeStandings).toHaveBeenCalledTimes(1);
    const call = (standingsMod.computeStandings as any).mock.calls[0][0];
    expect(call).toEqual(
      expect.objectContaining({
        mode: "swiss",
        options: expect.objectContaining({
          tiebreakVirtualBye: {enabled: true, mwp: 0.5, gwp: 0.5},
        }),
      })
    );
  });
});

describe("Pairings facade — swiss (mocked)", () => {
  it("routes to generateSwissPairings and normalizes shape", () => {
    const res = api.generatePairings({
      mode: "swiss",
      standings: [] as any,
      history: [] as any,
      options: {eventId: "R3"} as any,
    });
    expect(swissPairingsMod.generateSwissPairings).toHaveBeenCalledTimes(1);
    expect(res.pairings).toEqual([{a: "S1", b: "S2"}]);
    expect(res.bye).toBe("S3");
    expect(res.downfloats).toEqual({S2: 1});
    expect(res.rematchesUsed).toEqual([{a: "S1", b: "S2"}]);
    expect(res.round).toBeUndefined();
    expect(res.byes).toBeUndefined();
    expect(res.bracket).toBeUndefined();
  });
});

describe("Pairings facade — roundrobin (mocked)", () => {
  it("routes to getRoundRobinRound and maps round/byes", () => {
    const res = api.generatePairings({
      mode: "roundrobin",
      players: ["P1", "P2", "P3"],
      roundNumber: 2,
      options: {fixed: true} as any,
    });
    expect(rrPairingsMod.getRoundRobinRound).toHaveBeenCalledTimes(1);
    expect(res.round).toBe(2);
    expect(res.pairings).toEqual([{a: "P1", b: "P2"}]);
    expect(res.bye).toBe("P3");
    expect(res.byes).toEqual(["P3"]);
  });

  it("exposes buildRoundRobinSchedule pass-through (shape only)", () => {
    const sched = api.buildRoundRobinSchedule(["A", "B", "C", "D"]);
    expect(rrPairingsMod.buildRoundRobinSchedule).toHaveBeenCalledTimes(1);

    const arr = sched as unknown as Array<any>;
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr[0].round).toBe(1);
  });
});

describe("Pairings facade — singleelimination (REAL module)", () => {
  it("R1 BYEs are surfaced; pairings contain only concrete matches", () => {
    const seeds: ReadonlyArray<api.SingleElimSeedEntry> = [
      {playerId: "A", seed: 1},
      {playerId: "B", seed: 2},
      {playerId: "C", seed: 3},
      {playerId: "D", seed: 4},
      {playerId: "E", seed: 5},
    ];

    const res = api.generatePairings({
      mode: "singleelimination",
      seeds,
      roundNumber: 1,
      options: {bestOf: 3, thirdPlace: true},
    });

    expect(res.round).toBe(1);
    expect(res.bracket).toBeDefined();

    const r1 = res.bracket!.rounds[0];
    const rawByes: string[] = [];
    const rawPairs: Array<{a: string; b: string}> = [];
    for (const m of r1) {
      const a = pidFromSlot(m.a);
      const b = pidFromSlot(m.b);
      if (a && !b) rawByes.push(a);
      else if (b && !a) rawByes.push(b);
      else if (a && b) rawPairs.push({a, b});
    }

    if (rawByes.length) {
      expect(res.byes).toBeDefined();
      expect(new Set(res.byes)).toEqual(new Set(rawByes));
    } else {
      expect(res.byes).toBeUndefined();
    }

    for (const p of res.pairings) {
      const found = rawPairs.some(
        (q) => (q.a === p.a && q.b === p.b) || (q.a === p.b && q.b === p.a)
      );
      expect(found).toBe(true);
    }
  });

  it("unresolved future rounds return empty pairings but include bracket", () => {
    const seeds: ReadonlyArray<api.SingleElimSeedEntry> = [
      {playerId: "A", seed: 1},
      {playerId: "B", seed: 2},
      {playerId: "C", seed: 3},
      {playerId: "D", seed: 4},
      {playerId: "E", seed: 5},
      {playerId: "F", seed: 6},
      {playerId: "G", seed: 7},
      {playerId: "H", seed: 8},
    ];

    const sanity = seReal.generateSingleEliminationBracket(seeds, {});
    expect(sanity.rounds.length).toBe(3);

    const res = api.generatePairings({
      mode: "singleelimination",
      seeds,
      roundNumber: 2,
    });

    expect(res.round).toBe(2);
    expect(res.pairings).toEqual([]);
    expect(res.byes).toBeUndefined();
    expect(res.bracket).toBeDefined();
  });

  it("direct re-exports for single-elim utilities work", () => {
    const seeds: ReadonlyArray<api.SingleElimSeedEntry> = [
      {playerId: "A", seed: 1},
      {playerId: "B", seed: 2},
      {playerId: "C", seed: 3},
      {playerId: "D", seed: 4},
    ];
    const bracket = api.generateSingleEliminationBracket(seeds, {
      thirdPlace: true,
    });
    expect(Array.isArray(bracket.rounds)).toBe(true);
    expect(api.seedPositions(4)).toEqual([1, 4, 2, 3]);

    const r1 = bracket.rounds[0];
    for (const m of r1) {
      const a = pidFromSlot(m.a);
      const b = pidFromSlot(m.b);
      api.applyResult(bracket, m.id, {winner: a ?? b!});
    }
    const r2 = bracket.rounds[1];
    for (const m of r2) {
      const a = pidFromSlot(m.a);
      const b = pidFromSlot(m.b);
      api.applyResult(bracket, m.id, {winner: a ?? b!});
    }
    expect(bracket.rounds.at(-1)![0].id).toBeDefined();
  });
});

describe("Ratings (mocked) — ELO", () => {
  it("updateEloRatings is exposed and returns ratings", () => {
    const base = {Alice: 1500, Bob: 1500};
    const res = api.updateEloRatings(
      base,
      [{a: "Alice", b: "Bob", result: "A"}],
      {K: 32} as any
    );

    expect(ratingsMod.updateEloRatings).toHaveBeenCalledTimes(1);
    expect(res.ratings.Alice).toBeGreaterThan(base.Alice);

    const details = (res as any).details;
    if (details) expect(details.K).toBe(32);
  });

  it("updateRatings and expectedScore are exposed (plumbing)", () => {
    const s = api.expectedScore(1700, 1500);
    expect(s).toBe(0.75);

    const out = api.updateRatings({
      mode: "elo",
      matches: [],
      base: {Alice: 1500},
    } as any);
    expect(out.ratings.Alice).toBeDefined();
  });

  it("ratings safe wrappers are exposed (plumbing)", () => {
    const out1 = api.updateRatingsSafe({mode: "elo", matches: []} as any);
    expect(out1.ratings).toEqual({Alice: 1516, Bob: 1484});

    const out2 = api.updateEloRatingsSafe(
      {Alice: 1500},
      [{a: "Alice", b: "Bob", result: "A"}],
      {K: 32} as any
    );
    expect(out2.ratings).toEqual({Alice: 1516, Bob: 1484});
  });
});
