import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  files: string[];
  exports: Record<string, string | Record<string, string>>;
  types: string;
};

let packed: string[] = [];
let tarballDir = "";

/**
 * The `files`/`exports` surface is a promise to consumers, so it is asserted
 * against a real tarball rather than against the README. Anything published by
 * accident — tests, fixtures, workflows, tsconfigs — fails this test.
 */
beforeAll(() => {
  execFileSync("pnpm", ["run", "build"], { cwd: root, stdio: "pipe" });
  tarballDir = mkdtempSync(join(tmpdir(), "widget-sdk-pack-"));
  execFileSync("pnpm", ["pack", "--pack-destination", tarballDir], { cwd: root, stdio: "pipe" });
  const tarball = readdirSync(tarballDir).find((entry) => entry.endsWith(".tgz")) ?? "";
  packed = execFileSync("tar", ["-tzf", join(tarballDir, tarball)], { encoding: "utf8" })
    .split("\n")
    .filter((entry) => entry !== "" && !entry.endsWith("/"))
    .map((entry) => entry.replace(/^package\//, ""))
    .sort();
}, 120_000);

afterAll(() => {
  if (tarballDir !== "") rmSync(tarballDir, { recursive: true, force: true });
});

describe("published package surface", () => {
  it("ships the declared entry point, its declarations and its sources", () => {
    expect(packed).toContain("dist/index.js");
    expect(packed).toContain("dist/index.d.ts");
    expect(packed).toContain("dist/generated/api-contract.d.ts");
    expect(packed).toContain("src/index.ts");
  });

  it("ships the documents npm shows on the package page", () => {
    expect(packed).toContain("package.json");
    expect(packed).toContain("README.md");
    expect(packed).toContain("LICENSE");
    expect(packed).toContain("CHANGELOG.md");
  });

  it("ships nothing from the development surface", () => {
    const leaked = packed.filter(
      (entry) =>
        entry.startsWith("test/") ||
        entry.startsWith("examples/") ||
        entry.startsWith("scripts/") ||
        entry.startsWith("schema/") ||
        entry.startsWith(".github/") ||
        entry.startsWith("docs/") ||
        entry.startsWith("tsconfig"),
    );
    expect(leaked).toEqual([]);
  });

  it("resolves every export-map target to a packed file", () => {
    const targets = Object.values(pkg.exports)
      .flatMap((entry) => (typeof entry === "string" ? [entry] : Object.values(entry)))
      .concat(pkg.types)
      .map((target) => target.replace(/^\.\//, ""));
    for (const target of new Set(targets)) {
      expect(packed, `export target ${target}`).toContain(target);
    }
  });
});
