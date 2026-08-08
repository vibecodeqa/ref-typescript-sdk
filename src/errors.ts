/**
 * Typed errors for the SDK.
 *
 * Every failure the client can produce is an {@link SdkError} carrying a stable
 * `code` from {@link SdkErrorCode}. Codes are part of the public contract: they
 * are covered by tests and may only change in a major release. Callers should
 * branch on `code`, never on message text.
 */

/** Stable, machine-readable failure codes. Additive-only within a major version. */
export type SdkErrorCode =
  | "config_invalid"
  | "request_invalid"
  | "response_invalid"
  | "http_error"
  | "network_error"
  | "timeout";

/** Which side of the wire failed validation. */
export type ValidationBoundary = "request" | "response";

/** A single validation failure, addressed by JSON-ish path (`$.items[0].name`). */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/** Stable serialized form of an error, safe to log. */
export interface SdkErrorPayload {
  readonly name: string;
  readonly code: SdkErrorCode;
  readonly message: string;
  readonly operation: string | null;
}

/** Base class for every error this SDK throws. */
export class SdkError extends Error {
  readonly code: SdkErrorCode;
  /** Contract operation being executed, or `null` outside an operation. */
  readonly operation: string | null;

  constructor(
    code: SdkErrorCode,
    message: string,
    operation: string | null = null,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SdkError";
    this.code = code;
    this.operation = operation;
  }

  toJSON(): SdkErrorPayload {
    return { name: this.name, code: this.code, message: this.message, operation: this.operation };
  }
}

/** The client was constructed with unusable options. */
export class ConfigError extends SdkError {
  constructor(message: string) {
    super("config_invalid", message);
    this.name = "ConfigError";
  }
}

/** A payload failed runtime validation on the way out or on the way in. */
export class ValidationError extends SdkError {
  readonly boundary: ValidationBoundary;
  readonly issues: readonly ValidationIssue[];

  constructor(
    boundary: ValidationBoundary,
    message: string,
    issues: readonly ValidationIssue[],
    operation: string | null = null,
  ) {
    super(boundary === "request" ? "request_invalid" : "response_invalid", message, operation);
    this.name = "ValidationError";
    this.boundary = boundary;
    this.issues = issues;
  }
}

/** The service answered with a non-2xx status. */
export class HttpError extends SdkError {
  readonly status: number;
  readonly requestId: string | null;
  readonly body: unknown;

  constructor(
    status: number,
    message: string,
    operation: string | null,
    requestId: string | null = null,
    body: unknown = null,
  ) {
    super("http_error", message, operation);
    this.name = "HttpError";
    this.status = status;
    this.requestId = requestId;
    this.body = body;
  }
}

/** The request never produced a response (DNS, TLS, socket, offline). */
export class NetworkError extends SdkError {
  constructor(message: string, operation: string | null, cause?: unknown) {
    super("network_error", message, operation, cause);
    this.name = "NetworkError";
  }
}

/** The request exceeded the configured timeout. */
export class TimeoutError extends SdkError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, operation: string | null) {
    super("timeout", `${operation ?? "request"} timed out after ${timeoutMs}ms`, operation);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Type guard for errors originating in this SDK. */
export function isSdkError(value: unknown): value is SdkError {
  return value instanceof SdkError;
}
