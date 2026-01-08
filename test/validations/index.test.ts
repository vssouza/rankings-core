import {describe, it, expect} from "vitest";
import * as v from "../../src/validations";

describe("validations barrel exports", () => {
  it("re-exports expected validation helpers and error types", () => {
    // errors
    expect(v.ValidationException).toBeTypeOf("function");

    // request validators
    expect(v.validateComputeStandingsRequest).toBeTypeOf("function");
    expect(v.validateForfeitRetirementInput).toBeTypeOf("function");
    expect(v.validatePairingRequest).toBeTypeOf("function");
    expect(v.validateRatingRequest).toBeTypeOf("function");
  });
});
