# Reference TypeScript SDK

Product-neutral reference implementation for the VibeCode QA
[TypeScript SDK stack](https://vibecodeqa.online/docs/standards/stacks/typescript-sdk/),
judged alongside [TypeScript v1](https://vibecodeqa.online/standards/typescript/v1/) and
[Testing v1](https://vibecodeqa.online/standards/testing/v1/).

It is a small, dependency-free client for a fictional **Widget API**: a typed client,
typed errors, runtime validation at every external boundary, a generated API contract
with a drift gate, declaration emit, and consumer fixtures that compile and run against
the built package.

## Official starter first

If you only need a new TypeScript package, start with the ecosystem's own guidance:

- [TypeScript: publishing a package](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- [Node.js: package entry points and export maps](https://nodejs.org/api/packages.html#package-entry-points)

This repo does not replace those. It shows how `typescript-sdk` is judged once export maps,
declarations, wire validation, contract drift, dependency hygiene, and consumer compatibility
are all required to hold at the same time.

## Quickstart

```bash
corepack enable
pnpm install
pnpm verify   # lint, typecheck, build, test, drift, consumer fixtures, license gate
```

Individual gates:

| Command | Gate |
| --- | --- |
| `pnpm lint` | Biome lint and format check |
| `pnpm typecheck` | `tsc --noEmit` over `src`, `test` and config |
| `pnpm build` | `tsc -p tsconfig.build.json` — JS **and** `.d.ts` emit |
| `pnpm test` | Vitest units plus the packed-tarball surface test |
| `pnpm gen` | Regenerate `src/generated/api-contract.ts` from `schema/api.json` |
| `pnpm check:drift` | Regenerate, then fail on any diff in `src/generated` |
| `pnpm test:consumers` | ESM and TypeScript consumer fixtures, against `dist/` |
| `pnpm check:licenses` | License allowlist over the resolved dependency tree |

## What the package does

```ts
import { WidgetClient, isSdkError, ValidationError } from "@vcqa-ref/widget-sdk";

const client = new WidgetClient({ baseUrl: "https://api.example.test", apiKey: process.env.API_KEY });

try {
  const page = await client.listWidgets({ status: "active", limit: 25 });
  console.log(page.items.map((widget) => widget.name));
} catch (error) {
  if (isSdkError(error)) console.error(error.code, error.toJSON());
  if (error instanceof ValidationError) console.error(error.issues);
}
```

Every method validates the caller's arguments, executes the request, and then validates the
response before returning it. A payload that does not match the contract raises a
`ValidationError` with a stable `code` and a list of issues addressed by path
(`$.items[0].priceCents`) — the SDK never hands back a value that TypeScript claims exists
but the wire did not deliver.

## Layout

| Path | Role |
| --- | --- |
| `src/` | Client, transport, typed errors, validator, generated contract |
| `schema/api.json` | Committed contract fixture — the source of truth for codegen |
| `scripts/` | Contract generator and the license gate |
| `test/` | Unit tests plus the packed-surface test |
| `examples/consumer-esm/` | Plain ESM Node consumer, run in CI |
| `examples/consumer-ts/` | TypeScript consumer compiled with `skipLibCheck: false` |
| `docs/` | Contract, release and dependency policy, VCQA report |

## Standards target

| Standard | Role | Maturity |
| --- | --- | --- |
| [TypeScript SDK](https://vibecodeqa.online/docs/standards/stacks/typescript-sdk/) | Package shape, exports, declarations, validation, consumer compatibility | Charter (candidate rules, no published rubric) |
| [TypeScript v1](https://vibecodeqa.online/standards/typescript/v1/) | Strict flags, typed-and-validated boundaries | Published rubric |
| [Testing v1](https://vibecodeqa.online/standards/testing/v1/) | Test layers, CI evidence | Published rubric |
| [Dependency Hygiene](https://vibecodeqa.online/docs/standards/items/dependencies/) | Lockfile pinning, audit, license gate | Charter (no numbered rules) |

The standard is the source of truth. This repo is a forkable implementation example.

## Documentation

- [API contract and drift control](docs/api-contract.md)
- [Release and publication policy](docs/releasing.md)
- [Dependency policy](docs/dependency-policy.md)
- [**VCQA report**](docs/vcqa-report.md) — score, evidence and residual risks

## Publication

This repository is a fixture: `package.json` sets `"private": true` and there is no publish
workflow, so it can never be released to a registry by accident. Everything a real release
needs — version policy, changelog, curated `files`, an export map asserted against a real
tarball — is in place and documented in [docs/releasing.md](docs/releasing.md).

MIT licensed. See [SECURITY.md](SECURITY.md) for vulnerability reporting.
