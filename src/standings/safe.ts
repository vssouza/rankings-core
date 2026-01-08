// src/standings/safe.ts

import {computeStandings} from "./index";
import {createForfeitMatchesForRetirements} from "./forfeit";
import {ValidationException} from "../validations/errors";
import {validateComputeStandingsRequest} from "../validations/standings";
import {validateForfeitRetirementInput} from "../validations/forfeit";

export function computeStandingsSafe(req: unknown) {
  const r = validateComputeStandingsRequest(req);
  if (!r.ok) throw new ValidationException(r.errors);

  try {
    return computeStandings(r.value);
  } catch (err) {
    if (err instanceof ValidationException) throw err;

    if (err instanceof Error) {
      throw new ValidationException([
        {path: "req", code: "custom", message: err.message},
      ]);
    }

    throw err;
  }
}

export function createForfeitMatchesForRetirementsSafe(input: unknown) {
  const r = validateForfeitRetirementInput(input);
  if (!r.ok) throw new ValidationException(r.errors);

  try {
    return createForfeitMatchesForRetirements(r.value);
  } catch (err) {
    if (err instanceof ValidationException) throw err;

    if (err instanceof Error) {
      throw new ValidationException([
        {path: "input", code: "custom", message: err.message},
      ]);
    }

    throw err;
  }
}
