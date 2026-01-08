import {describe, it, expect} from "vitest";
import {
  makeCtx,
  ok,
  fail,
  push,
  isRecord,
  vBoolean,
  vString,
  vNonEmptyString,
  vNumber,
  vFiniteNumber,
  vInt,
  vOptional,
  vNullableString,
  vArrayOf,
  vArrayOfBool,
  vLiteral,
  vInRange01,
  vNonNegInt,
} from "../../src/validations/core";

describe("validations/core helpers", () => {
  it("ok/fail/makeCtx/push shape", () => {
    const ctx = makeCtx();
    expect(ctx.errors).toEqual([]);

    push(ctx, "x", "type", "nope");
    expect(ctx.errors).toEqual([{path: "x", code: "type", message: "nope"}]);

    expect(ok(123)).toEqual({ok: true, value: 123});
    expect(fail(ctx.errors)).toEqual({ok: false, errors: ctx.errors});
  });

  it("isRecord works for objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({a: 1})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(1)).toBe(false);
  });

  it("primitive validators hit success + failure branches", () => {
    const ctx = makeCtx();

    expect(vBoolean(true, "b", ctx)).toBe(true);
    expect(vBoolean("no", "b2", ctx)).toBe(false);

    expect(vString("x", "s", ctx)).toBe(true);
    expect(vString(1, "s2", ctx)).toBe(false);

    expect(vNonEmptyString("ok", "nes", ctx)).toBe(true);
    expect(vNonEmptyString("   ", "nes2", ctx)).toBe(false); // min branch

    expect(vNumber(1.5, "n", ctx)).toBe(true);
    expect(vNumber("no", "n2", ctx)).toBe(false);

    expect(vFiniteNumber(3, "f", ctx)).toBe(true);
    expect(vFiniteNumber(Infinity, "f2", ctx)).toBe(false); // finite branch

    expect(vInt(2, "i", ctx)).toBe(true);
    expect(vInt(2.2, "i2", ctx)).toBe(false); // int branch

    // sanity: we collected some errors
    expect(ctx.errors.length).toBeGreaterThan(0);
  });

  it("vOptional returns true for undefined and validates otherwise", () => {
    const ctx = makeCtx();

    expect(vOptional(undefined, vString, "opt", ctx)).toBe(true);
    expect(vOptional("x", vString, "opt2", ctx)).toBe(true);
    expect(vOptional(123, vString, "opt3", ctx)).toBe(false);

    expect(ctx.errors.some((e) => e.path === "opt3")).toBe(true);
  });

  it("vNullableString accepts null and validates non-empty string", () => {
    const ctx = makeCtx();

    expect(vNullableString(null, "ns0", ctx)).toBe(true);
    expect(vNullableString("ok", "ns1", ctx)).toBe(true);
    expect(vNullableString("   ", "ns2", ctx)).toBe(false);
    expect(vNullableString(123, "ns3", ctx)).toBe(false);

    expect(ctx.errors.some((e) => e.path === "ns2")).toBe(true);
    expect(ctx.errors.some((e) => e.path === "ns3")).toBe(true);
  });

  it("vArrayOf / vArrayOfBool validate arrays and add indexed paths", () => {
    const ctx1 = makeCtx();
    expect(vArrayOf("no", vString, "arr", ctx1)).toBe(false); // not array

    const ctx2 = makeCtx();
    expect(vArrayOf(["a", 1], vString, "arr2", ctx2)).toBe(false);
    expect(ctx2.errors.some((e) => e.path === "arr2[1]")).toBe(true);

    const ctx3 = makeCtx();
    expect(
      vArrayOfBool(["a", 1], (v) => typeof v === "string", "arr3", ctx3)
    ).toBe(false);

    const ctx4 = makeCtx();
    expect(vArrayOfBool("no", () => true, "arr4", ctx4)).toBe(false); // not array
  });

  it("vLiteral enum + type branches", () => {
    const ctx = makeCtx();

    expect(vLiteral("a", ["a", "b"] as const, "lit1", ctx)).toBe(true);
    expect(vLiteral("c", ["a", "b"] as const, "lit2", ctx)).toBe(false); // enum branch
    expect(vLiteral(123, ["a", "b"] as const, "lit3", ctx)).toBe(false); // type branch

    expect(ctx.errors.some((e) => e.path === "lit2" && e.code === "enum")).toBe(
      true
    );
    expect(ctx.errors.some((e) => e.path === "lit3" && e.code === "type")).toBe(
      true
    );
  });

  it("vInRange01 and vNonNegInt cover bounds", () => {
    const ctx = makeCtx();

    expect(vInRange01(0, "r0", ctx)).toBe(true);
    expect(vInRange01(1, "r1", ctx)).toBe(true);
    expect(vInRange01(-0.1, "r2", ctx)).toBe(false);
    expect(vInRange01(1.1, "r3", ctx)).toBe(false);

    expect(vNonNegInt(0, "nn0", ctx)).toBe(true);
    expect(vNonNegInt(3, "nn1", ctx)).toBe(true);
    expect(vNonNegInt(-1, "nn2", ctx)).toBe(false); // min branch
    expect(vNonNegInt(2.2, "nn3", ctx)).toBe(false); // int branch via vInt
  });
});
