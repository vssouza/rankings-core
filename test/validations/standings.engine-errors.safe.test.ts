import {describe, it, expect, vi, afterEach} from "vitest";
import {ValidationException} from "../../src/validations/errors";

// Mock the engine modules used by src/standings/safe.ts
vi.mock("../../src/standings/index", () => ({
  computeStandings: vi.fn(() => {
    throw new Error("boom from engine");
  }),
}));

vi.mock("../../src/standings/forfeit", () => ({
  createForfeitMatchesForRetirements: vi.fn(() => {
    throw new Error("boom from forfeit engine");
  }),
}));

import {
  computeStandingsSafe,
  createForfeitMatchesForRetirementsSafe,
} from "../../src/standings/safe";

afterEach(() => {
  vi.clearAllMocks();
});

describe("standings safe wrappers wrap engine errors", () => {
  it("computeStandingsSafe wraps engine Error into ValidationException", () => {
    expect(() =>
      computeStandingsSafe({
        mode: "swiss",
        matches: [],
        options: {eventId: "x"},
      } as any)
    ).toThrow(ValidationException);
  });

  it("createForfeitMatchesForRetirementsSafe wraps engine Error into ValidationException", () => {
    expect(() =>
      createForfeitMatchesForRetirementsSafe({
        round: 1,
        pairings: [{a: "A", b: "B"}],
        retired: ["B"],
      } as any)
    ).toThrow(ValidationException);
  });

  // Optional: assert structured error payload
  it("uses code=custom and path=req/input for wrapped engine errors", () => {
    try {
      computeStandingsSafe({mode: "swiss", matches: []} as any);
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationException);
      const ve = e as ValidationException;
      expect(ve.errors[0]).toEqual(
        expect.objectContaining({code: "custom", path: "req"})
      );
    }

    try {
      createForfeitMatchesForRetirementsSafe({
        round: 1,
        pairings: [{a: "A", b: "B"}],
        retired: ["B"],
      } as any);
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationException);
      const ve = e as ValidationException;
      expect(ve.errors[0]).toEqual(
        expect.objectContaining({code: "custom", path: "input"})
      );
    }
  });
});
