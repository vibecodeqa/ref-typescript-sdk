/**
 * Descriptor types shared by the generated contract and the runtime validator.
 *
 * These are hand-written and stable: `src/generated/api-contract.ts` is checked
 * against them with `satisfies`, so a schema change that the generator cannot
 * express becomes a compile error instead of a silent runtime gap.
 */

/** Common attributes every schema node may carry. */
export interface SchemaNodeBase {
  /** The value may be `null` on the wire. */
  readonly nullable?: boolean;
  /** The property may be absent from its parent object. */
  readonly optional?: boolean;
}

export interface StringNode extends SchemaNodeBase {
  readonly kind: "string";
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface IntegerNode extends SchemaNodeBase {
  readonly kind: "integer";
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface BooleanNode extends SchemaNodeBase {
  readonly kind: "boolean";
}

export interface EnumNode extends SchemaNodeBase {
  readonly kind: "enum";
  readonly values: readonly string[];
}

export interface ArrayNode extends SchemaNodeBase {
  readonly kind: "array";
  readonly items: SchemaNode;
}

export interface ObjectNode extends SchemaNodeBase {
  readonly kind: "object";
  readonly fields: { readonly [field: string]: SchemaNode };
}

/** Reference to another named type in the contract registry. */
export interface RefNode extends SchemaNodeBase {
  readonly kind: "ref";
  readonly target: string;
}

export type SchemaNode =
  | StringNode
  | IntegerNode
  | BooleanNode
  | EnumNode
  | ArrayNode
  | ObjectNode
  | RefNode;

/** Named types the validator can resolve `ref` nodes against. */
export type SchemaRegistry = { readonly [name: string]: SchemaNode };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Transport shape of a single contract operation. */
export interface OperationDescriptor {
  readonly method: HttpMethod;
  readonly path: string;
  readonly pathParams?: readonly string[];
  readonly query?: string;
  readonly body?: string;
  readonly response: string;
}
