#!/usr/bin/env node
/**
 * License gate for the installed dependency tree.
 *
 * Every package pnpm resolved must declare a license on the allowlist. An
 * unknown or copyleft license fails the build rather than shipping quietly; the
 * exception procedure is documented in docs/dependency-policy.md.
 */
import { execFileSync } from "node:child_process";

const ALLOWED = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "Python-2.0",
  "Unlicense",
]);

/** Packages allowed to fail the check, each with a reason. Reviewed per release. */
const EXCEPTIONS = new Map();

/** `MIT OR Apache-2.0` passes when either half is allowed; `A AND B` needs both. */
function isAllowed(license) {
  const expression = license.replace(/[()]/g, "").trim();
  if (ALLOWED.has(expression)) return true;
  if (expression.includes(" OR ")) return expression.split(" OR ").some(isAllowed);
  if (expression.includes(" AND ")) return expression.split(" AND ").every(isAllowed);
  return false;
}

const raw = execFileSync("pnpm", ["licenses", "list", "--json"], { encoding: "utf8" });
const byLicense = JSON.parse(raw);

const violations = [];
for (const [license, packages] of Object.entries(byLicense)) {
  for (const entry of packages) {
    if (isAllowed(license) || EXCEPTIONS.has(entry.name)) continue;
    violations.push(`${entry.name}@${entry.versions.join(",")} — ${license}`);
  }
}

const total = Object.values(byLicense).reduce((count, list) => count + list.length, 0);
if (violations.length > 0) {
  process.stderr.write(`license gate failed for ${violations.length} package(s):\n`);
  for (const violation of violations) process.stderr.write(`  - ${violation}\n`);
  process.stderr.write(
    "Add an approved exception in scripts/check-licenses.mjs, or drop the dep.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `license gate ok: ${total} package(s), licenses seen: ${Object.keys(byLicense).sort().join(", ")}\n`,
);
