// Round-trip AST verifier: verify(src, parse(src)) === src
// Walks AST, fills gaps from source, validates content fields against source.

import type { Node, Script } from "../src/types.ts";

type AnyNode = { type: string; pos: number; end: number; [k: string]: any };

const CHILDREN: Record<string, string[]> = {
  Script: ["commands"],
  Statement: ["command", "redirects"],
  Command: ["prefix", "name", "suffix", "redirects"],
  Pipeline: ["commands"],
  AndOr: ["commands"],
  If: ["clause", "then", "else"],
  For: ["name", "wordlist", "body"],
  ArithmeticFor: ["body"],
  ArithmeticCommand: ["expression"],
  While: ["clause", "body"],
  Case: ["word", "items"],
  CaseItem: ["pattern", "body"],
  Select: ["name", "wordlist", "body"],
  Function: ["name", "body", "redirects"],
  Subshell: ["body"],
  BraceGroup: ["body"],
  CompoundList: ["commands"],
  Coproc: ["name", "body", "redirects"],
  TestCommand: ["expression"],
  TestUnary: ["operand"],
  TestBinary: ["left", "right"],
  TestLogical: ["left", "right"],
  TestNot: ["operand"],
  TestGroup: ["expression"],
  ArithmeticBinary: ["left", "right"],
  ArithmeticUnary: ["operand"],
  ArithmeticTernary: ["test", "consequent", "alternate"],
  ArithmeticGroup: ["expression"],
};

function getChildren(node: AnyNode): AnyNode[] {
  const fields = CHILDREN[node.type];
  if (!fields) return [];
  const children: AnyNode[] = [];
  for (const field of fields) {
    const value = node[field];
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.pos === "number" && item.pos >= node.pos && item.end <= node.end) {
          children.push(item);
        }
      }
    } else if (typeof value.pos === "number" && value.pos >= node.pos && value.end <= node.end) {
      children.push(value);
    }
  }
  // Sort needed: Command nodes can have redirects interleaved with args
  children.sort((a, b) => a.pos - b.pos);
  return children;
}

function fail(node: AnyNode, field: string, expected: string, got: string): never {
  throw new Error(
    `${node.type}.${field} mismatch at ${node.pos}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`,
  );
}

function checkContent(src: string, node: AnyNode) {
  const span = src.slice(node.pos, node.end);
  switch (node.type) {
    case "Assignment":
      // .text is de-quoted, so only check .name (always unquoted)
      if (node.name && !span.startsWith(node.name)) fail(node, "name", span.slice(0, node.name.length), node.name);
      break;
    case "ArithmeticWord":
      if (node.value !== span) fail(node, "value", span, node.value);
      break;
    case "ArithmeticCommand":
      // body is text between (( and )), source span starts with ((
      if (span.startsWith("((") && span.endsWith("))")) {
        const expected = span.slice(2, -2);
        if (node.body !== expected) fail(node, "body", expected, node.body);
      }
      break;
    case "While":
      if (!span.startsWith(node.kind)) fail(node, "kind", span.slice(0, 5), node.kind);
      break;
  }
}

export function verify(source: string, node: Node | Script): string {
  return _verify(source, node);
}

function _verify(source: string, node: AnyNode): string {
  checkContent(source, node);
  const children = getChildren(node);
  if (children.length === 0) return source.slice(node.pos, node.end);
  let result = "";
  let cursor = node.pos;
  for (const child of children) {
    result += source.slice(cursor, child.pos);
    result += _verify(source, child);
    cursor = child.end;
  }
  result += source.slice(cursor, node.end);
  return result;
}
