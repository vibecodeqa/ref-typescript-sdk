/**
 * Transport layer.
 *
 * The HTTP types below are structural on purpose: the published declarations
 * must not force consumers to pull in DOM or `@types/node` typings, and any
 * `fetch`-shaped function (real, proxied, or a test stub) can be injected.
 */
import { HttpError, NetworkError, TimeoutError, ValidationError } from "./errors.js";
import { schemas } from "./generated/api-contract.js";
import { collectIssues } from "./validation.js";

/** Minimal response surface the SDK relies on. */
export interface HttpResponseLike {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** Minimal request options the SDK sends. */
export interface HttpRequestInit {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  /** Opaque abort signal; forwarded untouched to the injected `fetch`. */
  readonly signal?: unknown;
}

/** Any `fetch`-shaped function. */
export type FetchLike = (url: string, init: HttpRequestInit) => Promise<HttpResponseLike>;

/** Resolved transport configuration owned by the client. */
export interface TransportConfig {
  readonly baseUrl: string;
  readonly headers: Record<string, string>;
  readonly fetch: FetchLike;
  readonly timeoutMs: number;
}

/** One outbound call, already resolved to a concrete URL and payload. */
export interface RequestSpec {
  readonly operation: string;
  readonly method: string;
  readonly path: string;
  readonly query?: Record<string, string>;
  readonly body?: unknown;
}

function buildUrl(config: TransportConfig, spec: RequestSpec): string {
  const url = new URL(config.baseUrl.replace(/\/+$/, "") + spec.path);
  for (const [key, value] of Object.entries(spec.query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

function readErrorBody(text: string): { message: string | null; requestId: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { message: null, requestId: null };
  }
  if (collectIssues(parsed, schemas.ApiErrorBody, schemas).length > 0) {
    return { message: null, requestId: null };
  }
  const body = parsed as { code: string; message: string; requestId?: string };
  return { message: `${body.code}: ${body.message}`, requestId: body.requestId ?? null };
}

async function send(config: TransportConfig, spec: RequestSpec): Promise<HttpResponseLike> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    config.timeoutMs,
  );
  const init: HttpRequestInit = {
    method: spec.method,
    headers: { ...config.headers },
    signal: controller.signal,
    ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
  };
  try {
    return await config.fetch(buildUrl(config, spec), init);
  } catch (cause) {
    if (controller.signal.aborted) throw new TimeoutError(config.timeoutMs, spec.operation);
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new NetworkError(
      `${spec.operation} could not reach the service: ${reason}`,
      spec.operation,
      cause,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a request and returns the decoded JSON body as `unknown`.
 *
 * The caller is responsible for validating that value: nothing here is trusted
 * enough to be typed.
 */
export async function executeRequest(config: TransportConfig, spec: RequestSpec): Promise<unknown> {
  const response = await send(config, spec);
  const text = await response.text();

  if (!response.ok) {
    const { message, requestId } = readErrorBody(text);
    throw new HttpError(
      response.status,
      message ?? `${spec.operation} failed with HTTP ${response.status}`,
      spec.operation,
      requestId ?? response.headers.get("x-request-id"),
      text === "" ? null : text,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError(
      "response",
      `${spec.operation} returned a body that is not valid JSON`,
      [{ path: "$", message: "expected a JSON document" }],
      spec.operation,
    );
  }
}
