import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "../src/parser.ts";
import { computeWordParts } from "../src/parts.ts";
import type {
  TestBinaryExpression,
  TestCommand,
  TestExpression,
  TestGroupExpression,
  TestLogicalExpression,
  TestNotExpression,
  TestUnaryExpression,
} from "../src/types.ts";

const getTest = (src: string): TestCommand => {
  const ast = parse(src);
  const node = ast.commands[0].command;
  assert.equal(node.type, "TestCommand");
  return node as TestCommand;
};

const unary = (e: TestExpression) => e as TestUnaryExpression;
const binary = (e: TestExpression) => e as TestBinaryExpression;
const logical = (e: TestExpression) => e as TestLogicalExpression;
const not = (e: TestExpression) => e as TestNotExpression;
const group = (e: TestExpression) => e as TestGroupExpression;

// --- Unary tests ---

test("unary -f", () => {
  const t = getTest("[[ -f $file ]]");
  assert.equal(t.expression.type, "TestUnary");
  assert.equal(unary(t.expression).operator, "-f");
  assert.equal(unary(t.expression).operand.text, "$file");
});

test("unary -d", () => {
  const t = getTest("[[ -d /tmp ]]");
  assert.equal(unary(t.expression).operator, "-d");
  assert.equal(unary(t.expression).operand.text, "/tmp");
});

test("unary -z", () => {
  const t = getTest("[[ -z $empty ]]");
  assert.equal(unary(t.expression).operator, "-z");
  assert.equal(unary(t.expression).operand.text, "$empty");
});

test("unary -n", () => {
  const t = getTest("[[ -n $str ]]");
  assert.equal(unary(t.expression).operator, "-n");
  assert.equal(unary(t.expression).operand.text, "$str");
});

test("unary -e", () => {
  const t = getTest("[[ -e /etc/passwd ]]");
  assert.equal(unary(t.expression).operator, "-e");
});

test("unary -r -w -x", () => {
  for (const op of ["-r", "-w", "-x"]) {
    const t = getTest(`[[ ${op} /tmp ]]`);
    assert.equal(unary(t.expression).operator, op);
  }
});

test("unary -s -L -S -b -c -p -t -v", () => {
  for (const op of ["-s", "-L", "-S", "-b", "-c", "-p", "-t", "-v"]) {
    const t = getTest(`[[ ${op} file ]]`);
    assert.equal(unary(t.expression).operator, op);
  }
});

// --- Binary tests ---

test("binary ==", () => {
  const t = getTest("[[ $str == hello ]]");
  assert.equal(t.expression.type, "TestBinary");
  assert.equal(binary(t.expression).operator, "==");
  assert.equal(binary(t.expression).left.text, "$str");
  assert.equal(binary(t.expression).right.text, "hello");
});

test("binary !=", () => {
  const t = getTest("[[ $str != world ]]");
  assert.equal(binary(t.expression).operator, "!=");
});

test("binary =", () => {
  const t = getTest("[[ $str = hello ]]");
  assert.equal(binary(t.expression).operator, "=");
});

test("binary -eq -ne -lt -le -gt -ge", () => {
  for (const op of ["-eq", "-ne", "-lt", "-le", "-gt", "-ge"]) {
    const t = getTest(`[[ $num ${op} 42 ]]`);
    assert.equal(binary(t.expression).operator, op);
  }
});

test("binary -nt -ot -ef", () => {
  for (const op of ["-nt", "-ot", "-ef"]) {
    const t = getTest(`[[ $a ${op} $b ]]`);
    assert.equal(binary(t.expression).operator, op);
  }
});

test("binary < string comparison", () => {
  const t = getTest("[[ $str < world ]]");
  assert.equal(binary(t.expression).operator, "<");
  assert.equal(binary(t.expression).left.text, "$str");
  assert.equal(binary(t.expression).right.text, "world");
});

test("binary > string comparison", () => {
  const t = getTest("[[ $str > aaa ]]");
  assert.equal(binary(t.expression).operator, ">");
});

// --- Regex matching ---

test("binary =~ simple regex", () => {
  const t = getTest("[[ $str =~ ^[a-z]+$ ]]");
  assert.equal(binary(t.expression).operator, "=~");
  assert.equal(binary(t.expression).right.text, "^[a-z]+$");
});

test("binary =~ regex with parens", () => {
  const t = getTest("[[ $str =~ ^([a-z]+)([0-9]*)$ ]]");
  assert.equal(binary(t.expression).operator, "=~");
  assert.equal(binary(t.expression).right.text, "^([a-z]+)([0-9]*)$");
});

test("binary =~ regex with alternation", () => {
  const t = getTest("[[ $str =~ (hello|world) ]]");
  assert.equal(binary(t.expression).operator, "=~");
  assert.equal(binary(t.expression).right.text, "(hello|world)");
});

test("binary =~ regex with dot-star in parens", () => {
  const t = getTest("[[ $file =~ /etc/(.*) ]]");
  assert.equal(binary(t.expression).operator, "=~");
  assert.equal(binary(t.expression).right.text, "/etc/(.*)");
});

// --- Logical operators ---

test("logical && (AND)", () => {
  const t = getTest("[[ -f $file && -r $file ]]");
  assert.equal(t.expression.type, "TestLogical");
  assert.equal(logical(t.expression).operator, "&&");
  assert.equal(unary(logical(t.expression).left).operator, "-f");
  assert.equal(unary(logical(t.expression).right).operator, "-r");
});

test("logical || (OR)", () => {
  const t = getTest("[[ -d $dir || -f $dir ]]");
  assert.equal(logical(t.expression).operator, "||");
});

test("&& chains", () => {
  const t = getTest("[[ -f $file && -r $file && -s $file ]]");
  assert.equal(logical(t.expression).operator, "&&");
  // Left-associative: ((-f && -r) && -s)
  assert.equal(logical(logical(t.expression).left).operator, "&&");
  assert.equal(unary(logical(t.expression).right).operator, "-s");
});

test("|| has lower precedence than &&", () => {
  const t = getTest('[[ $str == hello && $num -eq 42 || $empty == "" ]]');
  // (str == hello && num -eq 42) || (empty == "")
  assert.equal(logical(t.expression).operator, "||");
  assert.equal(logical(logical(t.expression).left).operator, "&&");
});

// --- Negation ---

test("negation !", () => {
  const t = getTest("[[ ! -z $str ]]");
  assert.equal(t.expression.type, "TestNot");
  assert.equal(unary(not(t.expression).operand).operator, "-z");
});

test("double negation", () => {
  const t = getTest("[[ ! ! -f $file ]]");
  assert.equal(t.expression.type, "TestNot");
  assert.equal(not(t.expression).operand.type, "TestNot");
  assert.equal(unary(not(not(t.expression).operand).operand).operator, "-f");
});

test("negation with logical", () => {
  const t = getTest("[[ ! ( -z $str || -z $file ) ]]");
  assert.equal(t.expression.type, "TestNot");
  assert.equal(not(t.expression).operand.type, "TestGroup");
});

// --- Grouping ---

test("grouped expression", () => {
  const t = getTest("[[ ( -f $file || -d $file ) && -r $file ]]");
  assert.equal(logical(t.expression).operator, "&&");
  assert.equal(logical(t.expression).left.type, "TestGroup");
  const inner = group(logical(t.expression).left).expression;
  assert.equal(logical(inner).operator, "||");
});

test("nested grouping", () => {
  const t = getTest("[[ -d $dir && ( -w $dir || -x $dir ) ]]");
  assert.equal(logical(t.expression).operator, "&&");
  assert.equal(logical(t.expression).right.type, "TestGroup");
});

// --- Standalone word ---

test("standalone word is implicit -n", () => {
  const t = getTest("[[ $str ]]");
  assert.equal(t.expression.type, "TestUnary");
  assert.equal(unary(t.expression).operator, "-n");
  assert.equal(unary(t.expression).operand.text, "$str");
});

// --- Pattern matching ---

test("glob pattern on right side of ==", () => {
  const t = getTest("[[ $str == h* ]]");
  assert.equal(binary(t.expression).operator, "==");
  assert.equal(binary(t.expression).right.text, "h*");
});

test("bracket pattern", () => {
  const t = getTest("[[ $str == [Hh]ello ]]");
  assert.equal(binary(t.expression).operator, "==");
  assert.equal(binary(t.expression).right.text, "[Hh]ello");
});

// --- Integration with other constructs ---

test("[[ ]] in if clause", () => {
  const ast = parse("if [[ -f $file ]]; then echo found; fi");
  assert.equal(ast.commands[0].command.type, "If");
});

test("[[ ]] in while clause", () => {
  const ast = parse("while [[ $n -gt 0 ]]; do echo $n; done");
  assert.equal(ast.commands[0].command.type, "While");
});

test("[[ ]] with && pipeline", () => {
  const ast = parse("[[ -f $file ]] && echo exists");
  assert.equal(ast.commands[0].command.type, "AndOr");
});

test("[[ ]] with redirects", () => {
  const ast = parse("[[ -f $file ]] 2>/dev/null");
  const stmt = ast.commands[0];
  assert.equal(stmt.command.type, "TestCommand");
  assert.equal(stmt.redirects.length, 1);
  assert.equal(stmt.redirects[0].operator, ">");
});

// --- Word parts preserved ---

test("word parts in test operands", () => {
  const src = "[[ -f $file ]]";
  const t = getTest(src);
  const operand = unary(t.expression).operand;
  assert.ok(computeWordParts(src, operand));
  assert.equal(computeWordParts(src, operand)![0].type, "SimpleExpansion");
});

test("word parts in binary left/right", () => {
  const src = "[[ $str == hello ]]";
  const t = getTest(src);
  const left = binary(t.expression).left;
  assert.ok(computeWordParts(src, left));
  assert.equal(computeWordParts(src, left)![0].type, "SimpleExpansion");
});

// --- Edge cases ---

test("unary op at end (bare -f) is standalone word", () => {
  const t = getTest("[[ -f ]]");
  // -f with no operand → treated as implicit -n of the string "-f"
  assert.equal(t.expression.type, "TestUnary");
  assert.equal(unary(t.expression).operator, "-n");
  assert.equal(unary(t.expression).operand.text, "-f");
});

test("regex with complex pattern", () => {
  const t = getTest("[[ $ip =~ ^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$ ]]");
  assert.equal(binary(t.expression).operator, "=~");
});

test("multiple [[ ]] in script", () => {
  const ast = parse("[[ -f a ]]\n[[ -d b ]]");
  assert.equal(ast.commands.length, 2);
  assert.equal(ast.commands[0].command.type, "TestCommand");
  assert.equal(ast.commands[1].command.type, "TestCommand");
});

// --- [[ ]] integration with other constructs ---

test("[[ ]] does not eat < as redirection", () => {
  const ast = parse('[[ "$a" < "$b" ]] && echo less');
  const expr = ast.commands[0].command as import("../src/types.ts").AndOr;
  assert.deepEqual(expr.operators, ["&&"]);
  assert.equal(expr.commands[0].type, "TestCommand");
  assert.equal((expr.commands[1] as import("../src/types.ts").Command).name?.text, "echo");
});

test("[[ ]] with =~ regex", () => {
  const ast = parse("[[ ${1} =~ \\.(lisp|lsp|cl)$ ]]");
  const tc = ast.commands[0].command as import("../src/types.ts").TestCommand;
  assert.equal(tc.type, "TestCommand");
  assert.equal(tc.expression.type, "TestBinary");
  assert.equal((tc.expression as import("../src/types.ts").TestBinaryExpression).operator, "=~");
});

test("[[ ]] in if condition", () => {
  const ast = parse("if [[ $(cat $file) =~ $regex ]]; then\n    echo match\nfi");
  const if_ = ast.commands[0].command as import("../src/types.ts").If;
  assert.equal(if_.type, "If");
});

test("[[ ]] with or and string comparison", () => {
  const ast = parse('[[ "$lsb_dist" != "Ubuntu" || "$ver" < "14.04" ]]');
  assert.equal(ast.commands[0].command.type, "TestCommand");
});

test("[[ ]] with extglob pattern", () => {
  const ast = parse("[[ ${f} != */@(default).vim ]]");
  assert.equal(ast.commands[0].command.type, "TestCommand");
});

test("mixed test and [ with logical ops", () => {
  const ast = parse("test -d /tmp && [ -f /tmp/lock ] && echo locked");
  assert.ok(ast.commands.length > 0);
});
