export type ValidationErrorCode =
  | "required"
  | "type"
  | "finite"
  | "int"
  | "min"
  | "max"
  | "enum"
  | "custom";

export interface ValidationError {
  path: string; // e.g. "req.matches[0].round"
  code: ValidationErrorCode;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super(errors[0]?.message ?? "Validation failed");
    this.name = "ValidationException";
  }
}
