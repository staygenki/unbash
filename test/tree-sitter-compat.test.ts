import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parse } from "../src/parser.ts";

const dir = join(import.meta.dirname, "../fixtures/tree-sitter-corpus");
const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));

function parseSections(source: string): { name: string; code: string }[] {
  const sections: { name: string; code: string }[] = [];
  const parts = source.split(/^={3,}$/m);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const name = parts[i].trim();
    const body = parts[i + 1];
    const dashIdx = body.indexOf("\n---\n");
    const code = (dashIdx >= 0 ? body.slice(0, dashIdx) : body).trim();
    if (code) sections.push({ name, code });
  }
  return sections;
}

for (const file of files) {
  const source = readFileSync(join(dir, file), "utf8");
  const sections = parseSections(source);

  for (const { name, code } of sections) {
    test(`[${file}] ${name}`, () => {
      const result = parse(code);
      assert.equal(result.type, "Script");
      assert.ok(Array.isArray(result.commands));
    });
  }
}
