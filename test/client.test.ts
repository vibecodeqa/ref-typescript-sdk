import { describe, expect, it } from "vitest";

import { WidgetClient } from "../src/client.js";
import {
  ConfigError,
  HttpError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from "../src/errors.js";
import { API_VERSION, type Widget } from "../src/generated/api-contract.js";
import type { FetchLike, HttpRequestInit } from "../src/http.js";

const widget: Widget = {
  id: "wgt_1",
  name: "Reference widget",
  status: "active",
  priceCents: 2500,
  tags: ["demo"],
  createdAt: "2026-08-09T00:00:00Z",
};

interface Call {
  url: string;
  init: HttpRequestInit;
}

function recordingFetch(
  responder: (call: Call) => { status?: number; body: string; requestId?: string },
): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    const { status = 200, body, requestId = null } = responder(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name === "x-request-id" ? requestId : null) },
      text: async () => body,
    };
  };
  return { fetch, calls };
}

const clientWith = (fetch: FetchLike): WidgetClient =>
  new WidgetClient({ baseUrl: "https://api.example.test/", apiKey: "secret", fetch });

/** Awaits a call that must reject and returns the error, narrowed by the caller. */
async function rejection<T>(promise: Promise<unknown>): Promise<T> {
  try {
    await promise;
  } catch (error) {
    return error as T;
  }
  throw new Error("expected the call to reject, but it resolved");
}

describe("client configuration", () => {
  it("rejects a missing base URL", () => {
    expect(() => new WidgetClient({ baseUrl: "" })).toThrow(ConfigError);
  });

  it("rejects a relative base URL", () => {
    expect(() => new WidgetClient({ baseUrl: "/v1" })).toThrow(/absolute URL/);
  });

  it("rejects a non-http protocol", () => {
    expect(() => new WidgetClient({ baseUrl: "ftp://example.test" })).toThrow(/http or https/);
  });

  it("rejects a non-positive timeout", () => {
    const build = () =>
      new WidgetClient({
        baseUrl: "https://api.example.test",
        timeoutMs: 0,
        fetch: async () => {
          throw new Error("unreachable");
        },
      });
    expect(build).toThrow(/positive integer/);
  });

  it("rejects an empty API key", () => {
    expect(() => new WidgetClient({ baseUrl: "https://api.example.test", apiKey: "" })).toThrow(
      ConfigError,
    );
  });

  it("exposes the configured base URL", () => {
    const { fetch } = recordingFetch(() => ({ body: "{}" }));
    expect(clientWith(fetch).baseUrl).toBe("https://api.example.test/");
  });
});

describe("listWidgets", () => {
  it("sends contract headers and query parameters", async () => {
    const { fetch, calls } = recordingFetch(() => ({
      body: JSON.stringify({ items: [widget], nextCursor: null }),
    }));
    const page = await clientWith(fetch).listWidgets({ status: "active", limit: 25 });

    expect(page.items[0]?.id).toBe("wgt_1");
    expect(calls[0]?.url).toBe("https://api.example.test/v1/widgets?status=active&limit=25");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.headers.authorization).toBe("Bearer secret");
    expect(calls[0]?.init.headers["x-api-version"]).toBe(API_VERSION);
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("rejects caller arguments that violate the contract before any request", async () => {
    const { fetch, calls } = recordingFetch(() => ({ body: "{}" }));
    await expect(clientWith(fetch).listWidgets({ limit: 500 })).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("rejects a response whose shape does not match the contract", async () => {
    const { fetch } = recordingFetch(() => ({
      body: JSON.stringify({ items: [{ ...widget, priceCents: "free" }], nextCursor: null }),
    }));
    const failure = await rejection<ValidationError>(clientWith(fetch).listWidgets());

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure.code).toBe("response_invalid");
    expect(failure.boundary).toBe("response");
    expect(failure.issues[0]?.path).toBe("$.items[0].priceCents");
  });

  it("rejects a body that is not JSON at all", async () => {
    const { fetch } = recordingFetch(() => ({ body: "<html>gateway</html>" }));
    await expect(clientWith(fetch).listWidgets()).rejects.toThrow(/not valid JSON/);
  });
});

describe("getWidget", () => {
  it("encodes the path parameter", async () => {
    const { fetch, calls } = recordingFetch(() => ({ body: JSON.stringify(widget) }));
    await clientWith(fetch).getWidget("wgt/1 2");
    expect(calls[0]?.url).toBe("https://api.example.test/v1/widgets/wgt%2F1%202");
  });

  it("rejects an empty id without calling the service", async () => {
    const { fetch, calls } = recordingFetch(() => ({ body: "{}" }));
    await expect(clientWith(fetch).getWidget("")).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("maps a structured error body onto HttpError", async () => {
    const { fetch } = recordingFetch(() => ({
      status: 404,
      body: JSON.stringify({ code: "not_found", message: "no such widget", requestId: "req_9" }),
    }));
    const failure = await rejection<HttpError>(clientWith(fetch).getWidget("missing"));

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure.status).toBe(404);
    expect(failure.requestId).toBe("req_9");
    expect(failure.message).toBe("not_found: no such widget");
  });

  it("falls back to the status line and header when the error body is opaque", async () => {
    const { fetch } = recordingFetch(() => ({
      status: 503,
      body: "upstream down",
      requestId: "req_3",
    }));
    const failure = await rejection<HttpError>(clientWith(fetch).getWidget("wgt_1"));

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure.status).toBe(503);
    expect(failure.requestId).toBe("req_3");
    expect(failure.message).toBe("getWidget failed with HTTP 503");
  });
});

describe("createWidget", () => {
  it("posts the validated payload as JSON", async () => {
    const { fetch, calls } = recordingFetch(() => ({ status: 201, body: JSON.stringify(widget) }));
    const created = await clientWith(fetch).createWidget({
      name: "Reference widget",
      priceCents: 2500,
    });

    expect(created.id).toBe("wgt_1");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(calls[0]?.init.body ?? "")).toEqual({
      name: "Reference widget",
      priceCents: 2500,
    });
  });

  it("reports every invalid field at once", async () => {
    const { fetch } = recordingFetch(() => ({ body: "{}" }));
    const failure = await rejection<ValidationError>(
      clientWith(fetch).createWidget({ name: "", priceCents: -1 }),
    );

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure.issues.map((entry) => entry.path)).toEqual(["$.name", "$.priceCents"]);
  });
});

describe("transport failures", () => {
  it("wraps transport rejections as NetworkError with the original cause", async () => {
    const cause = new Error("ECONNREFUSED");
    const failure = await rejection<NetworkError>(
      clientWith(async () => {
        throw cause;
      }).getWidget("wgt_1"),
    );

    expect(failure).toBeInstanceOf(NetworkError);
    expect(failure.code).toBe("network_error");
    expect(failure.cause).toBe(cause);
  });

  it("aborts and reports a TimeoutError once the budget is spent", async () => {
    const client = new WidgetClient({
      baseUrl: "https://api.example.test",
      timeoutMs: 5,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    });
    const failure = await rejection<TimeoutError>(client.getWidget("wgt_1"));

    expect(failure).toBeInstanceOf(TimeoutError);
    expect(failure.timeoutMs).toBe(5);
  });
});
