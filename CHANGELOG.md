# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/), as scoped in [docs/releasing.md](docs/releasing.md).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-08-09

### Added

- `WidgetClient` with `listWidgets`, `getWidget` and `createWidget`, an injectable
  `fetch`, a per-request timeout budget, and contract headers.
- Typed error hierarchy under `SdkError` with the stable codes `config_invalid`,
  `request_invalid`, `response_invalid`, `http_error`, `network_error` and `timeout`.
- Runtime validation of caller arguments and of every response body, with path-addressed
  issues and forward-compatible handling of unknown properties.
- API contract generated from `schema/api.json` into `src/generated/api-contract.ts`,
  with a `pnpm check:drift` gate.
- ESM and TypeScript consumer fixtures that compile and run against the built package.
- Explicit export map, declaration emit, and a packed-tarball surface test.
