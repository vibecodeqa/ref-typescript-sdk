# Contributing

This repository is a VCQA reference implementation: it exists to be read, forked and judged
against the [TypeScript SDK stack](https://vibecodeqa.online/docs/standards/stacks/typescript-sdk/).
Changes are welcome when they make the reference clearer or closer to the standard.

## Setup

```bash
corepack enable          # pnpm 10, pinned by packageManager
pnpm install             # installs the root package and both consumer fixtures
pnpm verify              # everything CI runs, in the same order
```

Node 22 or 24 (`engines` allows `>=22 <27`). CI runs both.

## Before you push

`pnpm verify` runs lint, typecheck, declaration build, unit and integration tests with
coverage thresholds, the contract drift check, both consumer fixtures, and the license gate.
CI runs exactly these on every push and pull request; there are no pre-commit hooks, on
purpose — the gate lives in CI where it cannot be bypassed with `--no-verify`.

## Working rules

- **Never edit `src/generated/api-contract.ts`.** Change `schema/api.json` and run `pnpm gen`.
  `pnpm check:drift` fails the build otherwise.
- **Validate at boundaries.** Anything crossing a process boundary is checked against the
  contract before it is typed. A cast is not validation.
- **Errors are contract.** Adding, removing or repurposing an `SdkErrorCode` is a breaking
  change; `test/errors.test.ts` pins the set.
- **Keep the public surface deliberate.** Anything exported from `src/index.ts` is a promise.
  `test/package-surface.test.ts` asserts the packed tarball matches `files` and `exports`.
- **New dependencies need a reason.** The package ships zero runtime dependencies, and every
  dependency is inherited by every dependent. See [docs/dependency-policy.md](docs/dependency-policy.md).

## Commits and releases

Commit messages are conventional (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`) and reference the
tracking issue. Update `CHANGELOG.md` in the same commit as any change dependents can observe.
Versioning and publication rules are in [docs/releasing.md](docs/releasing.md). This repository
is `private` and has no publish workflow; releases are described, never performed here.

Work lands directly on `main` — this project is trunk-based, with CI as the gate.
