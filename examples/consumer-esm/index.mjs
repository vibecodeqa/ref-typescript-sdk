/**
 * ESM consumer compatibility fixture.
 *
 * Imports the *built* package through its export map (never `src/`) and
 * exercises the public surface the way a real dependent would. Exits non-zero
 * on any assertion failure, so CI treats it as a gate.
 */
import assert from "node:assert/strict";

import { isSdkError, ValidationError, WidgetClient } from "@vcqa-ref/widget-sdk";

const widget = {
  id: "wgt_1",
  name: "Reference widget",
  status: "active",
  priceCents: 2500,
  tags: ["demo"],
  createdAt: "2026-08-09T00:00:00Z",
};

const stubFetch = async (url, init) => {
  assert.equal(init.headers.authorization, "Bearer test-key");
  assert.ok(url.startsWith("https://api.example.test/v1/widgets"));
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({ items: [widget], nextCursor: null }),
  };
};

const client = new WidgetClient({
  baseUrl: "https://api.example.test",
  apiKey: "test-key",
  fetch: stubFetch,
});

const page = await client.listWidgets({ status: "active", limit: 10 });
assert.equal(page.items.length, 1);
assert.equal(page.items[0].name, "Reference widget");
assert.equal(page.nextCursor, null);

await assert.rejects(
  () => client.createWidget({ name: "", priceCents: -1 }),
  (error) => {
    assert.ok(error instanceof ValidationError);
    assert.ok(isSdkError(error));
    assert.equal(error.code, "request_invalid");
    assert.equal(error.boundary, "request");
    assert.equal(error.issues.length, 2);
    return true;
  },
);

process.stdout.write("consumer-esm: ok\n");
