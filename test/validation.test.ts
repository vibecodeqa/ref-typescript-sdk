import { describe, expect, it } from "vitest";

import { ValidationError } from "../src/errors.js";
import { schemas } from "../src/generated/api-contract.js";
import type { SchemaNode } from "../src/schema-types.js";
import { collectIssues, parseOrThrow } from "../src/validation.js";

const widget = {
  id: "wgt_1",
  name: "Reference widget",
  status: "active",
  priceCents: 2500,
  tags: ["demo"],
  createdAt: "2026-08-09T00:00:00Z",
};

describe("collectIssues", () => {
  it("accepts a well-formed payload", () => {
    expect(collectIssues(widget, schemas.Widget, schemas)).toEqual([]);
  });

  it("tolerates unknown properties so additive server changes do not break clients", () => {
    expect(collectIssues({ ...widget, addedLater: 7 }, schemas.Widget, schemas)).toEqual([]);
  });

  it("reports every missing required property with its path", () => {
    const issues = collectIssues({ id: "wgt_1" }, schemas.Widget, schemas);
    expect(issues.map((entry) => entry.path)).toEqual([
      "$.name",
      "$.status",
      "$.priceCents",
      "$.tags",
      "$.createdAt",
    ]);
    expect(issues[0]?.message).toBe("required property is missing");
  });

  it("rejects wrong primitive types", () => {
    const issues = collectIssues({ ...widget, priceCents: "2500" }, schemas.Widget, schemas);
    expect(issues).toEqual([
      { path: "$.priceCents", message: "expected integer, received string" },
    ]);
  });

  it("rejects non-integer numbers", () => {
    const issues = collectIssues({ ...widget, priceCents: 12.5 }, schemas.Widget, schemas);
    expect(issues).toEqual([
      { path: "$.priceCents", message: "expected integer, received number" },
    ]);
  });

  it("enforces numeric bounds", () => {
    const node: SchemaNode = { kind: "integer", minimum: 1, maximum: 100 };
    expect(collectIssues(0, node, schemas)[0]?.message).toBe("expected a value >= 1");
    expect(collectIssues(101, node, schemas)[0]?.message).toBe("expected a value <= 100");
  });

  it("enforces string length bounds", () => {
    const node: SchemaNode = { kind: "string", minLength: 2, maxLength: 3 };
    expect(collectIssues("a", node, schemas)[0]?.message).toBe("expected at least 2 character(s)");
    expect(collectIssues("abcd", node, schemas)[0]?.message).toBe(
      "expected at most 3 character(s)",
    );
  });

  it("rejects values outside an enum", () => {
    const issues = collectIssues({ ...widget, status: "archived" }, schemas.Widget, schemas);
    expect(issues).toEqual([
      { path: "$.status", message: "expected one of draft, active, retired" },
    ]);
  });

  it("addresses array members individually and follows refs", () => {
    const page = { items: [widget, { ...widget, name: 42 }], nextCursor: null };
    const issues = collectIssues(page, schemas.WidgetPage, schemas);
    expect(issues).toEqual([
      { path: "$.items[1].name", message: "expected string, received number" },
    ]);
  });

  it("accepts null only where the contract allows it", () => {
    expect(collectIssues({ items: [], nextCursor: null }, schemas.WidgetPage, schemas)).toEqual([]);
    expect(collectIssues({ ...widget, name: null }, schemas.Widget, schemas)).toEqual([
      { path: "$.name", message: "expected string, received null" },
    ]);
  });

  it("rejects arrays where an object is expected", () => {
    expect(collectIssues([], schemas.Widget, schemas)).toEqual([
      { path: "$", message: "expected object, received array" },
    ]);
  });

  it("reports unresolvable references instead of silently passing", () => {
    expect(collectIssues({}, { kind: "ref", target: "Nope" }, schemas)).toEqual([
      { path: "$", message: 'unknown contract type "Nope"' },
    ]);
  });
});

describe("parseOrThrow", () => {
  it("returns the value when it is valid", () => {
    const parsed = parseOrThrow(widget, schemas.Widget, schemas, {
      boundary: "response",
      operation: "getWidget",
      label: "response",
    });
    expect(parsed).toBe(widget);
  });

  it("throws a typed ValidationError carrying every issue", () => {
    expect.assertions(4);
    try {
      parseOrThrow({ name: "" }, schemas.CreateWidgetInput, schemas, {
        boundary: "request",
        operation: "createWidget",
        label: "input",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const failure = error as ValidationError;
      expect(failure.code).toBe("request_invalid");
      expect(failure.operation).toBe("createWidget");
      expect(failure.issues.map((entry) => entry.path)).toEqual(["$.name", "$.priceCents"]);
    }
  });
});
