// src/validation/standings.ts

import type {
  ComputeRoundRobinOptions,
  ComputeSingleEliminationOptions,
  ComputeStandingsRequest,
  ComputeSwissOptions,
  Match,
  MatchResult,
} from "../standings";
import {
  fail,
  isRecord,
  makeCtx,
  ok,
  push,
  vArrayOfBool,
  vBoolean,
  vFiniteNumber,
  vInRange01,
  vInt,
  vLiteral,
  vNonEmptyString,
  vNonNegInt,
  vNullableString,
  vOptional,
} from "./core";

const MODES = ["swiss", "roundrobin", "singleelimination"] as const;

const MATCH_RESULTS = ["W", "L", "D", "BYE", "FORFEIT_W", "FORFEIT_L"] as const;
const RETIREMENT_MODES = ["withdraw", "forfeit"] as const;

type RetirementModeLiteral = (typeof RETIREMENT_MODES)[number];

function vMatchResult(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is MatchResult {
  return vLiteral(x, MATCH_RESULTS, path, ctx);
}

function vRetirementMode(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is RetirementModeLiteral {
  return vLiteral(x, RETIREMENT_MODES, path, ctx);
}

function vOptionalNonNegInt(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is number | undefined {
  return vOptional<number>(x, vNonNegInt, path, ctx);
}

function vOptionalInRange01(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is number | undefined {
  return vOptional<number>(x, vInRange01, path, ctx);
}

export function validateMatch(x: unknown, path = "match") {
  const ctx = makeCtx();
  if (!isRecord(x)) return fail([{ path, code: "type", message: "Expected object." }]);

  let okAll = true;

  // required
  const idOk = vNonEmptyString(x.id, `${path}.id`, ctx);
  const roundOk = vInt(x.round, `${path}.round`, ctx);
  const playerOk = vNonEmptyString(x.playerId, `${path}.playerId`, ctx);
  const oppOk = vNullableString(x.opponentId, `${path}.opponentId`, ctx);
  const resOk = vMatchResult(x.result, `${path}.result`, ctx);

  okAll = idOk && roundOk && playerOk && oppOk && resOk && okAll;

  if (roundOk && typeof x.round === "number" && x.round < 1) {
    push(ctx, `${path}.round`, "min", "Expected round >= 1.");
    okAll = false;
  }

  // optional game/penalty fields
  okAll = vOptionalNonNegInt(x.gameWins, `${path}.gameWins`, ctx) && okAll;
  okAll = vOptionalNonNegInt(x.gameLosses, `${path}.gameLosses`, ctx) && okAll;
  okAll = vOptionalNonNegInt(x.gameDraws, `${path}.gameDraws`, ctx) && okAll;

  okAll = vOptionalNonNegInt(x.opponentGameWins, `${path}.opponentGameWins`, ctx) && okAll;
  okAll = vOptionalNonNegInt(x.opponentGameLosses, `${path}.opponentGameLosses`, ctx) && okAll;
  okAll = vOptionalNonNegInt(x.opponentGameDraws, `${path}.opponentGameDraws`, ctx) && okAll;

  okAll = vOptionalNonNegInt(x.penalties, `${path}.penalties`, ctx) && okAll;

  // semantics
  if (oppOk && resOk) {
    if (x.opponentId === null) {
      if (x.result !== "BYE") {
        push(ctx, path, "custom", "If opponentId is null, result must be BYE.");
        okAll = false;
      }
    } else {
      if (x.result === "BYE") {
        push(ctx, path, "custom", "If result is BYE, opponentId must be null.");
        okAll = false;
      }
    }
  }

  if (playerOk && oppOk && typeof x.opponentId === "string") {
    if (x.playerId === x.opponentId) {
      push(ctx, path, "custom", "playerId and opponentId must be different.");
      okAll = false;
    }
  }

  if (!okAll || ctx.errors.length) return fail(ctx.errors);

  // Build a properly typed Match output (avoids unsafe cast)
  const out: Match = {
    id: x.id as string,
    round: x.round as number,
    playerId: x.playerId as string,
    opponentId: x.opponentId as string | null,
    result: x.result as MatchResult,

    gameWins: x.gameWins as number | undefined,
    gameLosses: x.gameLosses as number | undefined,
    gameDraws: x.gameDraws as number | undefined,

    opponentGameWins: x.opponentGameWins as number | undefined,
    opponentGameLosses: x.opponentGameLosses as number | undefined,
    opponentGameDraws: x.opponentGameDraws as number | undefined,

    penalties: x.penalties as number | undefined,
  };

  return ok(out);
}

export function validateMatches(x: unknown, path = "matches") {
  const ctx = makeCtx();
  const okArr = vArrayOfBool(
    x,
    (item, itemPath, c) => {
      const r = validateMatch(item, itemPath);
      if (!r.ok) c.errors.push(...r.errors);
      return r.ok;
    },
    path,
    ctx
  );
  if (!okArr) return fail(ctx.errors);
  return ok(x as unknown as Match[]);
}

// ---- shared option parts ----
function validateTiebreakFloors(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): boolean {
  if (x === undefined) return true;
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }
  if (x.opponentPctFloor !== undefined) {
    vInRange01(x.opponentPctFloor, `${path}.opponentPctFloor`, ctx);
  }
  return true;
}

function validatePoints(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): boolean {
  if (x === undefined) return true;
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }
  if (x.win !== undefined) vFiniteNumber(x.win, `${path}.win`, ctx);
  if (x.draw !== undefined) vFiniteNumber(x.draw, `${path}.draw`, ctx);
  if (x.loss !== undefined) vFiniteNumber(x.loss, `${path}.loss`, ctx);
  if (x.bye !== undefined) vFiniteNumber(x.bye, `${path}.bye`, ctx);
  return true;
}

function validateVirtualBye(x: unknown, path: string, ctx: ReturnType<typeof makeCtx>): boolean {
  if (x === undefined) return true;
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }
  if (x.enabled !== undefined) vBoolean(x.enabled, `${path}.enabled`, ctx);
  if (x.mwp !== undefined) vInRange01(x.mwp, `${path}.mwp`, ctx);
  if (x.gwp !== undefined) vInRange01(x.gwp, `${path}.gwp`, ctx);
  return true;
}

// ---- mode-specific options ----
export function validateComputeSwissOptions(x: unknown, path = "options") {
  const ctx = makeCtx();
  if (x === undefined) return ok(undefined as unknown as ComputeSwissOptions);
  if (!isRecord(x)) return fail([{ path, code: "type", message: "Expected object." }]);

  if (x.eventId !== undefined) vNonEmptyString(x.eventId, `${path}.eventId`, ctx);
  if (x.applyHeadToHead !== undefined) vBoolean(x.applyHeadToHead, `${path}.applyHeadToHead`, ctx);
  if (x.acceptSingleEntryMatches !== undefined) vBoolean(x.acceptSingleEntryMatches, `${path}.acceptSingleEntryMatches`, ctx);

  validateTiebreakFloors(x.tiebreakFloors, `${path}.tiebreakFloors`, ctx);
  validatePoints(x.points, `${path}.points`, ctx);
  validateVirtualBye(x.tiebreakVirtualBye, `${path}.tiebreakVirtualBye`, ctx);

  if (x.retirementMode !== undefined) vRetirementMode(x.retirementMode, `${path}.retirementMode`, ctx);

  if (ctx.errors.length) return fail(ctx.errors);
  return ok(x as unknown as ComputeSwissOptions);
}

export function validateComputeRoundRobinOptions(x: unknown, path = "options") {
  const ctx = makeCtx();
  if (x === undefined) return ok(undefined as unknown as ComputeRoundRobinOptions);
  if (!isRecord(x)) return fail([{ path, code: "type", message: "Expected object." }]);

  if (x.eventId !== undefined) vNonEmptyString(x.eventId, `${path}.eventId`, ctx);
  if (x.applyHeadToHead !== undefined) vBoolean(x.applyHeadToHead, `${path}.applyHeadToHead`, ctx);
  if (x.acceptSingleEntryMatches !== undefined) vBoolean(x.acceptSingleEntryMatches, `${path}.acceptSingleEntryMatches`, ctx);

  validateTiebreakFloors(x.tiebreakFloors, `${path}.tiebreakFloors`, ctx);
  validatePoints(x.points, `${path}.points`, ctx);
  validateVirtualBye(x.tiebreakVirtualBye, `${path}.tiebreakVirtualBye`, ctx);

  if (x.retirementMode !== undefined) vRetirementMode(x.retirementMode, `${path}.retirementMode`, ctx);

  if (ctx.errors.length) return fail(ctx.errors);
  return ok(x as unknown as ComputeRoundRobinOptions);
}

export function validateComputeSingleEliminationOptions(x: unknown, path = "options") {
  const ctx = makeCtx();
  if (x === undefined) return ok(undefined as unknown as ComputeSingleEliminationOptions);
  if (!isRecord(x)) return fail([{ path, code: "type", message: "Expected object." }]);

  if (x.eventId !== undefined) vNonEmptyString(x.eventId, `${path}.eventId`, ctx);
  if (x.useBronzeMatch !== undefined) vBoolean(x.useBronzeMatch, `${path}.useBronzeMatch`, ctx);

  if (x.retirementMode !== undefined) vRetirementMode(x.retirementMode, `${path}.retirementMode`, ctx);

  if (x.seeding !== undefined) {
    if (!isRecord(x.seeding)) {
      push(ctx, `${path}.seeding`, "type", "Expected object (record).");
    } else {
      for (const [k, v] of Object.entries(x.seeding)) {
        if (k.trim().length === 0) {
          push(ctx, `${path}.seeding`, "min", "Seeding keys must be non-empty strings.");
          continue;
        }
        if (vInt(v, `${path}.seeding.${k}`, ctx) && typeof v === "number" && v < 1) {
          push(ctx, `${path}.seeding.${k}`, "min", "Expected integer >= 1.");
        }
      }
    }
  }

  if (ctx.errors.length) return fail(ctx.errors);
  return ok(x as unknown as ComputeSingleEliminationOptions);
}

// ---- roundrobin extra semantic validation: mirrored entries ----
function validateRoundRobinMirrors(
  matches: Match[],
  acceptSingleEntryMatches: boolean,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  if (acceptSingleEntryMatches) return;

  const seen: Record<string, { count: number; sample: Match }> = Object.create(null);
  const keyOf = (a: string, b: string, round: number) => {
    const x = a < b ? a : b;
    const y = a < b ? b : a;
    return `${round}::${x}::${y}`;
  };

  for (const m of matches) {
    if (m.opponentId === null) continue;
    const k = keyOf(m.playerId, m.opponentId, m.round);
    if (!seen[k]) seen[k] = { count: 0, sample: m };
    seen[k].count += 1;
  }

  for (const k of Object.keys(seen)) {
    const e = seen[k]!;
    if (e.count === 1 && e.sample.opponentId !== null) {
      push(
        ctx,
        path,
        "custom",
        `roundrobin: missing mirrored entry for ${e.sample.playerId} vs ${e.sample.opponentId} in round ${e.sample.round}. ` +
          `Set { acceptSingleEntryMatches: true } to auto-reconstruct.`
      );
    }
  }
}

// ---- facade request ----
export function validateComputeStandingsRequest(x: unknown, path = "req") {
  const ctx = makeCtx();
  if (!isRecord(x)) return fail([{ path, code: "type", message: "Expected object." }]);

  let okAll = true;

  okAll = vLiteral(x.mode, MODES, `${path}.mode`, ctx) && okAll;

  const matchesPath = `${path}.matches`;
  const matchesOk = vArrayOfBool(
    x.matches,
    (m, p, c) => {
      const r = validateMatch(m, p);
      if (!r.ok) c.errors.push(...r.errors);
      return r.ok;
    },
    matchesPath,
    ctx
  );
  okAll = matchesOk && okAll;

  if (x.options !== undefined) {
    if (!isRecord(x.options)) {
      push(ctx, `${path}.options`, "type", "Expected object.");
      okAll = false;
    } else if (x.mode === "swiss") {
      const r = validateComputeSwissOptions(x.options, `${path}.options`);
      if (!r.ok) { ctx.errors.push(...r.errors); okAll = false; }
    } else if (x.mode === "roundrobin") {
      const r = validateComputeRoundRobinOptions(x.options, `${path}.options`);
      if (!r.ok) { ctx.errors.push(...r.errors); okAll = false; }
    } else if (x.mode === "singleelimination") {
      const r = validateComputeSingleEliminationOptions(x.options, `${path}.options`);
      if (!r.ok) { ctx.errors.push(...r.errors); okAll = false; }
    }
  }

  if (x.mode === "roundrobin" && matchesOk) {
    const accept =
      isRecord(x.options) && typeof x.options.acceptSingleEntryMatches === "boolean"
        ? x.options.acceptSingleEntryMatches
        : false;
    validateRoundRobinMirrors(x.matches as unknown as Match[], accept, `${path}.matches`, ctx);
  }

  if (!okAll || ctx.errors.length) return fail(ctx.errors);
  return ok(x as unknown as ComputeStandingsRequest);
}
