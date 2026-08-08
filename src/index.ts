/**
 * `@vcqa-ref/widget-sdk` — the entire public surface of the package.
 *
 * Nothing outside this module is reachable through the export map, so the
 * package's compatibility promise is exactly what this file re-exports.
 */
export { type ClientOptions, WidgetClient } from "./client.js";
export {
  ConfigError,
  HttpError,
  isSdkError,
  NetworkError,
  SdkError,
  type SdkErrorCode,
  type SdkErrorPayload,
  TimeoutError,
  type ValidationBoundary,
  ValidationError,
  type ValidationIssue,
} from "./errors.js";
export {
  API_VERSION,
  type ApiErrorBody,
  type CreateWidgetInput,
  type ListWidgetsQuery,
  type OperationName,
  operations,
  type SchemaName,
  SERVICE_NAME,
  schemas,
  type Widget,
  type WidgetPage,
} from "./generated/api-contract.js";
export type { FetchLike, HttpRequestInit, HttpResponseLike } from "./http.js";
export type {
  ArrayNode,
  BooleanNode,
  EnumNode,
  HttpMethod,
  IntegerNode,
  ObjectNode,
  OperationDescriptor,
  RefNode,
  SchemaNode,
  SchemaNodeBase,
  SchemaRegistry,
  StringNode,
} from "./schema-types.js";
export { collectIssues, parseOrThrow } from "./validation.js";
