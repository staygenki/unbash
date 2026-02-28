import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "../src/parser.ts";

// ── Error recovery ──────────────────────────────────────────────────

test("unclosed single quote doesn't throw", () => {
  const ast = parse("echo 'unterminated");
  assert.equal(ast.type, "Script");
});

test("unclosed double quote doesn't throw", () => {
  const ast = parse('echo "unterminated');
  assert.equal(ast.type, "Script");
});

test("unmatched parentheses don't throw", () => {
  const ast = parse("(echo hello");
  assert.equal(ast.type, "Script");
});

test("truncated if (missing fi) doesn't throw", () => {
  const ast = parse("if true; then echo yes");
  assert.equal(ast.type, "Script");
});

test("truncated for (missing done) doesn't throw", () => {
  const ast = parse("for x in a b; do echo $x");
  assert.equal(ast.type, "Script");
});

test("truncated while (missing done) doesn't throw", () => {
  const ast = parse("while true; do echo loop");
  assert.equal(ast.type, "Script");
});

// ── Edge-case inputs ─────────────────────────────────────────────────

test("empty input returns empty Script", () => {
  const ast = parse("");
  assert.equal(ast.type, "Script");
  assert.equal(ast.commands.length, 0);
});

test("whitespace-only returns empty Script", () => {
  const ast = parse("   \n\n  \t  ");
  assert.equal(ast.type, "Script");
  assert.equal(ast.commands.length, 0);
});

test("comment-only returns empty Script", () => {
  const ast = parse("# just a comment\n# another");
  assert.equal(ast.type, "Script");
  assert.equal(ast.commands.length, 0);
});
