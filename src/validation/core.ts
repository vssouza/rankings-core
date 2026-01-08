// src/validation/core.ts

import type { ValidationError, ValidationErrorCode, ValidationResult } from "./errors";

export type Ctx = { errors: ValidationError[] };

export function makeCtx(): Ctx {
  return { errors: [] };
}

export function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(errors: ValidationError[]): ValidationResult<T> {
  return { ok: false, errors };
}

export function push(
  ctx: Ctx,
  path: string,
  code: ValidationErrorCode,
  message: string
) {
  ctx.errors.push({ path, code, message });
}

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function vBoolean(x: unknown, path: string, ctx: Ctx): x is boolean {
  if (typeof x !== "boolean") {
    push(ctx, path, "type", "Expected boolean.");
    return false;
  }
  return true;
}

export function vString(x: unknown, path: string, ctx: Ctx): x is string {
  if (typeof x !== "string") {
    push(ctx, path, "type", "Expected string.");
    return false;
  }
  return true;
}

export function vNonEmptyString(x: unknown, path: string, ctx: Ctx): x is string {
  if (!vString(x, path, ctx)) return false;
  if (x.trim().length === 0) {
    push(ctx, path, "min", "Expected a non-empty string.");
    return false;
  }
  return true;
}

export function vNumber(x: unknown, path: string, ctx: Ctx): x is number {
  if (typeof x !== "number") {
    push(ctx, path, "type", "Expected number.");
    return false;
  }
  return true;
}

export function vFiniteNumber(x: unknown, path: string, ctx: Ctx): x is number {
  if (!vNumber(x, path, ctx)) return false;
  if (!Number.isFinite(x)) {
    push(ctx, path, "finite", "Expected a finite number.");
    return false;
  }
  return true;
}

export function vInt(x: unknown, path: string, ctx: Ctx): x is number {
  if (!vFiniteNumber(x, path, ctx)) return false;
  if (!Number.isInteger(x)) {
    push(ctx, path, "int", "Expected an integer.");
    return false;
  }
  return true;
}

export function vOptional<T>(
  x: unknown,
  validate: (v: unknown, path: string, ctx: Ctx) => v is T,
  path: string,
  ctx: Ctx
): x is T | undefined {
  if (x === undefined) return true;
  return validate(x, path, ctx);
}

export function vNullableString(
  x: unknown,
  path: string,
  ctx: Ctx
): x is string | null {
  if (x === null) return true;
  return vNonEmptyString(x, path, ctx);
}

export function vArrayOf<T>(
  x: unknown,
  validateItem: (v: unknown, path: string, ctx: Ctx) => v is T,
  path: string,
  ctx: Ctx
): x is T[] {
  if (!Array.isArray(x)) {
    push(ctx, path, "type", "Expected array.");
    return false;
  }
  let okAll = true;
  for (let i = 0; i < x.length; i++) {
    if (!validateItem(x[i], `${path}[${i}]`, ctx)) okAll = false;
  }
  return okAll;
}

/**
 * Same as vArrayOf, but accepts a boolean-returning validator
 * (useful when you call another validator and merge its errors).
 */
export function vArrayOfBool(
  x: unknown,
  validateItem: (v: unknown, path: string, ctx: Ctx) => boolean,
  path: string,
  ctx: Ctx
): x is unknown[] {
  if (!Array.isArray(x)) {
    push(ctx, path, "type", "Expected array.");
    return false;
  }
  let okAll = true;
  for (let i = 0; i < x.length; i++) {
    if (!validateItem(x[i], `${path}[${i}]`, ctx)) okAll = false;
  }
  return okAll;
}

export function vLiteral<T extends string>(
  x: unknown,
  allowed: readonly T[],
  path: string,
  ctx: Ctx
): x is T {
  if (typeof x !== "string") {
    push(ctx, path, "type", "Expected string.");
    return false;
  }
  if (!allowed.includes(x as T)) {
    push(ctx, path, "enum", `Expected one of: ${allowed.join(", ")}.`);
    return false;
  }
  return true;
}

export function vInRange01(x: unknown, path: string, ctx: Ctx): x is number {
  if (!vFiniteNumber(x, path, ctx)) return false;
  if (x < 0 || x > 1) {
    push(ctx, path, "min", "Expected a number in range [0, 1].");
    return false;
  }
  return true;
}

export function vNonNegInt(x: unknown, path: string, ctx: Ctx): x is number {
  if (!vInt(x, path, ctx)) return false;
  if (x < 0) {
    push(ctx, path, "min", "Expected integer >= 0.");
    return false;
  }
  return true;
}
