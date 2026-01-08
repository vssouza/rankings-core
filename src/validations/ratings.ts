// src/validations/ratings.ts
//
// Ratings validation (ELO today; more modes later)
// Mirrors the “safe” validation style used for standings/pairings.

import type {PlayerID} from "../standings/types";
import type {
  RatingRequest,
  RatingResult,
  RatingMode,
  EloMatch,
  EloOptions,
  EloUpdateResult,
  EloResult,
} from "../ratings/types";

import type {ValidationResult} from "./errors";
import {
  makeCtx,
  ok,
  fail,
  push,
  isRecord,
  vArrayOfBool,
  vBoolean,
  vFiniteNumber,
  vInRange01,
  vInt,
  vLiteral,
  vNonEmptyString,
  vOptional,
} from "./core";

// ------------------------------
// Public API
// ------------------------------

export function validateRatingRequest(
  req: unknown,
  path = "req"
): ValidationResult<RatingRequest> {
  const ctx = makeCtx();

  if (!isRecord(req)) {
    push(ctx, path, "type", "Expected object.");
    return fail(ctx.errors);
  }

  // mode
  const modeOk = vLiteral(req.mode, ["elo"] as const, `${path}.mode`, ctx);
  if (!modeOk) return fail(ctx.errors);

  const mode = req.mode as RatingMode;

  if (mode === "elo") {
    vEloRequest(req, path, ctx);
  }

  return ctx.errors.length ? fail(ctx.errors) : ok(req as RatingRequest);
}

export function validateRatingResult(
  res: unknown,
  req: RatingRequest,
  path = "res"
): ValidationResult<RatingResult> {
  const ctx = makeCtx();

  if (!isRecord(res)) {
    push(ctx, path, "type", "Expected object.");
    return fail(ctx.errors);
  }

  // ratings (required)
  const ratingsOk = vRatingsRecord(res.ratings, `${path}.ratings`, ctx);

  // deltas (optional)
  if (res.deltas !== undefined) {
    vRatingsRecord(res.deltas, `${path}.deltas`, ctx);
  }

  // Optional: mode-specific checks
  if (req.mode === "elo") {
    // If the implementation returns a mode discriminator, validate it.
    if (res.mode !== undefined) {
      vLiteral(res.mode, ["elo"] as const, `${path}.mode`, ctx);
    }
  }

  if (ctx.errors.length) return fail(ctx.errors);

  // Build a properly typed value (avoids TS2352 casts)
  const out: RatingResult = {
    ratings: (res.ratings as Record<PlayerID, number>) ?? {},
    ...(res.deltas !== undefined
      ? {deltas: res.deltas as Record<PlayerID, number>}
      : {}),
  };

  // If caller expects EloUpdateResult shape, it will still be compatible at runtime.
  // We intentionally keep validateRatingResult returning the generic RatingResult.
  return ok(out);
}

// ------------------------------
// Request validators
// ------------------------------

function vEloRequest(
  req: Record<string, unknown>,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  // matches (required)
  if (!Array.isArray(req.matches)) {
    push(ctx, `${path}.matches`, "type", "Expected array.");
  } else {
    vArrayOfBool(
      req.matches,
      (it, p, c) => vEloMatch(it, p, c),
      `${path}.matches`,
      ctx
    );
  }

  // base (optional)
  if (req.base !== undefined) {
    vRatingsRecord(req.base, `${path}.base`, ctx);
  }

  // options (optional)
  if (req.options !== undefined) {
    if (!isRecord(req.options)) {
      push(ctx, `${path}.options`, "type", "Expected object.");
    } else {
      vEloOptions(req.options, `${path}.options`, ctx);
    }
  }
}

// ------------------------------
// Shape validators
// ------------------------------

function vPlayerId(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is PlayerID {
  return vNonEmptyString(x, path, ctx);
}

function vEloResult(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is EloResult {
  return vLiteral(x, ["A", "B", "draw"] as const, path, ctx);
}

function vEloMatch(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is EloMatch {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object.");
    return false;
  }

  const okA = vPlayerId(x.a, `${path}.a`, ctx);
  const okB = vPlayerId(x.b, `${path}.b`, ctx);
  const okR = vEloResult(x.result, `${path}.result`, ctx);

  // weight optional (finite number; negative is allowed? typically no — enforce >= 0)
  if (x.weight !== undefined) {
    vFiniteNumber(x.weight, `${path}.weight`, ctx);
    if (typeof x.weight === "number" && x.weight < 0) {
      push(ctx, `${path}.weight`, "min", "Expected number >= 0.");
    }
  }

  // no self-match
  if (typeof x.a === "string" && typeof x.b === "string" && x.a === x.b) {
    push(
      ctx,
      path,
      "custom",
      "Match cannot have the same player on both sides."
    );
  }

  return okA && okB && okR;
}

function vEloOptions(
  x: Record<string, unknown>,
  path: string,
  ctx: ReturnType<typeof makeCtx>
) {
  vOptional(x.K, vInt, `${path}.K`, ctx);
  if (typeof x.K === "number" && x.K < 0)
    push(ctx, `${path}.K`, "min", "Expected integer >= 0.");

  vOptional(x.KDraw, vInt, `${path}.KDraw`, ctx);
  if (typeof x.KDraw === "number" && x.KDraw < 0)
    push(ctx, `${path}.KDraw`, "min", "Expected integer >= 0.");

  // perPlayerK: record of finite numbers (enforce >= 0)
  if (x.perPlayerK !== undefined) {
    vPerPlayerK(x.perPlayerK, `${path}.perPlayerK`, ctx);
  }

  vOptional(x.initialRating, vFiniteNumber, `${path}.initialRating`, ctx);

  vOptional(x.floor, vFiniteNumber, `${path}.floor`, ctx);
  vOptional(x.cap, vFiniteNumber, `${path}.cap`, ctx);

  // If both provided, enforce floor <= cap
  if (
    typeof x.floor === "number" &&
    typeof x.cap === "number" &&
    x.floor > x.cap
  ) {
    push(ctx, path, "custom", "Expected floor <= cap.");
  }

  vOptional(
    x.mode,
    (v, p, c): v is EloOptions["mode"] =>
      vLiteral(v, ["sequential", "simultaneous"] as const, p, c),
    `${path}.mode`,
    ctx
  );

  // drawScore must be within [0,1]
  if (x.drawScore !== undefined) {
    vInRange01(x.drawScore, `${path}.drawScore`, ctx);
  }
}

function vRatingsRecord(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is Record<PlayerID, number> {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object/record.");
    return false;
  }
  for (const [k, v] of Object.entries(x)) {
    if (k.trim().length === 0) {
      push(ctx, path, "custom", "Record contains an empty key.");
      continue;
    }
    if (!vFiniteNumber(v, `${path}.${k}`, ctx)) continue;
  }
  return true;
}

function vPerPlayerK(
  x: unknown,
  path: string,
  ctx: ReturnType<typeof makeCtx>
): x is Record<PlayerID, number> {
  if (!isRecord(x)) {
    push(ctx, path, "type", "Expected object/record.");
    return false;
  }
  for (const [k, v] of Object.entries(x)) {
    if (k.trim().length === 0) {
      push(ctx, path, "custom", "Record contains an empty key.");
      continue;
    }
    if (!vFiniteNumber(v, `${path}.${k}`, ctx)) continue;
    if (typeof v === "number" && v < 0)
      push(ctx, `${path}.${k}`, "min", "Expected number >= 0.");
  }
  return true;
}
