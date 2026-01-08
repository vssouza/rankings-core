// test/validations/pairings.safe.test.ts

import {describe, it, expect} from "vitest";
import {MatchResult} from "../../src/standings";
import type {Match, StandingRow} from "../../src/standings";

import {ValidationException} from "../../src/validations/errors";
import {generatePairingsSafe} from "../../src/pairings/safe";

describe("generatePairingsSafe", () => {
  it('delegates to swiss when mode is "swiss"', () => {
    const standings: StandingRow[] = [
      {playerId: "A", matchPoints: 3} as any,
      {playerId: "B", matchPoints: 3} as any,
      {playerId: "C", matchPoints: 0} as any,
    ];

    const history: Match[] = [
      {
        id: "r1-a",
        round: 1,
        playerId: "A",
        opponentId: null,
        result: MatchResult.BYE,
      },
    ];

    const res = generatePairingsSafe({
      mode: "swiss",
      standings,
      history,
      options: {eventId: "swiss-safe"},
    });

    // 3 active players => 1 bye + 1 pairing
    expect(res.pairings).toHaveLength(1);
    expect(res.bye).toBeDefined();
  });

  it('delegates to roundrobin when mode is "roundrobin"', () => {
    const res = generatePairingsSafe({
      mode: "roundrobin",
      players: ["A", "B", "C"],
      roundNumber: 1,
      options: {shuffleSeed: "rr-safe", includeBye: true},
    });

    // 3 players => 1 bye + 1 pairing
    expect(res.round).toBe(1);
    expect(res.pairings).toHaveLength(1);
    expect(res.byes).toBeDefined();
    expect(res.byes).toHaveLength(1);
  });

  it('delegates to singleelimination when mode is "singleelimination"', () => {
    const res = generatePairingsSafe({
      mode: "singleelimination",
      seeds: [
        {playerId: "A", seed: 1},
        {playerId: "B", seed: 2},
        {playerId: "C", seed: 3},
        {playerId: "D", seed: 4},
      ],
      options: {bestOf: 1, thirdPlace: true},
      roundNumber: 1,
    });

    expect(res.round).toBe(1);
    expect(res.pairings.length).toBeGreaterThan(0);
    expect(res.bracket).toBeDefined();

    // Invariants: no player appears twice in extracted pairings
    const used = new Set(res.pairings.flatMap((p) => [p.a, p.b]));
    expect(used.size).toBe(res.pairings.length * 2);
  });

  // ---- validation behaviour ----

  it("throws ValidationException on invalid mode", () => {
    expect(() =>
      generatePairingsSafe({
        mode: "nope",
      } as any)
    ).toThrow(ValidationException);
  });

  it('throws ValidationException when roundrobin players includes the "__BYE__" sentinel', () => {
    expect(() =>
      generatePairingsSafe({
        mode: "roundrobin",
        players: ["A", "__BYE__", "B"],
        roundNumber: 1,
      } as any)
    ).toThrow(ValidationException);
  });

  it("throws ValidationException when singleelimination has duplicate seeds", () => {
    expect(() =>
      generatePairingsSafe({
        mode: "singleelimination",
        seeds: [
          {playerId: "A", seed: 1},
          {playerId: "B", seed: 1}, // duplicate seed
        ],
      } as any)
    ).toThrow(ValidationException);
  });

  it("throws ValidationException when roundrobin roundNumber is < 1", () => {
    expect(() =>
      generatePairingsSafe({
        mode: "roundrobin",
        players: ["A", "B"],
        roundNumber: 0,
      } as any)
    ).toThrow(ValidationException);
  });

  it("wraps engine errors into ValidationException (roundrobin out of range)", () => {
    expect(() =>
      generatePairingsSafe({
        mode: "roundrobin",
        players: ["A", "B", "C"],
        roundNumber: 999, // passes validation (>=1) but engine should throw out-of-range
        options: {includeBye: true},
      } as any)
    ).toThrow(ValidationException);
  });

  it("wraps engine errors into ValidationException with a custom error", () => {
    try {
      generatePairingsSafe({
        mode: "roundrobin",
        players: ["A", "B", "C"],
        roundNumber: 999,
      } as any);
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationException);
      const ve = err as ValidationException;
      expect(ve.errors).toHaveLength(1);
      expect(ve.errors[0]).toEqual(
        expect.objectContaining({
          path: "req",
          code: "custom",
        })
      );
    }
  });
});
