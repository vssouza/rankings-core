// src/pairings/safe.ts

import {generatePairings} from "./index";
import {ValidationException} from "../validations/errors";
import {
  validatePairingRequest,
  validatePairingResult,
} from "../validations/pairings";

/**
 * Safe public wrapper for pairings generation.
 *
 * - Validates unknown input into a typed PairingRequest
 * - Runs the pairing engine
 * - Validates the output shape + invariants
 * - Wraps engine/runtime errors into ValidationException for a consistent "safe" API
 */
export function generatePairingsSafe(req: unknown) {
  const r = validatePairingRequest(req);
  if (!r.ok) throw new ValidationException(r.errors);

  try {
    // Run engine
    const out = generatePairings(r.value);

    // Validate invariants on result too (highly recommended)
    const vr = validatePairingResult(out, r.value);
    if (!vr.ok) throw new ValidationException(vr.errors);

    return out;
  } catch (err) {
    // Preserve structured validation failures
    if (err instanceof ValidationException) {
      throw err;
    }

    // Wrap known "user-caused" / domain errors thrown by engines into a ValidationException.
    // This keeps the Safe API consistent: callers can catch ValidationException for all
    // non-bug failures originating from inputs or impossible requests.
    if (err instanceof Error) {
      throw new ValidationException([
        {
          path: "req",
          code: "custom",
          message: err.message,
        },
      ]);
    }

    // Truly unknown throwables: bubble up unchanged
    throw err;
  }
}
