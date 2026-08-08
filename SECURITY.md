# Security policy

This is a product-neutral reference template. It ships no credentials, talks to no real
service, and is never published to a registry.

## Reporting

Report vulnerabilities through GitHub security advisories on this repository. Please do not
open a public issue for an unfixed vulnerability.

## What this template assumes

- Credentials are supplied by the caller (`options.apiKey`) and are never read from disk,
  written to logs, or embedded in the package. `SdkError.toJSON()` returns only name, code,
  message and operation — never headers or request bodies.
- Responses are untrusted input: every body is validated against the generated contract
  before it is returned as a typed value.
- `baseUrl` must be an absolute `http`/`https` URL; anything else is rejected at construction.
- CI workflows run with `permissions: contents: read` and every third-party action is pinned
  to a commit SHA.
