# Release and publication policy

## Versioning

The package follows [Semantic Versioning](https://semver.org/). Pre-1.0 it is still strict
about what counts as breaking, because the point of an SDK is that dependents can upgrade
without reading the diff.

**Major** — anything a dependent can observe breaking:

- removing or renaming an export from `src/index.ts`;
- removing an `SdkErrorCode`, or changing which code a given failure produces;
- narrowing an accepted input type, or widening a returned type;
- removing a field from a contract type, or making an optional field required;
- raising the floor in `engines`, or changing the export map's conditions.

**Minor** — additive only: a new operation, a new optional option, a new error subclass under
an existing code, a new contract field.

**Patch** — behaviour-preserving fixes, docs, dependency bumps with no surface change.

The error `code` union and the export map are the two surfaces most likely to break someone
quietly, so both are pinned by tests (`test/errors.test.ts`, `test/package-surface.test.ts`).

## Changelog

`CHANGELOG.md` is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) shaped and updated
in the same commit as the change — not at release time. Every entry states the impact on
dependents, and breaking entries name the migration.

## What gets published

`files` is curated, and asserted against a real `pnpm pack` tarball in
`test/package-surface.test.ts`:

| Included | Why |
| --- | --- |
| `dist/` | Compiled ESM plus `.d.ts` and source maps |
| `src/` | Referenced by the shipped source maps, so stack traces stay readable |
| `README.md`, `LICENSE`, `CHANGELOG.md` | npm package page and license compliance |

Everything else — `test/`, `examples/`, `scripts/`, `schema/`, `docs/`, `.github/`, tsconfigs —
is excluded, and the test fails if any of it leaks in.

Resolution is controlled by an explicit `exports` map, not by `main`. The package is ESM-only
(`"type": "module"`); there is no CommonJS entry, and dependents on CJS must use a dynamic
`import()`. `./package.json` is exported so tooling can read the manifest.

## Release procedure (for a package that is not a fixture)

1. `pnpm verify` locally and green CI on `main`.
2. Bump the version and finalise the `CHANGELOG.md` section in one commit.
3. Tag `v<version>` and push the tag.
4. A `workflow_dispatch`- or tag-triggered workflow publishes with npm provenance
   (`npm publish --provenance --access public`) using a registry token held as a repository
   secret, on a workflow with `id-token: write` and nothing else.

Releases never happen from a developer machine: the tag is the trigger, CI is the publisher,
and the tarball CI publishes is the one CI built.

## Why this repository never publishes

This repo is a VCQA reference fixture, not a product. `package.json` sets `"private": true`
and the repository ships **no** publish workflow, so no push, tag or merge can release it. The
publishable surface is still fully exercised — `pnpm pack` runs on every CI build and its
contents are asserted — which is the part a reference implementation needs to demonstrate.

A fork that wants to ship removes `"private": true`, claims a real package name, and adds the
tag-gated publish workflow described above.
