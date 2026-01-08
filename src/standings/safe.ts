import { computeStandings } from "./index";
import { createForfeitMatchesForRetirements } from "./forfeit";
import { ValidationException } from "../validation/errors";
import { validateComputeStandingsRequest } from "../validation/standings";
import { validateForfeitRetirementInput } from "../validation/forfeit";

export function computeStandingsSafe(req: unknown) {
  const r = validateComputeStandingsRequest(req);
  if (!r.ok) throw new ValidationException(r.errors);
  return computeStandings(r.value);
}

export function createForfeitMatchesForRetirementsSafe(input: unknown) {
  const r = validateForfeitRetirementInput(input);
  if (!r.ok) throw new ValidationException(r.errors);
  return createForfeitMatchesForRetirements(r.value);
}
