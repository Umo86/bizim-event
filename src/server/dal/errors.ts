export type DalErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT";

const STATUS: Record<DalErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID: 400,
  CONFLICT: 409,
};

export class DalError extends Error {
  readonly status: number;
  constructor(readonly code: DalErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DalError";
    this.status = STATUS[code];
  }
}

export const isDalError = (e: unknown): e is DalError => e instanceof DalError;
