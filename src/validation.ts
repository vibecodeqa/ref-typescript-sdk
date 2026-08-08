/**
 * Runtime validation for external boundaries.
 *
 * TypeScript types vanish at runtime, so anything that crosses a process
 * boundary — caller-supplied arguments and, above all, JSON coming off the
 * wire — is checked against the generated schema descriptors before the SDK
 * hands it back as a typed value.
 *
 * Unknown object properties are accepted on purpose: an additive server change
 * must not break existing clients. Everything else is rejected.
 */
import { type ValidationBoundary, ValidationError, type ValidationIssue } from "./errors.js";
import type {
  IntegerNode,
  ObjectNode,
  SchemaNode,
  SchemaRegistry,
  StringNode,
} from "./schema-types.js";

const issue = (path: string, message: string): ValidationIssue => ({ path, message });

const typeName = (value: unknown): string => (Array.isArray(value) ? "array" : typeof value);

function checkString(value: unknown, node: StringNode, path: string): ValidationIssue[] {
  if (typeof value !== "string") {
    return [issue(path, `expected string, received ${typeName(value)}`)];
  }
  if (node.minLength !== undefined && value.length < node.minLength) {
    return [issue(path, `expected at least ${node.minLength} character(s)`)];
  }
  if (node.maxLength !== undefined && value.length > node.maxLength) {
    return [issue(path, `expected at most ${node.maxLength} character(s)`)];
  }
  return [];
}

function checkInteger(value: unknown, node: IntegerNode, path: string): ValidationIssue[] {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return [issue(path, `expected integer, received ${typeName(value)}`)];
  }
  if (node.minimum !== undefined && value < node.minimum) {
    return [issue(path, `expected a value >= ${node.minimum}`)];
  }
  if (node.maximum !== undefined && value > node.maximum) {
    return [issue(path, `expected a value <= ${node.maximum}`)];
  }
  return [];
}

function checkObject(
  value: object,
  node: ObjectNode,
  registry: SchemaRegistry,
  path: string,
): ValidationIssue[] {
  const record = value as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  for (const [field, spec] of Object.entries(node.fields)) {
    const fieldPath = `${path}.${field}`;
    if (!(field in record) || record[field] === undefined) {
      if (spec.optional !== true) issues.push(issue(fieldPath, "required property is missing"));
      continue;
    }
    issues.push(...collectIssues(record[field], spec, registry, fieldPath));
  }
  return issues;
}

/** Collects every validation failure in `value`; an empty array means valid. */
export function collectIssues(
  value: unknown,
  node: SchemaNode,
  registry: SchemaRegistry,
  path = "$",
): ValidationIssue[] {
  if (value === null || value === undefined) {
    return node.nullable === true && value === null
      ? []
      : [issue(path, `expected ${node.kind}, received ${value === null ? "null" : "undefined"}`)];
  }

  switch (node.kind) {
    case "ref": {
      const target = registry[node.target];
      if (target === undefined) return [issue(path, `unknown contract type "${node.target}"`)];
      return collectIssues(value, target, registry, path);
    }
    case "string":
      return checkString(value, node, path);
    case "integer":
      return checkInteger(value, node, path);
    case "boolean":
      return typeof value === "boolean"
        ? []
        : [issue(path, `expected boolean, received ${typeName(value)}`)];
    case "enum":
      return typeof value === "string" && node.values.includes(value)
        ? []
        : [issue(path, `expected one of ${node.values.join(", ")}`)];
    case "array": {
      if (!Array.isArray(value)) {
        return [issue(path, `expected array, received ${typeName(value)}`)];
      }
      return value.flatMap((item, index) =>
        collectIssues(item, node.items, registry, `${path}[${index}]`),
      );
    }
    case "object":
      return typeof value === "object" && !Array.isArray(value)
        ? checkObject(value, node, registry, path)
        : [issue(path, `expected object, received ${typeName(value)}`)];
  }
}

/** Validates `value` and returns it typed, or throws a {@link ValidationError}. */
export function parseOrThrow<T>(
  value: unknown,
  node: SchemaNode,
  registry: SchemaRegistry,
  context: { boundary: ValidationBoundary; operation: string; label: string },
): T {
  const issues = collectIssues(value, node, registry);
  if (issues.length > 0) {
    const summary = issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
    throw new ValidationError(
      context.boundary,
      `${context.label} failed validation for ${context.operation} (${summary})`,
      issues,
      context.operation,
    );
  }
  return value as T;
}
