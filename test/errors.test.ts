import { describe, expect, it } from "vitest";

import {
  ConfigError,
  HttpError,
  isSdkError,
  NetworkError,
  SdkError,
  type SdkErrorCode,
  TimeoutError,
  ValidationError,
} from "../src/errors.js";

describe("error contract", () => {
  it("pins the set of error codes the SDK may produce", () => {
    const codes: SdkErrorCode[] = [
      new ConfigError("bad").code,
      new ValidationError("request", "bad", []).code,
      new ValidationError("response", "bad", []).code,
      new HttpError(500, "boom", "getWidget").code,
      new NetworkError("offline", "getWidget").code,
      new TimeoutError(10, "getWidget").code,
    ];
    expect(codes).toEqual([
      "config_invalid",
      "request_invalid",
      "response_invalid",
      "http_error",
      "network_error",
      "timeout",
    ]);
  });

  it("keeps class names stable for logs and instanceof checks", () => {
    expect(new ConfigError("bad").name).toBe("ConfigError");
    expect(new HttpError(404, "missing", null).name).toBe("HttpError");
    expect(new TimeoutError(10, "getWidget")).toBeInstanceOf(SdkError);
    expect(new TimeoutError(10, "getWidget")).toBeInstanceOf(Error);
  });

  it("identifies SDK errors and ignores foreign ones", () => {
    expect(isSdkError(new NetworkError("offline", null))).toBe(true);
    expect(isSdkError(new Error("unrelated"))).toBe(false);
    expect(isSdkError(null)).toBe(false);
  });

  it("serializes to a stable payload", () => {
    const error = new HttpError(429, "rate limited", "listWidgets", "req_7", { retryAfter: 1 });
    expect(error.toJSON()).toEqual({
      name: "HttpError",
      code: "http_error",
      message: "rate limited",
      operation: "listWidgets",
    });
    expect(JSON.parse(JSON.stringify(error))).toEqual(error.toJSON());
  });

  it("preserves the underlying cause of transport failures", () => {
    const cause = new Error("ECONNRESET");
    expect(new NetworkError("offline", "getWidget", cause).cause).toBe(cause);
  });

  it("describes timeouts with the configured budget", () => {
    const error = new TimeoutError(2500, "listWidgets");
    expect(error.timeoutMs).toBe(2500);
    expect(error.message).toBe("listWidgets timed out after 2500ms");
  });
});
