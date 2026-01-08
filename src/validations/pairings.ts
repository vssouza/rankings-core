// src/validations/pairings.ts

import type { PairingRequest, PairingResult, PairingMode } from "../pairings";
import type { Match, PlayerID, StandingRow, RetirementMode } from "../standings/types";

import type { ValidationResult } from "./errors";
import {
  makeCtx,
  ok,
  fail,
  push,
  isRecord,
  vArrayOfBool,
  vBoolean,
  vFiniteNumber,
  vInt,
  vLiteral,
  vNonEmptyString,
  vOptional,
} from "./core";

// If you prefer not to expose sentinel rules here, move this into RR-only validation.
const ROUND_ROBIN_BYE_SENTINEL = "__BYE__";

// ------------------------------
// Public API
// ------------------------------

export function validatePairingRequest(
  req: unknown,
  path = "req"
): ValidationResult<PairingRequest> {
  const ctx = makeCtx();

  if (!isRecord(req)) {
    push(ctx, path, "type", "Expected object.");
    return fail(ctx.errors);
  }

  const modeOk = vLiteral(
    (req as Record<string, unknown>).mode,
    ["swiss", "roundrobin", "singleelimination"] as const,
    `${path}.mode`,
    ctx
  );
  if (!modeOk) return fail(ctx.errors);

  const mode = (req as any).mode as PairingMode;

  if (mode === "swiss") {
    vSwissRequest(req as Record<string, unknown>, path, ctx);
  } else if (mode === "roundrobin") {
    vRoundRobinRequest(req as Record<string, unknown>, path, ctx);
  } else {
    vSingleElimRequest(req as Record<string, unknown>, path, ctx);
  }

  return ctx.errors.length ? fail(ctx.errors) : ok(req as unknown as PairingRequest);
}

export function validatePairingResult(
  res: unknown,
  req: PairingRequest,
  path = "res"
): ValidationResult<PairingResult> {
  const ctx = makeCtx();

  if (!isRecord(res)) {
    push(ctx, path, "type", "Expected object.");
    return fail(ctx.errors);
  }

  // pairings
  if (!Array.isArray((res as any).pairings)) {
    push(ctx, `${path}.pairings`, "type", "Expected array.");
  } else {
    vArrayOfBool(
      (res as any).pairings,
      (it, p, c) => vPairing(it, p, c),
      `${path}.pairings`,
      ctx
    );
  }

  // bye/byes/round are optional in facade type
  vOptional((res as any).bye, vPlayerId, `${path}.bye`, ctx);
  vOptional((res as any).round, vInt, `${path}.round`, ctx);

  if ((res as any).byes !== undefined) {
    if (!Array.isArray((res as any).byes)) {
      push(ctx, `${path}.byes`, "type", "Expected array.");
    } else {
      vArrayOfBool(
        (res as any).byes,
        (it, p, c) => vPlayerId(it, p, c),
        `${path}.byes`,
        ctx
      );
    }
  }

  // swiss extras
  if ((res as any).downfloats !== undefined) {
    vRecordOfNonNegInt((res as any).downfloats, `${path}.downfloats`, ctx);
  }
  if ((res as any).rematchesUsed !== undefined) {
    if (!Array.isArray((res as any).rematchesUsed)) {
      push(ctx, `${path}.rematchesUsed`, "type", "Expected array.");
    } else {
      vArrayOfBool(
        (res as any).rematchesUsed,
        (it, p, c) => vPairing(it, p, c),
        `${path}.rematchesUsed`,
        ctx
      );
    }
  }

  // single-elim extra: bracket (shallow)
  if ((res as any).bracket !== undefined) {
    if (!isRecord((res as any).bracket)) {
      push(ctx, `${path}.bracket`, "type", "Expected object.");
    }
  }

  // Invariants across all modes
  vPairingsInvariants(res as any, req, path, ctx);

  // ✅ TS2352 fix: cast through unknown after validation
  return ctx.errors.length ? fail(ctx.errors) : ok(res as unknown as PairingResult);
}

// ------------------------------
// Request validators
// ------------------------------

function vSwissRequest(
  req: Record<string, unknown>,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  // standings
  if (!Array.isArray(req.standings)) {
    push(ctx, `${path}.standings`, "type", "Expected array.");
  } else {
    vArrayOfBool(
      req.standings,
      (it, p, c) => vStandingRow(it, p, c),
      `${path}.standings`,
      ctx
    );

    const ids = (req.standings as any[])
      .map((s) => (isRecord(s) ? (s as any).playerId : undefined))
      .filter((x): x is string => typeof x === "string");
    checkUnique(ids, `${path}.standings`, "playerId", ctx);
  }

  // history
  if (!Array.isArray(req.history)) {
    push(ctx, `${path}.history`, "type", "Expected array.");
  } else {
    vArrayOfBool(
      req.history,
      (it, p, c) => vSwissHistoryMatch(it, p, c),
      `${path}.history`,
      ctx
    );
  }

  // options (shallow)
  if (req.options !== undefined) {
    if (!isRecord(req.options)) {
      push(ctx, `${path}.options`, "type", "Expected object.");
    } else {
      vSwissOptions(req.options, `${path}.options`, ctx);
    }
  }

  // strict cross-check: history refs must exist in standings
  const standingIds = extractStandingIds(req.standings);
  if (standingIds) {
    crossCheckSwissHistory(req.history, standingIds, `${path}.history`, ctx);
  }
}

function vRoundRobinRequest(
  req: Record<string, unknown>,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  // players
  if (!Array.isArray(req.players)) {
    push(ctx, `${path}.players`, "type", "Expected array.");
  } else {
    vArrayOfBool(req.players, (it, p, c) => vPlayerId(it, p, c), `${path}.players`, ctx);

    const ids = (req.players as any[]).filter((x): x is string => typeof x === "string");
    checkUnique(ids, `${path}.players`, "playerId", ctx);

    if (ids.includes(ROUND_ROBIN_BYE_SENTINEL)) {
      push(
        ctx,
        `${path}.players`,
        "custom",
        `Player id "${ROUND_ROBIN_BYE_SENTINEL}" is reserved for round-robin BYE.`
      );
    }
  }

  // roundNumber
  if (req.roundNumber === undefined) {
    push(ctx, `${path}.roundNumber`, "required", "roundNumber is required.");
  } else {
    vInt(req.roundNumber, `${path}.roundNumber`, ctx);
    if (typeof req.roundNumber === "number" && req.roundNumber < 1) {
      push(ctx, `${path}.roundNumber`, "min", "Expected integer >= 1.");
    }
  }

  // options (shallow)
  if (req.options !== undefined) {
    if (!isRecord(req.options)) {
      push(ctx, `${path}.options`, "type", "Expected object.");
    } else {
      vRoundRobinOptions(req.options, `${path}.options`, ctx);
    }
  }
}

function vSingleElimRequest(
  req: Record<string, unknown>,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  // seeds
  if (!Array.isArray(req.seeds)) {
    push(ctx, `${path}.seeds`, "type", "Expected array.");
  } else {
    vArrayOfBool(req.seeds, (it, p, c) => vSeedEntry(it, p, c), `${path}.seeds`, ctx);

    const playerIds: string[] = [];
    const seeds: number[] = [];
    for (let i = 0; i < req.seeds.length; i++) {
      const it = req.seeds[i];
      if (isRecord(it)) {
        if (typeof (it as any).playerId === "string") playerIds.push((it as any).playerId);
        if (typeof (it as any).seed === "number") seeds.push((it as any).seed);
      }
    }
    checkUnique(playerIds, `${path}.seeds`, "playerId", ctx);
    checkUnique(seeds.map(String), `${path}.seeds`, "seed", ctx);
  }

  // options (shallow)
  if (req.options !== undefined) {
    if (!isRecord(req.options)) {
      push(ctx, `${path}.options`, "type", "Expected object.");
    } else {
      vSingleElimOptions(req.options, `${path}.options`, ctx);
    }
  }

  // roundNumber optional
  if (req.roundNumber !== undefined) {
    vInt(req.roundNumber, `${path}.roundNumber`, ctx);
    if (typeof req.roundNumber === "number" && req.roundNumber < 1) {
      push(ctx, `${path}.roundNumber`, "min", "Expected integer >= 1.");
    }
  }
}

// ------------------------------
// Shape validators
// ------------------------------

function vPlayerId(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): x is PlayerID {
  return vNonEmptyString(x, path, ctx);
}

function vPairing(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is { a: PlayerID; b: PlayerID } {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }
  const okA = vPlayerId((x as any).a, `${path}.a`, ctx);
  const okB = vPlayerId((x as any).b, `${path}.b`, ctx);
  return okA && okB;
}

function vStandingRow(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): x is StandingRow {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }

  const okId = vPlayerId((x as any).playerId, `${path}.playerId`, ctx);
  const okMP = vFiniteNumber((x as any).matchPoints, `${path}.matchPoints`, ctx);

  vOptional((x as any).retired, vBoolean, `${path}.retired`, ctx);

  return okId && okMP;
}

function vSwissHistoryMatch(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): x is Match {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }

  const okId = vNonEmptyString((x as any).id, `${path}.id`, ctx);

  const okRound = vInt((x as any).round, `${path}.round`, ctx);
  if (typeof (x as any).round === "number" && (x as any).round < 1) {
    push(ctx, `${path}.round`, "min", "Expected integer >= 1.");
  }

  const okP = vPlayerId((x as any).playerId, `${path}.playerId`, ctx);

  let okO = true;
  if ((x as any).opponentId === null) okO = true;
  else okO = vPlayerId((x as any).opponentId, `${path}.opponentId`, ctx);

  // result: accept any non-empty string
  vNonEmptyString((x as any).result, `${path}.result`, ctx);

  if (
    typeof (x as any).playerId === "string" &&
    typeof (x as any).opponentId === "string" &&
    (x as any).playerId === (x as any).opponentId
  ) {
    push(ctx, path, "custom", "Match cannot have the same playerId and opponentId.");
  }

  return okId && okRound && okP && okO;
}

function vSwissOptions(x: Record<string, unknown>, path: string, ctx: ReturnType<typeof makeCtx>) {
  vOptional((x as any).eventId, vNonEmptyString, `${path}.eventId`, ctx);
  vOptional((x as any).avoidRematches, vBoolean, `${path}.avoidRematches`, ctx);

  vOptional((x as any).protectTopN, vInt, `${path}.protectTopN`, ctx);
  if (typeof (x as any).protectTopN === "number" && (x as any).protectTopN < 0) {
    push(ctx, `${path}.protectTopN`, "min", "Expected integer >= 0.");
  }

  vOptional((x as any).preferGroupIntegrity, vBoolean, `${path}.preferGroupIntegrity`, ctx);
  vOptional((x as any).byePoints, vFiniteNumber, `${path}.byePoints`, ctx);

  vOptional((x as any).maxBacktrack, vInt, `${path}.maxBacktrack`, ctx);
  if (typeof (x as any).maxBacktrack === "number" && (x as any).maxBacktrack < 0) {
    push(ctx, `${path}.maxBacktrack`, "min", "Expected integer >= 0.");
  }

  vOptional(
    (x as any).retirementMode,
    (v, p, c): v is RetirementMode => vLiteral(v, ["withdraw", "forfeit"] as const, p, c),
    `${path}.retirementMode`,
    ctx
  );
}

function vRoundRobinOptions(x: Record<string, unknown>, path: string, ctx: ReturnType<typeof makeCtx>) {
  vOptional((x as any).double, vBoolean, `${path}.double`, ctx);
  vOptional((x as any).shuffleSeed, vNonEmptyString, `${path}.shuffleSeed`, ctx);
  vOptional((x as any).includeBye, vBoolean, `${path}.includeBye`, ctx);
}

function vSeedEntry(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): x is { playerId: string; seed: number } {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }
  const okId = vNonEmptyString((x as any).playerId, `${path}.playerId`, ctx);
  const okSeed = vInt((x as any).seed, `${path}.seed`, ctx);
  if (typeof (x as any).seed === "number" && (x as any).seed < 1) {
    push(ctx, `${path}.seed`, "min", "Expected integer >= 1.");
  }
  return okId && okSeed;
}

function vSingleElimOptions(x: Record<string, unknown>, path: string, ctx: ReturnType<typeof makeCtx>) {
  vOptional((x as any).bestOf, vInt, `${path}.bestOf`, ctx);
  if (typeof (x as any).bestOf === "number" && (x as any).bestOf < 1) {
    push(ctx, `${path}.bestOf`, "min", "Expected integer >= 1.");
  }
  vOptional((x as any).thirdPlace, vBoolean, `${path}.thirdPlace`, ctx);
}

// ------------------------------
// Output invariants
// ------------------------------

function vPairingsInvariants(
  res: { pairings?: unknown; bye?: unknown; byes?: unknown },
  req: PairingRequest,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  if (!Array.isArray(res.pairings)) return;

  const seenPlayers = new Set<string>();
  const seenPairs = new Set<string>();

  const bye = typeof (res as any).bye === "string" ? ((res as any).bye as string) : undefined;
  const byes = Array.isArray((res as any).byes)
    ? ((res as any).byes as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const byeSet = new Set<string>();
  if (bye) byeSet.add(bye);
  for (const b of byes) byeSet.add(b);

  for (let i = 0; i < res.pairings.length; i++) {
    const p = (res.pairings as any[])[i];
    if (!isRecord(p)) continue;

    const a = (p as any).a;
    const b = (p as any).b;
    if (typeof a !== "string" || typeof b !== "string") continue;

    if (a === b) {
      push(ctx, `${path}.pairings[${i}]`, "custom", "Pairing cannot have the same player on both sides.");
    }

    if (seenPlayers.has(a)) push(ctx, `${path}.pairings[${i}].a`, "custom", `Player "${a}" appears in multiple pairings.`);
    if (seenPlayers.has(b)) push(ctx, `${path}.pairings[${i}].b`, "custom", `Player "${b}" appears in multiple pairings.`);

    seenPlayers.add(a);
    seenPlayers.add(b);

    const key = a < b ? `${a}::${b}` : `${b}::${a}`;
    if (seenPairs.has(key)) {
      push(ctx, `${path}.pairings[${i}]`, "custom", `Duplicate pairing detected: ${key}.`);
    }
    seenPairs.add(key);

    if (byeSet.has(a) || byeSet.has(b)) {
      push(ctx, `${path}.pairings[${i}]`, "custom", "A player cannot both receive a bye and be paired in the same round.");
    }
  }

  if (req.mode === "roundrobin") {
    if (bye === ROUND_ROBIN_BYE_SENTINEL || byes.includes(ROUND_ROBIN_BYE_SENTINEL)) {
      push(ctx, `${path}`, "custom", `Internal BYE sentinel "${ROUND_ROBIN_BYE_SENTINEL}" leaked into output.`);
    }
    for (const id of seenPlayers) {
      if (id === ROUND_ROBIN_BYE_SENTINEL) {
        push(ctx, `${path}.pairings`, "custom", `Internal BYE sentinel "${ROUND_ROBIN_BYE_SENTINEL}" leaked into output.`);
      }
    }
  }
}

// ------------------------------
// Helpers
// ------------------------------

function checkUnique(values: string[], path: string, label: string, ctx: ReturnType<typeof makeCtx>) {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) push(ctx, path, "custom", `Duplicate ${label}: "${v}".`);
    else seen.add(v);
  }
}

function extractStandingIds(standings: unknown): Set<string> | null {
  if (!Array.isArray(standings)) return null;
  const ids: string[] = [];
  for (const s of standings) {
    if (isRecord(s) && typeof (s as any).playerId === "string") ids.push((s as any).playerId);
  }
  return new Set(ids);
}

function crossCheckSwissHistory(
  history: unknown,
  standingIds: Set<string>,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  if (!Array.isArray(history)) return;

  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (!isRecord(m)) continue;

    const a = (m as any).playerId;
    const b = (m as any).opponentId;

    if (typeof a === "string" && !standingIds.has(a)) {
      push(ctx, `${path}[${i}].playerId`, "custom", `playerId "${a}" not found in standings.`);
    }
    if (typeof b === "string" && !standingIds.has(b)) {
      push(ctx, `${path}[${i}].opponentId`, "custom", `opponentId "${b}" not found in standings.`);
    }
  }
}

function vRecordOfNonNegInt(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>) {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object/record.");
    return false;
  }
  for (const [k, v] of Object.entries(x)) {
    if (k.trim().length === 0) {
      push(ctx, `${path}`, "custom", "Record contains an empty key.");
      continue;
    }
    if (!vInt(v, `${path}.${k}`, ctx)) continue;
    if (typeof v === "number" && v < 0) push(ctx, `${path}.${k}`, "min", "Expected integer >= 0.");
  }
  return true;
}
