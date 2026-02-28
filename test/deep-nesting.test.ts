import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "../src/parser.ts";
import { verify } from "./verify.ts";
import type { If, For, While } from "../src/types.ts";

const roundtrip = (src: string) => {
  const ast = parse(src);
  assert.equal(verify(src, ast), src);
  return ast;
};

// --- Nested parameter expansions ---

test("4-level nested ${...:-${...}} default chain", () => {
  const src = 'echo "${a:-${b:-${c:-${d}}}}"';
  roundtrip(src);
});

test("nested ${...} in replacement pattern", () => {
  const src = 'echo "${path//${prefix}/}"';
  roundtrip(src);
});

test("param expansion with nested command substitution", () => {
  const src = 'echo "${var:-$(echo ${fallback:-default})}"';
  roundtrip(src);
});

// --- Nested command substitutions ---

test("3-level nested $(...) command substitution", () => {
  const src = "echo $(cat $(dirname $(readlink -f $0))/file)";
  roundtrip(src);
});

test("nested $() inside double quotes inside $()", () => {
  const src = 'result=$(echo "prefix_$(basename "$file")_suffix")';
  roundtrip(src);
});

test("nested backtick inside $()", () => {
  const src = "echo $(echo `hostname`)";
  roundtrip(src);
});

// --- Nested compound commands ---

test("nested if inside if", () => {
  const src = "if true; then if false; then echo a; else echo b; fi; fi";
  const ast = roundtrip(src);
  const outer = ast.commands[0].command as If;
  const inner = outer.then as If;
  assert.equal(inner.type, "If");
  assert.ok(inner.else);
});

test("3-level nested if", () => {
  const src = "if a; then if b; then if c; then echo deep; fi; fi; fi";
  roundtrip(src);
});

test("nested for inside while", () => {
  const src = "while true; do for x in a b; do echo $x; done; done";
  const ast = roundtrip(src);
  const wh = ast.commands[0].command as While;
  const fr = (wh.body.commands[0] as Statement).command as For;
  assert.equal(fr.type, "For");
});

test("nested subshell inside subshell inside pipeline", () => {
  const src = "( ( echo inner ) | cat ) | grep x";
  roundtrip(src);
});

test("case inside if inside function", () => {
  const src = "f() { if true; then case $x in a) echo a;; b) echo b;; esac; fi; }";
  roundtrip(src);
});

// --- Nested arithmetic ---

test("deeply nested arithmetic groups", () => {
  const src = "echo $(( ((a + b) * (c - d)) / ((e + f) * (g - h)) ))";
  roundtrip(src);
});

test("nested ternary in arithmetic", () => {
  const src = "(( x = a > 0 ? (b > 0 ? 1 : 2) : (c > 0 ? 3 : 4) ))";
  roundtrip(src);
});

// --- Nested test expressions ---

test("deeply nested [[ ]] with grouping and logic", () => {
  const src = '[[ ( -f a && ( -d b || -L c ) ) && ! ( -z "$x" ) ]]';
  roundtrip(src);
});

// --- Mixed deep nesting ---

test("$() inside ${} inside double quotes inside $()", () => {
  const src = 'x=$(echo "${path:-$(dirname "$0")}/config")';
  roundtrip(src);
});

test("heredoc with deeply nested expansions", () => {
  const src = "cat <<EOF\n${a:-${b:-$(echo ${c})}}\nEOF\n";
  roundtrip(src);
});

test("pipeline of compound commands", () => {
  const src = "for x in a b; do echo $x; done | while read line; do echo $line; done | sort";
  roundtrip(src);
});

test("function containing nested redirected pipelines", () => {
  const src = 'f() { { echo a; echo b; } | sort | { while read x; do echo "$x"; done; }; }';
  roundtrip(src);
});
