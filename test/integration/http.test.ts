import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WidgetClient } from "../../src/client.js";
import { HttpError, TimeoutError, ValidationError } from "../../src/errors.js";
import type { Widget } from "../../src/generated/api-contract.js";

/**
 * Integration layer: a real HTTP server, the platform's real `fetch`, and no
 * injected transport. The unit tests stub `fetch` and therefore cannot prove
 * that the default transport, the URL builder, the headers and the error
 * mapping survive contact with an actual socket. These do.
 */
const PORT = 5205;

const widget: Widget = {
  id: "wgt_1",
  name: "Reference widget",
  status: "active",
  priceCents: 2500,
  tags: ["demo"],
  createdAt: "2026-08-09T00:00:00Z",
};

let server: Server;
let baseUrl = "";
let lastRequest: { method: string; url: string; headers: Record<string, unknown>; body: string } = {
  method: "",
  url: "",
  headers: {},
  body: "",
};

function handle(request: IncomingMessage, response: ServerResponse): void {
  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", () => {
    lastRequest = {
      method: request.method ?? "",
      url: request.url ?? "",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    const url = request.url ?? "";
    response.setHeader("content-type", "application/json");
    response.setHeader("x-request-id", "req_integration");

    if (url.startsWith("/v1/widgets?") || url === "/v1/widgets") {
      if (request.method === "POST") {
        response.writeHead(201).end(JSON.stringify(widget));
        return;
      }
      response.writeHead(200).end(JSON.stringify({ items: [widget], nextCursor: null }));
      return;
    }
    if (url === "/v1/widgets/wgt_1") {
      response.writeHead(200).end(JSON.stringify(widget));
      return;
    }
    if (url === "/v1/widgets/broken") {
      response.writeHead(200).end(JSON.stringify({ ...widget, priceCents: "free" }));
      return;
    }
    if (url === "/v1/widgets/slow") {
      setTimeout(() => response.writeHead(200).end(JSON.stringify(widget)), 500);
      return;
    }
    response
      .writeHead(404)
      .end(JSON.stringify({ code: "not_found", message: "no such widget", requestId: "req_404" }));
  });
}

beforeAll(async () => {
  server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const client = (): WidgetClient => new WidgetClient({ baseUrl, apiKey: "integration-key" });

describe("round trip over real HTTP", () => {
  it("lists widgets using the platform fetch", async () => {
    const page = await client().listWidgets({ status: "active", limit: 5 });

    expect(page.items[0]).toEqual(widget);
    expect(lastRequest.method).toBe("GET");
    expect(lastRequest.url).toBe("/v1/widgets?status=active&limit=5");
    expect(lastRequest.headers.authorization).toBe("Bearer integration-key");
    expect(lastRequest.headers["x-api-version"]).toBe("2026-08-01");
    expect(lastRequest.headers["user-agent"]).toBe("widget-sdk/2026-08-01");
  });

  it("creates a widget and sends a JSON body", async () => {
    const created = await client().createWidget({ name: "Reference widget", priceCents: 2500 });

    expect(created.id).toBe("wgt_1");
    expect(lastRequest.method).toBe("POST");
    expect(JSON.parse(lastRequest.body)).toEqual({ name: "Reference widget", priceCents: 2500 });
  });

  it("fetches a single widget", async () => {
    await expect(client().getWidget("wgt_1")).resolves.toEqual(widget);
  });

  it("maps a real 404 body onto HttpError", async () => {
    await expect(client().getWidget("missing")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      requestId: "req_404",
      code: "http_error",
    });
    await expect(client().getWidget("missing")).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects a served payload that violates the contract", async () => {
    const failure = await client()
      .getWidget("broken")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ValidationError);
    expect((failure as ValidationError).issues[0]?.path).toBe("$.priceCents");
  });

  it("aborts a slow response once the timeout budget is spent", async () => {
    const impatient = new WidgetClient({ baseUrl, timeoutMs: 50 });
    await expect(impatient.getWidget("slow")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("reports an unreachable service as a network error", async () => {
    const unreachable = new WidgetClient({ baseUrl: "http://127.0.0.1:1", timeoutMs: 1000 });
    await expect(unreachable.getWidget("wgt_1")).rejects.toMatchObject({
      code: "network_error",
    });
  });
});
