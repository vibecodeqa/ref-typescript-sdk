/**
 * TypeScript consumer compatibility fixture.
 *
 * Compiled with `skipLibCheck: false` and without the DOM lib, so the shipped
 * `.d.ts` files must be self-contained: if the package leaked a DOM or
 * bundler-only type into its public surface, this file would stop compiling.
 */
import assert from "node:assert/strict";

import {
  type FetchLike,
  HttpError,
  type Widget,
  WidgetClient,
  type WidgetPage,
} from "@vcqa-ref/widget-sdk";

const widget: Widget = {
  id: "wgt_1",
  name: "Reference widget",
  status: "active",
  priceCents: 2500,
  tags: ["demo"],
  createdAt: "2026-08-09T00:00:00Z",
};

const okFetch: FetchLike = async () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: async () => JSON.stringify(widget),
});

const failingFetch: FetchLike = async () => ({
  ok: false,
  status: 404,
  headers: { get: () => "req_42" },
  text: async () => JSON.stringify({ code: "not_found", message: "no such widget" }),
});

const client = new WidgetClient({
  baseUrl: "https://api.example.test",
  fetch: okFetch,
});

const created: Widget = await client.createWidget({ name: "Reference widget", priceCents: 2500 });
assert.equal(created.status, "active");

const notFound = new WidgetClient({ baseUrl: "https://api.example.test", fetch: failingFetch });
await assert.rejects(
  () => notFound.getWidget("missing"),
  (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, "http_error");
    assert.equal(error.status, 404);
    assert.equal(error.requestId, "req_42");
    return true;
  },
);

// The page type is exported and structurally usable by dependents.
const emptyPage: WidgetPage = { items: [], nextCursor: null };
assert.equal(emptyPage.items.length, 0);

process.stdout.write("consumer-ts: ok\n");
