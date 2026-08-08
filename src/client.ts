/**
 * The public client.
 *
 * Every method follows the same three steps, and that shape is the point of
 * this reference: validate the caller's arguments against the generated
 * contract, execute the request, then validate the response before returning it
 * as a typed value.
 */
import { ConfigError } from "./errors.js";
import {
  API_VERSION,
  type CreateWidgetInput,
  type ListWidgetsQuery,
  operations,
  schemas,
  type Widget,
  type WidgetPage,
} from "./generated/api-contract.js";
import { executeRequest, type FetchLike, type RequestSpec, type TransportConfig } from "./http.js";
import { parseOrThrow } from "./validation.js";

/** Options accepted by {@link WidgetClient}. */
export interface ClientOptions {
  /** Absolute `http`/`https` base URL of the service. */
  readonly baseUrl: string;
  /** Bearer credential; omit for anonymous access. */
  readonly apiKey?: string;
  /** Injected `fetch`. Defaults to `globalThis.fetch`. */
  readonly fetch?: FetchLike;
  /** Per-request timeout in milliseconds. Defaults to 10000. */
  readonly timeoutMs?: number;
  /** Value sent as `user-agent`. */
  readonly userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function resolveBaseUrl(baseUrl: unknown): string {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new ConfigError("baseUrl is required and must be a non-empty string");
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ConfigError(`baseUrl must be an absolute URL, received "${baseUrl}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError(`baseUrl must use http or https, received "${parsed.protocol}"`);
  }
  return baseUrl;
}

function resolveFetch(injected: FetchLike | undefined): FetchLike {
  if (injected !== undefined) {
    if (typeof injected !== "function") throw new ConfigError("fetch must be a function");
    return injected;
  }
  // Single cast at the platform boundary so the public types stay DOM-free.
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  if (typeof globalFetch !== "function") {
    throw new ConfigError("no global fetch available; pass options.fetch explicitly");
  }
  return globalFetch as FetchLike;
}

function resolveTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ConfigError(`timeoutMs must be a positive integer, received ${String(timeoutMs)}`);
  }
  return timeoutMs;
}

function resolveHeaders(options: ClientOptions): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "x-api-version": API_VERSION,
    "user-agent": options.userAgent ?? `widget-sdk/${API_VERSION}`,
  };
  if (options.apiKey !== undefined) {
    if (options.apiKey === "") throw new ConfigError("apiKey must not be an empty string");
    headers.authorization = `Bearer ${options.apiKey}`;
  }
  return headers;
}

/** Typed client for the Widget API. */
export class WidgetClient {
  readonly #config: TransportConfig;

  constructor(options: ClientOptions) {
    if (options === null || typeof options !== "object") {
      throw new ConfigError("client options object is required");
    }
    this.#config = {
      baseUrl: resolveBaseUrl(options.baseUrl),
      headers: resolveHeaders(options),
      fetch: resolveFetch(options.fetch),
      timeoutMs: resolveTimeout(options.timeoutMs),
    };
  }

  /** Base URL this client was configured with. */
  get baseUrl(): string {
    return this.#config.baseUrl;
  }

  /** Lists widgets, newest first. */
  async listWidgets(query: ListWidgetsQuery = {}): Promise<WidgetPage> {
    const operation = "listWidgets";
    const checked = parseOrThrow<ListWidgetsQuery>(query, schemas.ListWidgetsQuery, schemas, {
      boundary: "request",
      operation,
      label: "query",
    });
    const search: Record<string, string> = {};
    for (const [key, value] of Object.entries(checked)) search[key] = String(value);
    return this.#call<WidgetPage>(
      {
        operation,
        method: operations.listWidgets.method,
        path: operations.listWidgets.path,
        query: search,
      },
      operations.listWidgets.response,
    );
  }

  /** Fetches a single widget by id. */
  async getWidget(widgetId: string): Promise<Widget> {
    const operation = "getWidget";
    const checked = parseOrThrow<string>(widgetId, { kind: "string", minLength: 1 }, schemas, {
      boundary: "request",
      operation,
      label: "widgetId",
    });
    const path = operations.getWidget.path.replace("{widgetId}", encodeURIComponent(checked));
    return this.#call<Widget>(
      { operation, method: operations.getWidget.method, path },
      operations.getWidget.response,
    );
  }

  /** Creates a widget. */
  async createWidget(input: CreateWidgetInput): Promise<Widget> {
    const operation = "createWidget";
    const checked = parseOrThrow<CreateWidgetInput>(input, schemas.CreateWidgetInput, schemas, {
      boundary: "request",
      operation,
      label: "input",
    });
    return this.#call<Widget>(
      {
        operation,
        method: operations.createWidget.method,
        path: operations.createWidget.path,
        body: checked,
      },
      operations.createWidget.response,
    );
  }

  async #call<T>(spec: RequestSpec, responseType: string): Promise<T> {
    const payload = await executeRequest(this.#config, spec);
    return parseOrThrow<T>(payload, { kind: "ref", target: responseType }, schemas, {
      boundary: "response",
      operation: spec.operation,
      label: "response",
    });
  }
}
