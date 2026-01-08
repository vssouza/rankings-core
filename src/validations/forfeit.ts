// src/validation/forfeit.ts

import type { Match } from "../standings";
import type { ForfeitRetirementInput } from "../standings/forfeit";
import { fail, isRecord, makeCtx, ok, push, vArrayOf, vInt, vNonEmptyString } from "./core";
import { validateMatch } from "./standings";

export function validateForfeitRetirementInput(x: unknown, path = "input") {
  const ctx = makeCtx();
  if (!isRecord(x)) return fail([{ path, code: "type", message: "Expected object." }]);

  let okAll = true;

  // round: int >= 1
  okAll = vInt(x.round, `${path}.round`, ctx) && okAll;
  if (typeof x.round === "number" && Number.isInteger(x.round) && x.round < 1) {
    push(ctx, `${path}.round`, "min", "Expected round >= 1.");
    okAll = false;
  }

  // pairings: Array<{a: PlayerID; b: PlayerID}> with a !== b
  const pairingsPath = `${path}.pairings`;
  if (!Array.isArray(x.pairings)) {
    push(ctx, pairingsPath, "type", "Expected array.");
    okAll = false;
  } else {
    for (let i = 0; i < x.pairings.length; i++) {
      const p = x.pairings[i];
      const pPath = `${pairingsPath}[${i}]`;

      if (!isRecord(p)) {
        push(ctx, pPath, "type", "Expected object.");
        okAll = false;
        continue;
      }

      const aOk = vNonEmptyString(p.a, `${pPath}.a`, ctx);
      const bOk = vNonEmptyString(p.b, `${pPath}.b`, ctx);
      okAll = aOk && bOk && okAll;

      if (aOk && bOk && p.a === p.b) {
        push(ctx, pPath, "custom", "Pairing players must be different (a !== b).");
        okAll = false;
      }
    }
  }

  // retired: PlayerID[]
  okAll =
    vArrayOf<string>(
      x.retired,
      (v, p, c) => vNonEmptyString(v, p, c),
      `${path}.retired`,
      ctx
    ) && okAll;

  // existingMatches?: Match[]
  if (x.existingMatches !== undefined) {
    if (!Array.isArray(x.existingMatches)) {
      push(ctx, `${path}.existingMatches`, "type", "Expected array.");
      okAll = false;
    } else {
      for (let i = 0; i < x.existingMatches.length; i++) {
        const r = validateMatch(x.existingMatches[i], `${path}.existingMatches[${i}]`);
        if (!r.ok) {
          ctx.errors.push(...r.errors);
          okAll = false;
        }
      }
    }
  }

  // idPrefix?: string
  if (x.idPrefix !== undefined) {
    okAll = vNonEmptyString(x.idPrefix, `${path}.idPrefix`, ctx) && okAll;
  }

  if (!okAll || ctx.errors.length) return fail(ctx.errors);

  // Build a properly typed output object (no unsafe direct cast)
  const out: ForfeitRetirementInput = {
    round: x.round as number,
    pairings: (x.pairings as Array<Record<string, unknown>>).map((p) => ({
      a: p.a as string,
      b: p.b as string,
    })),
    retired: (x.retired as string[]).slice(),
    existingMatches:
      x.existingMatches !== undefined ? (x.existingMatches as Match[]).slice() : undefined,
    idPrefix: x.idPrefix !== undefined ? (x.idPrefix as string) : undefined,
  };

  return ok(out);
}
