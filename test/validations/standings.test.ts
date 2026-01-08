import {describe, it, expect} from "vitest";
import {MatchResult} from "../../src/standings";
import {validateComputeStandingsRequest} from "../../src/validations/standings";

describe("validations/standings", () => {
  it("happy path: swiss minimal", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [
        {
          id: "m1-a",
          round: 1,
          playerId: "A",
          opponentId: "B",
          result: MatchResult.WIN,
          gameWins: 2,
          gameLosses: 0,
          gameDraws: 0,
        },
        {
          id: "m1-b",
          round: 1,
          playerId: "B",
          opponentId: "A",
          result: MatchResult.LOSS,
          gameWins: 0,
          gameLosses: 2,
          gameDraws: 0,
        },
      ],
      options: {eventId: "t"},
    } as any);

    expect(r.ok).toBe(true);
  });

  it("rejects non-object + invalid mode", () => {
    expect(validateComputeStandingsRequest("nope" as any).ok).toBe(false);
    expect(validateComputeStandingsRequest({mode: "nope"} as any).ok).toBe(
      false
    );
  });

  it("rejects matches not array", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: "x",
    } as any);
    expect(r.ok).toBe(false);
  });

  it("rejects match shape problems (missing fields / bad types)", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [
        {
          id: "",
          round: 0,
          playerId: "A",
          opponentId: 123,
          result: "NOPE",
        },
      ],
    } as any);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.path);
      expect(paths.some((p) => p.includes("matches[0].id"))).toBe(true);
      expect(paths.some((p) => p.includes("matches[0].round"))).toBe(true);
      expect(paths.some((p) => p.includes("matches[0].opponentId"))).toBe(true);
      expect(paths.some((p) => p.includes("matches[0].result"))).toBe(true);
    }
  });

  it("enforces BYE invariants (opponentId null => result must be BYE)", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [
        {
          id: "x",
          round: 1,
          playerId: "A",
          opponentId: null,
          result: MatchResult.WIN,
        },
      ],
    } as any);

    expect(r.ok).toBe(false);
  });

  it("roundrobin: missing mirror when acceptSingleEntryMatches=false", () => {
    const r = validateComputeStandingsRequest({
      mode: "roundrobin",
      matches: [
        {
          id: "m1",
          round: 1,
          playerId: "A",
          opponentId: "B",
          result: MatchResult.WIN,
          gameWins: 2,
          gameLosses: 0,
          gameDraws: 0,
        },
        // missing B vs A
      ],
      options: {acceptSingleEntryMatches: false},
    } as any);

    expect(r.ok).toBe(false);
  });

  it("singleelimination: basic request shape works", () => {
    const r = validateComputeStandingsRequest({
      mode: "singleelimination",
      matches: [
        {
          id: "sf-a",
          round: 1,
          playerId: "A",
          opponentId: "B",
          result: MatchResult.WIN,
        },
        {
          id: "sf-b",
          round: 1,
          playerId: "B",
          opponentId: "A",
          result: MatchResult.LOSS,
        },
      ],
      options: {eventId: "se", seeding: {A: 1, B: 2}},
    } as any);

    expect(r.ok).toBe(true);
  });

  it("accepts BYE match when opponentId=null and result=BYE", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [
        {
          id: "m1",
          round: 1,
          playerId: "A",
          opponentId: null,
          result: MatchResult.BYE,
        },
      ],
    } as any);
    expect(r.ok).toBe(true);
  });

  // ✅ Replacement for the invalid protectTopN test:
  it("rejects invalid single-elimination seeding values (must be positive ints)", () => {
    const r = validateComputeStandingsRequest({
      mode: "singleelimination",
      matches: [],
      options: {eventId: "se", seeding: {A: -1}},
    } as any);

    expect(r.ok).toBe(false);
  });

  it("rejects match round < 1", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [
        {
          id: "m1",
          round: 0,
          playerId: "A",
          opponentId: "B",
          result: MatchResult.WIN,
        },
      ],
    } as any);
    expect(r.ok).toBe(false);
  });

  it("rejects self-match (playerId === opponentId)", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [
        {
          id: "m1",
          round: 1,
          playerId: "A",
          opponentId: "A",
          result: MatchResult.WIN,
        },
      ],
    } as any);
    expect(r.ok).toBe(false);
  });

  it("roundrobin allows single-entry matches when acceptSingleEntryMatches=true", () => {
    const r = validateComputeStandingsRequest({
      mode: "roundrobin",
      matches: [
        {
          id: "m1",
          round: 1,
          playerId: "A",
          opponentId: "B",
          result: MatchResult.WIN,
          gameWins: 2,
          gameLosses: 0,
          gameDraws: 0,
        },
      ],
      options: {acceptSingleEntryMatches: true},
    } as any);
    expect(r.ok).toBe(true);
  });

  it("rejects invalid retirementMode", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [],
      options: {retirementMode: "nope"},
    } as any);
    expect(r.ok).toBe(false);
  });

  it("rejects tiebreakVirtualBye mwp/gwp out of range", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [],
      options: {
        eventId: "x",
        tiebreakVirtualBye: {enabled: true, mwp: 2, gwp: -1},
      },
    } as any);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path.includes("tiebreakVirtualBye"))).toBe(
        true
      );
    }
  });

  it("rejects options when not an object", () => {
    const r = validateComputeStandingsRequest({
      mode: "swiss",
      matches: [],
      options: "nope",
    } as any);
    expect(r.ok).toBe(false);
  });
});
