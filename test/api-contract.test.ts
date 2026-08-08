import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { API_VERSION, operations, SERVICE_NAME, schemas } from "../src/generated/api-contract.js";

interface ContractFixture {
  service: string;
  apiVersion: string;
  types: Record<string, unknown>;
  operations: Record<string, unknown>;
}

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../schema/api.json", import.meta.url)), "utf8"),
) as ContractFixture;

/**
 * In-process staleness check. `pnpm check:drift` is the hard gate in CI — it
 * regenerates and fails on any diff — but these assertions fail fast and
 * explain *what* drifted while you are still at your desk.
 */
describe("generated contract tracks schema/api.json", () => {
  it("carries the fixture's service identity and version", () => {
    expect(SERVICE_NAME).toBe(fixture.service);
    expect(API_VERSION).toBe(fixture.apiVersion);
  });

  it("declares exactly the fixture's types", () => {
    expect(Object.keys(schemas)).toEqual(Object.keys(fixture.types));
  });

  it("declares exactly the fixture's operations", () => {
    expect(Object.keys(operations)).toEqual(Object.keys(fixture.operations));
  });

  it("reproduces every type descriptor verbatim", () => {
    expect(JSON.parse(JSON.stringify(schemas))).toEqual(fixture.types);
  });

  it("reproduces every operation descriptor verbatim", () => {
    expect(JSON.parse(JSON.stringify(operations))).toEqual(fixture.operations);
  });

  it("resolves every reference and response type to a declared type", () => {
    const names = new Set(Object.keys(schemas));
    for (const operation of Object.values(operations)) {
      expect(names).toContain(operation.response);
    }
    const refs = JSON.stringify(schemas).matchAll(/"kind":"ref","target":"([^"]+)"/g);
    for (const [, target] of refs) expect(names).toContain(target);
  });

  it("declares a path parameter placeholder for every templated path", () => {
    for (const [name, operation] of Object.entries(operations)) {
      const placeholders = [...operation.path.matchAll(/\{([^}]+)\}/g)].map(([, key]) => key);
      const declared = "pathParams" in operation ? [...operation.pathParams] : [];
      expect(declared, `operation ${name}`).toEqual(placeholders);
    }
  });
});
