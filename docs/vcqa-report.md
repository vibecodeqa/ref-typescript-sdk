# VCQA Report

Score: **98/100 — grade A**

| | |
| --- | --- |
| Scanner | `@vibecodeqa/cli@0.54.4`, run as `npx --yes @vibecodeqa/cli@0.54.4 --markdown` |
| Run date | 2026-08-09 |
| Assessed commit | [`6a47dd5b5793bdc2d4d2f1183b0e9b90560c904b`](https://github.com/vibecodeqa/ref-typescript-sdk/commit/6a47dd5b5793bdc2d4d2f1183b0e9b90560c904b) |
| CI evidence | [run 31280995042](https://github.com/vibecodeqa/ref-typescript-sdk/actions/runs/31280995042) — `success`, Node 22 and Node 24, 2026-08-09 |
| Re-verified | Same 98/100 at [`1c716097562e14a5d57c0a9759b5ae7cfabc92b3`](https://github.com/vibecodeqa/ref-typescript-sdk/commit/1c716097562e14a5d57c0a9759b5ae7cfabc92b3) (the commit that added this report), CI [run 31281081464](https://github.com/vibecodeqa/ref-typescript-sdk/actions/runs/31281081464) — `success` |
| Detected stack | `typescript · monorepo (pnpm)` |

| Category | Score | Weight |
| --- | --- | --- |
| Foundations | 100/100 | 23 |
| Quality | 98/100 | 20 |
| Testing | 96/100 | 13 |
| Security | 100/100 | 16 |
| Architecture | 93/100 | 9 |
| Other | 100/100 | 5 |
| LLM Readiness | 100/100 | 9 |

22 of 38 checks applied; the other 16 are React, Flutter, Cloudflare, D1, container, HTML and
frontend checks that do not apply to a headless package, plus 7 advisory AI checks excluded
from the score.

## Standards this repo is judged against

Two of the four are **charters, not versioned rubrics** — they describe the surface and its
candidate rules but publish no numbered, scored rules yet. That is stated plainly here because
a reference implementation cannot claim conformance to a rubric that does not exist.

| Standard | Status | Reference |
| --- | --- | --- |
| TypeScript SDK | **Charter** — `planned`, `candidate-rubric`, `standardUrl: null` | <https://vibecodeqa.online/docs/standards/stacks/typescript-sdk/> |
| TypeScript v1 | Published rubric | <https://vibecodeqa.online/standards/typescript/v1/> |
| Testing v1 | Published rubric | <https://vibecodeqa.online/standards/testing/v1/> |
| Dependency Hygiene | **Charter** — `planned`, `draft-charter`, no numbered rules | <https://vibecodeqa.online/docs/standards/items/dependencies/> |

The Dependency Hygiene charter is published under `/docs/standards/items/dependencies/`; there
is no `/docs/standards/stacks/dependencies/` page (it returns 404), so the item page is cited.

The `typescript-sdk` charter records twelve candidate rules that were blocked on this
repository existing. This repo is the first implementation those rules can be tried against;
it is evidence for authoring the rubric, not proof of passing one.

## Resolver

`standards/resolve.mjs` classifies the repository as intended:

```
# @vcqa-ref/widget-sdk  [package]
    archetype:     typescript-sdk [PLANNED]
    cross-cutting: typescript@v1, security@v1, testing@v1, dependencies [PLANNED]
```

The `typescript-sdk` detect predicate requires an `exports`/`main` config and the *absence* of
`react-dom`, `next` and `vite` dependencies, of `index.html`, of `functions/**`, and of
`wrangler.toml`. This repo therefore builds with plain `tsc` and tests with Vitest — Vitest is
a differently-named package and pulls Vite in only transitively, so no `vite` entry ever
appears in a manifest.

The two consumer fixtures resolve as their own workspace slices with no archetype, which is
correct: they are dependents, not SDKs.

## Evidence for the required implementation

| Requirement | Where it lives | How it is proven |
| --- | --- | --- |
| Explicit `exports`, `types`, `files`, `engines`, `packageManager` | [`package.json`](../package.json) | [`test/package-surface.test.ts`](../test/package-surface.test.ts) unpacks a real `pnpm pack` tarball and asserts every export target is present and nothing from `test/`, `examples/`, `scripts/`, `schema/`, `docs/` or `.github/` leaked in |
| Small typed client | [`src/client.ts`](../src/client.ts) | 18 unit tests + 7 integration tests |
| Typed errors with stable codes | [`src/errors.ts`](../src/errors.ts) | [`test/errors.test.ts`](../test/errors.test.ts) pins the six-code union, the class names and the `toJSON()` payload |
| Runtime validation at external boundaries | [`src/validation.ts`](../src/validation.ts) | [`test/validation.test.ts`](../test/validation.test.ts): malformed input and malformed wire payloads both raise `ValidationError` with path-addressed issues |
| Committed, reproducibly generated API schema | [`schema/api.json`](../schema/api.json) → [`src/generated/api-contract.ts`](../src/generated/api-contract.ts) | `pnpm gen` regenerates deterministically |
| Declaration emit in the build gate | `tsc -p tsconfig.build.json` | CI step *Assert declarations were emitted* checks `dist/index.d.ts` |
| Consumer compatibility (ESM + TypeScript) | [`examples/consumer-esm`](../examples/consumer-esm), [`examples/consumer-ts`](../examples/consumer-ts) | Both import the **built** package through its export map and run in CI; the TypeScript fixture compiles with `skipLibCheck: false` and without the DOM lib |
| API/client drift check | `pnpm check:drift` | Regenerates, then `git diff --exit-code -- src/generated`; verified to fail on a schema edit without regeneration |
| Release metadata | [`docs/releasing.md`](releasing.md), [`CHANGELOG.md`](../CHANGELOG.md) | Versioning policy, changelog discipline, publication expectations |
| Dependency/audit/license gate | `pnpm audit --audit-level=high`, [`scripts/check-licenses.mjs`](../scripts/check-licenses.mjs) | Both run in CI; exception procedure in [docs/dependency-policy.md](dependency-policy.md) |

## Material findings

- **Testing 96/100.** 56 tests across two layers: unit tests with a stubbed transport, and an
  integration suite that drives the client over a real loopback HTTP server using the
  platform's own `fetch`. Coverage is enforced in the test command itself
  (`vitest run --coverage`, thresholds 90/90/85/90); the measured run is 96.4% lines, 89.6%
  branches, 100% functions. The single remaining finding is "no test file for
  `src/schema-types.ts`", which is a file of type declarations with no runtime to test.
- **Architecture 93/100**, with one warning: `src/errors.ts` is a "god module", imported by 4
  of 8 modules. This is deliberate. The error taxonomy is the SDK's shared vocabulary — the
  client, the transport and the validator all raise from it. Splitting it would create a
  circular relationship or force consumers to import errors from three places, which is worse
  for the surface than the fan-in metric is for the score.
- **Best practices 94/100**: no pre-commit hooks, no Dependabot/Renovate, no commitlint. All
  three are deliberate omissions, explained under residual risks.
- **Docs 92/100**: 105-line README plus four documents under `docs/`, a changelog, and JSDoc on
  the public surface. Contract-level prose now flows from `schema/api.json` into the generated
  types, so the generated module documents itself.
- **Security, secrets, env-validation, dependencies: 100/100.** No credentials in the tree,
  credentials only ever arrive as a caller-supplied option, `SdkError.toJSON()` deliberately
  omits headers and bodies, CI runs with `permissions: contents: read`, and every action is
  pinned to a commit SHA.

## Residual risks — why this is not 100

- **The primary standard has no rubric.** `typescript-sdk` is a charter with candidate rules
  and no published edition, so "conformance" here is an argument, not a measurement. Until the
  rubric is authored and this repo is judged against it, treat the 98 as a code-health score
  rather than as standard conformance.
- **The service is fictional.** There is no real API behind `schema/api.json`, no OpenAPI
  document fetched from a live service, no authentication against a real identity provider,
  and no pagination, retry, rate-limit or idempotency behaviour under real load. A production
  SDK needs retries with backoff and jitter, respect for `Retry-After`, request-id propagation
  into telemetry, and contract tests run against a real staging deployment.
- **No pre-commit hooks, no bot-driven dependency PRs, no commit-lint.** This project is
  trunk-based: work lands directly on `main` and CI is the gate. Hooks can be bypassed with
  `--no-verify`, and automated dependency pull requests would mean bot branches on a repo that
  deliberately has none. A Dependabot config was added and then removed for exactly that
  reason; the manual update cadence is documented in
  [docs/dependency-policy.md](dependency-policy.md). Each of these costs score points and each
  is a considered trade, not an oversight.
- **The package is never published.** `private: true` and the absence of any publish workflow
  mean the release path itself — provenance, registry auth, tag-triggered publication — is
  documented and rehearsed as far as `pnpm pack`, but not executed. A real SDK's evidence would
  include a published tarball with provenance attestation.
- **Single runtime target.** CI covers Node 22 and 24 on Linux only. A real SDK claiming broad
  compatibility would add a browser/edge-runtime consumer fixture, a bundler fixture
  (webpack/rollup resolution of the export map), and a CommonJS interop check — this package is
  ESM-only by choice, and that choice is only asserted, not exercised from a CJS dependent.
- **Coverage is not the same as confidence.** 89.6% branch coverage leaves the rarest transport
  paths — an abort that races a socket error, a non-`Error` throw from an injected `fetch` —
  covered by reasoning rather than by tests.
