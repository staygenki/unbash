import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parse } from "../src/parser.ts";

const fixturesDir = join(import.meta.dirname, "../fixtures");

for (const subdir of readdirSync(fixturesDir)) {
  if (subdir === "tree-sitter-corpus") continue; // has its own test

  const dir = join(fixturesDir, subdir);
  for (const file of readdirSync(dir)) {
    test(`[${subdir}] ${file}`, () => {
      const source = readFileSync(join(dir, file), "utf8");
      const result = parse(source);
      assert.equal(result.type, "Script");
      assert.ok(Array.isArray(result.commands));
      assert.ok(result.commands.length > 0, "expected at least one command");
    });
  }
}
