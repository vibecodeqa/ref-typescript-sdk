# Dependency policy

Cataloged against the VCQA
[Dependency Hygiene](https://vibecodeqa.online/docs/standards/items/dependencies/) item, which
is a charter today: it records upstream grounding and detection signals, but has no numbered
rules and no published rubric. What follows is this repository's own commitment.

## Runtime dependencies: none

The package has zero `dependencies`. A validator and a `fetch` wrapper do not need a supply
chain, and every dependency an SDK takes is one its dependents inherit transitively without
having chosen it. Validation is hand-written against generated descriptors rather than
delegated to a schema library, and the transport accepts any injected `fetch`-shaped function
instead of bundling an HTTP client.

Development dependencies are four: TypeScript, Vitest, Biome, and `@types/node`.

## Resolution

- pnpm is pinned by `packageManager` (`pnpm@10.33.3`) and enforced by `engines`.
- `pnpm-lock.yaml` is committed and CI installs with `--frozen-lockfile`; a manifest change
  without a lockfile update fails the install step rather than resolving something new.
- Install scripts are not approved. pnpm 10 blocks dependency lifecycle scripts by default and
  this repo keeps it that way — `esbuild` (a Vitest transitive) is reported as blocked on every
  install and works fine without its postinstall.
- Versions are carets on devDependencies; the lockfile, not the range, is what CI installs.

## Gates in CI

| Gate | Command | Fails when |
| --- | --- | --- |
| Lockfile integrity | `pnpm install --frozen-lockfile` | Manifest and lockfile disagree |
| Vulnerabilities | `pnpm audit --audit-level=high` | Any high or critical advisory |
| Licenses | `pnpm check:licenses` | A resolved package's license is off the allowlist |

The license allowlist lives in `scripts/check-licenses.mjs`: permissive licenses only
(MIT, ISC, Apache-2.0, BSD-2/3-Clause, 0BSD, CC0-1.0, Unlicense, BlueOak-1.0.0, MIT-0,
Python-2.0). `A OR B` expressions pass when either half is allowed; `A AND B` needs both.
Everything else, including an absent or unparsed license field, fails the build.

## Update cadence

Updates are reviewed manually and land directly on `main` — this project is trunk-based and
takes no automated dependency pull requests, because a bot branch is a branch. Actions are
pinned to a commit SHA with the human-readable tag in a trailing comment; refreshing them is
part of the same review. `pnpm outdated` is the starting point, `pnpm verify` is the gate.

## Exception policy

There are no standing exceptions today, and the mechanism is deliberately visible rather than
implicit:

- **License** — add the package to the `EXCEPTIONS` map in `scripts/check-licenses.mjs` with a
  written reason. The map is reviewed at every release.
- **Advisory** — an advisory with no available fix is waived through
  `pnpm.auditConfig.ignoreCves` in `package.json`, with the CVE, the reason, and a review date
  recorded in the `CHANGELOG.md` entry for that release. A waived advisory that is still open
  at the next release must be re-justified or the dependency dropped.

Nothing is skipped silently: if a gate cannot pass, either the dependency goes or the
exception is written down where a reviewer will see it.
