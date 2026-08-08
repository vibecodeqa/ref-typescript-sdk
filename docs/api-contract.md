# API contract and drift control

## Source of truth

`schema/api.json` is the committed contract fixture for the fictional Widget API. It
declares named types and operations in a small, explicit descriptor language:

```json
"Widget": {
  "kind": "object",
  "fields": {
    "id": { "kind": "string", "minLength": 1 },
    "status": { "kind": "enum", "values": ["draft", "active", "retired"] }
  }
}
```

A real SDK would fetch this file from the service's OpenAPI endpoint. The shape of the
problem is identical either way: a machine-readable contract exists somewhere upstream, and
the client must not silently fall behind it.

## Generation

`pnpm gen` runs `scripts/generate-api-contract.mjs`, which emits
`src/generated/api-contract.ts` — the only generated file in the repo — and then formats it
with Biome so the output is byte-stable.

The generated module carries two views of the same contract:

1. **Compile-time types** (`Widget`, `WidgetPage`, `CreateWidgetInput`, …) that the public
   API returns and accepts.
2. **Runtime descriptors** (`schemas`, `operations`) that the validator evaluates against
   real payloads.

Both are checked against the hand-written descriptor types in `src/schema-types.ts` with
`satisfies`, so a contract feature the generator cannot express becomes a compile error
instead of a silent runtime gap.

## Drift control

Two gates, on purpose:

- `pnpm check:drift` regenerates the contract and runs `git diff --exit-code -- src/generated`.
  If someone edited the generated file, or changed `schema/api.json` without regenerating,
  CI fails. This is the hard gate.
- `test/contract.test.ts` compares the committed contract against the fixture in-process and
  reports *what* drifted — service identity, type set, operation set, descriptor bodies,
  unresolvable refs, and path placeholders without a declared `pathParams` entry.

## Validation policy

`src/validation.ts` evaluates descriptors against real values at two boundaries:

- **request** — caller arguments, before anything is sent. Failures raise a `ValidationError`
  with `code: "request_invalid"` and no request is issued.
- **response** — the decoded JSON body, before it is returned as a typed value. Failures raise
  `ValidationError` with `code: "response_invalid"`.

Unknown object properties are accepted deliberately: an additive server change must not break
existing clients. Everything else — wrong types, non-integers, out-of-range numbers, values
outside an enum, missing required fields, `null` where the contract does not allow it — is
rejected with a path-addressed issue list.

## Changing the contract

1. Edit `schema/api.json`.
2. Run `pnpm gen`.
3. Run `pnpm verify`. Type errors point at every call site the change affects.
4. Record the change in `CHANGELOG.md`. A removed field or a narrowed type is a breaking
   change under [docs/releasing.md](releasing.md).
