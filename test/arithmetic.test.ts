import assert from "node:assert/strict";
import test from "node:test";
import { parseArithmeticExpression } from "../src/arithmetic.ts";
import { parse } from "../src/parser.ts";
import { computeWordParts } from "../src/parts.ts";
import type {
  ArithmeticBinary,
  ArithmeticExpression,
  ArithmeticGroup,
  ArithmeticTernary,
  ArithmeticUnary,
  ArithmeticWord,
  ArithmeticFor,
  Command,
} from "../src/types.ts";

const getCmd = (ast: ReturnType<typeof parse>, i = 0) => ast.commands[i].command as Command;
const bin = (e: ArithmeticExpression) => e as ArithmeticBinary;
const unary = (e: ArithmeticExpression) => e as ArithmeticUnary;
const ternary = (e: ArithmeticExpression) => e as ArithmeticTernary;
const group = (e: ArithmeticExpression) => e as ArithmeticGroup;
const word = (e: ArithmeticExpression) => e as ArithmeticWord;

// --- Direct parser tests ---

test("empty string returns null", () => {
  assert.equal(parseArithmeticExpression(""), null);
  assert.equal(parseArithmeticExpression("   "), null);
});

test("single number", () => {
  const e = parseArithmeticExpression("42")!;
  assert.equal(e.type, "ArithmeticWord");
  assert.equal(word(e).value, "42");
});

test("single variable", () => {
  const e = parseArithmeticExpression("x")!;
  assert.equal(word(e).value, "x");
});

test("addition", () => {
  const e = parseArithmeticExpression("x + y")!;
  assert.equal(bin(e).operator, "+");
  assert.equal(word(bin(e).left).value, "x");
  assert.equal(word(bin(e).right).value, "y");
});

test("subtraction", () => {
  const e = parseArithmeticExpression("x - y")!;
  assert.equal(bin(e).operator, "-");
});

test("multiplication", () => {
  const e = parseArithmeticExpression("x * y")!;
  assert.equal(bin(e).operator, "*");
});

test("division", () => {
  const e = parseArithmeticExpression("y / x")!;
  assert.equal(bin(e).operator, "/");
});

test("modulo", () => {
  const e = parseArithmeticExpression("y % x")!;
  assert.equal(bin(e).operator, "%");
});

test("exponentiation", () => {
  const e = parseArithmeticExpression("2 ** 10")!;
  assert.equal(bin(e).operator, "**");
});

test("precedence: * binds tighter than +", () => {
  const e = parseArithmeticExpression("a + b * c")!;
  assert.equal(bin(e).operator, "+");
  assert.equal(word(bin(e).left).value, "a");
  assert.equal(bin(bin(e).right).operator, "*");
});

test("precedence: () overrides", () => {
  const e = parseArithmeticExpression("(a + b) * c")!;
  assert.equal(bin(e).operator, "*");
  assert.equal(group(bin(e).left).expression.type, "ArithmeticBinary");
  assert.equal(bin(group(bin(e).left).expression).operator, "+");
});

test("** is right-associative", () => {
  const e = parseArithmeticExpression("2 ** 3 ** 4")!;
  assert.equal(bin(e).operator, "**");
  assert.equal(word(bin(e).left).value, "2");
  assert.equal(bin(bin(e).right).operator, "**");
});

test("comparison operators", () => {
  for (const op of ["<", "<=", ">", ">=", "==", "!="]) {
    const e = parseArithmeticExpression(`x ${op} y`)!;
    assert.equal(bin(e).operator, op);
  }
});

test("logical operators", () => {
  const e = parseArithmeticExpression("a && b || c")!;
  assert.equal(bin(e).operator, "||");
  assert.equal(bin(bin(e).left).operator, "&&");
});

test("bitwise operators", () => {
  const e = parseArithmeticExpression("a & b | c ^ d")!;
  // | binds loosest of the three
  assert.equal(bin(e).operator, "|");
});

test("shift operators", () => {
  const e = parseArithmeticExpression("x << 2")!;
  assert.equal(bin(e).operator, "<<");
  const e2 = parseArithmeticExpression("y >> 1")!;
  assert.equal(bin(e2).operator, ">>");
});

// --- Unary operators ---

test("unary minus", () => {
  const e = parseArithmeticExpression("-x")!;
  assert.equal(unary(e).operator, "-");
  assert.equal(unary(e).prefix, true);
  assert.equal(word(unary(e).operand).value, "x");
});

test("unary plus", () => {
  const e = parseArithmeticExpression("+x")!;
  assert.equal(unary(e).operator, "+");
  assert.equal(unary(e).prefix, true);
});

test("logical not", () => {
  const e = parseArithmeticExpression("!x")!;
  assert.equal(unary(e).operator, "!");
  assert.equal(unary(e).prefix, true);
});

test("bitwise not", () => {
  const e = parseArithmeticExpression("~x")!;
  assert.equal(unary(e).operator, "~");
  assert.equal(unary(e).prefix, true);
});

test("prefix increment", () => {
  const e = parseArithmeticExpression("++x")!;
  assert.equal(unary(e).operator, "++");
  assert.equal(unary(e).prefix, true);
});

test("prefix decrement", () => {
  const e = parseArithmeticExpression("--x")!;
  assert.equal(unary(e).operator, "--");
  assert.equal(unary(e).prefix, true);
});

test("postfix increment", () => {
  const e = parseArithmeticExpression("x++")!;
  assert.equal(unary(e).operator, "++");
  assert.equal(unary(e).prefix, false);
  assert.equal(word(unary(e).operand).value, "x");
});

test("postfix decrement", () => {
  const e = parseArithmeticExpression("x--")!;
  assert.equal(unary(e).operator, "--");
  assert.equal(unary(e).prefix, false);
});

// --- Ternary ---

test("ternary operator", () => {
  const e = parseArithmeticExpression("x > y ? x : y")!;
  assert.equal(ternary(e).test.type, "ArithmeticBinary");
  assert.equal(word(ternary(e).consequent).value, "x");
  assert.equal(word(ternary(e).alternate).value, "y");
});

test("nested ternary", () => {
  const e = parseArithmeticExpression("a ? b : c ? d : e")!;
  assert.equal(e.type, "ArithmeticTernary");
  assert.equal(ternary(e).alternate.type, "ArithmeticTernary");
});

// --- Assignment ---

test("simple assignment", () => {
  const e = parseArithmeticExpression("x = 5")!;
  assert.equal(bin(e).operator, "=");
  assert.equal(word(bin(e).left).value, "x");
  assert.equal(word(bin(e).right).value, "5");
});

test("compound assignment operators", () => {
  for (const op of ["+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]) {
    const e = parseArithmeticExpression(`x ${op} 5`)!;
    assert.equal(bin(e).operator, op);
  }
});

test("assignment is right-associative", () => {
  const e = parseArithmeticExpression("a = b = c")!;
  assert.equal(bin(e).operator, "=");
  assert.equal(bin(bin(e).right).operator, "=");
});

// --- Comma ---

test("comma operator", () => {
  const e = parseArithmeticExpression("a = 1, b = 2")!;
  assert.equal(bin(e).operator, ",");
  assert.equal(bin(bin(e).left).operator, "=");
  assert.equal(bin(bin(e).right).operator, "=");
});

// --- Special values ---

test("hex literal", () => {
  const e = parseArithmeticExpression("0xFF")!;
  assert.equal(word(e).value, "0xFF");
});

test("octal literal", () => {
  const e = parseArithmeticExpression("0777")!;
  assert.equal(word(e).value, "0777");
});

test("base-N literal", () => {
  const e = parseArithmeticExpression("2#10101010")!;
  assert.equal(word(e).value, "2#10101010");
});

test("dollar variable", () => {
  const e = parseArithmeticExpression("$x + 1")!;
  assert.equal(bin(e).operator, "+");
  assert.equal(word(bin(e).left).value, "$x");
});

test("dollar brace expansion", () => {
  const e = parseArithmeticExpression("${#arr[@]} + 1")!;
  assert.equal(bin(e).operator, "+");
  assert.equal(word(bin(e).left).value, "${#arr[@]}");
});

test("array subscript", () => {
  const e = parseArithmeticExpression("arr[i] + 1")!;
  assert.equal(bin(e).operator, "+");
  assert.equal(word(bin(e).left).value, "arr[i]");
});

// --- Complex expressions ---

test("complex: (x + y) * (z - 1)", () => {
  const e = parseArithmeticExpression("(x + y) * (z - 1)")!;
  assert.equal(bin(e).operator, "*");
  assert.equal(group(bin(e).left).expression.type, "ArithmeticBinary");
  assert.equal(group(bin(e).right).expression.type, "ArithmeticBinary");
});

test("complex: n * (n + 1) / 2", () => {
  const e = parseArithmeticExpression("n * (n + 1) / 2")!;
  // * and / are same precedence, left-associative
  // (n * (n+1)) / 2
  assert.equal(bin(e).operator, "/");
  assert.equal(bin(bin(e).left).operator, "*");
});

test("complex: (1 << n) - 1", () => {
  const e = parseArithmeticExpression("(1 << n) - 1")!;
  assert.equal(bin(e).operator, "-");
  assert.equal(group(bin(e).left).expression.type, "ArithmeticBinary");
  assert.equal(bin(group(bin(e).left).expression).operator, "<<");
});

test("complex: rgb bitfield", () => {
  const e = parseArithmeticExpression("(255 << 16) | (128 << 8) | 64")!;
  assert.equal(bin(e).operator, "|");
});

test("complex: nested ternary", () => {
  const e = parseArithmeticExpression("x == 0 ? 1 : (x > 0 ? x : -x)")!;
  assert.equal(e.type, "ArithmeticTernary");
  const alt = ternary(e).alternate;
  assert.equal(alt.type, "ArithmeticGroup");
});

// --- Integration: $((expr)) ---

test("$((expr)) in word parts has expr", () => {
  const src = "echo $((x + y))";
  const c = getCmd(parse(src));
  const parts = computeWordParts(src, c.suffix[0])!;
  assert.equal(parts[0].type, "ArithmeticExpansion");
  const expr = (parts[0] as any).expression;
  assert.ok(expr);
  assert.equal(expr.type, "ArithmeticBinary");
  assert.equal(expr.operator, "+");
});

test("$((expr)) nested in double quotes", () => {
  const src = 'echo "result: $((a * b))"';
  const c = getCmd(parse(src));
  const parts = computeWordParts(src, c.suffix[0])!;
  assert.equal(parts[0].type, "DoubleQuoted");
  const inner = (parts[0] as any).parts;
  const arith = inner.find((p: any) => p.type === "ArithmeticExpansion");
  assert.ok(arith);
  assert.ok(arith.expression);
  assert.equal(arith.expression.operator, "*");
});

// --- Integration: (( expr )) ---

test("(( expr )) has parsed expr in ArithmeticCommand", () => {
  const ast = parse("(( x += 5 ))");
  const node = ast.commands[0].command as import("../src/types.ts").ArithmeticCommand;
  assert.equal(node.type, "ArithmeticCommand");
  assert.equal(node.body, " x += 5 ");
  assert.ok(node.expression);
  assert.equal(node.expression!.type, "ArithmeticBinary");
  assert.equal((node.expression as any).operator, "+=");
});

// --- Integration: ArithmeticFor ---

test("for (( init; test; update )) has parsed exprs", () => {
  const ast = parse("for (( i = 0; i < 10; i++ )); do echo $i; done");
  const node = ast.commands[0].command as ArithmeticFor;
  assert.equal(node.type, "ArithmeticFor");

  assert.ok(node.initialize);
  assert.equal(node.initialize!.type, "ArithmeticBinary");
  assert.equal((node.initialize as ArithmeticBinary).operator, "=");

  assert.ok(node.test);
  assert.equal(node.test!.type, "ArithmeticBinary");
  assert.equal((node.test as ArithmeticBinary).operator, "<");

  assert.ok(node.update);
  assert.equal(node.update!.type, "ArithmeticUnary");
  assert.equal((node.update as ArithmeticUnary).operator, "++");
  assert.equal((node.update as ArithmeticUnary).prefix, false);
});

test("for (( i=0, j=10; ... )) comma in init", () => {
  const ast = parse("for (( i = 0, j = 10; i < j; i++, j-- )); do echo; done");
  const node = ast.commands[0].command as ArithmeticFor;
  assert.ok(node.initialize);
  assert.equal((node.initialize as ArithmeticBinary).operator, ",");
  assert.ok(node.update);
  assert.equal((node.update as ArithmeticBinary).operator, ",");
});

// --- ArithmeticCommand ---

test("(( )) produces ArithmeticCommand", () => {
  const ast = parse("(( x++ ))");
  const node = ast.commands[0].command as import("../src/types.ts").ArithmeticCommand;
  assert.equal(node.type, "ArithmeticCommand");
  assert.equal(node.body.trim(), "x++");
});

test("(( )) has parsed expr", () => {
  const ast = parse("(( 1 + 2 * 3 ))");
  const node = ast.commands[0].command as import("../src/types.ts").ArithmeticCommand;
  assert.ok(node.expression);
  assert.equal(node.expression!.type, "ArithmeticBinary");
});

test("(( )) in if clause", () => {
  const ast = parse("if (( x > 0 )); then echo pos; fi");
  assert.equal(ast.commands[0].command.type, "If");
});

test("(( )) in while clause", () => {
  const ast = parse("while (( n-- > 0 )); do echo $n; done");
  assert.equal(ast.commands[0].command.type, "While");
});

test("(( )) in logical expression", () => {
  const ast = parse("(( x > 0 )) && echo yes");
  const logic = ast.commands[0].command as import("../src/types.ts").AndOr;
  assert.equal(logic.type, "AndOr");
  assert.equal(logic.commands[0].type, "ArithmeticCommand");
});

test("(( )) in pipeline", () => {
  const ast = parse("(( x++ )) | cat");
  const pipe = ast.commands[0].command as import("../src/types.ts").Pipeline;
  assert.equal(pipe.type, "Pipeline");
  assert.equal(pipe.commands[0].type, "ArithmeticCommand");
});

test("(( )) body preserved", () => {
  const ast = parse("(( a = b + c - d * e ))");
  const node = ast.commands[0].command as import("../src/types.ts").ArithmeticCommand;
  assert.equal(node.body, " a = b + c - d * e ");
});

test("(( )) does not interfere with C-style for", () => {
  const ast = parse("for (( i=0; i<3; i++ )); do echo $i; done");
  assert.equal(ast.commands.length, 1);
  assert.equal(ast.commands[0].command.type, "ArithmeticFor");
});

// --- (( )) vs ( ) disambiguation ---

test("(( at command position is arithmetic command", () => {
  const ast = parse("(( x++ ))");
  assert.equal(ast.commands[0].command.type, "ArithmeticCommand");
});

test("$(( )) is arithmetic expansion in word", () => {
  const c = getCmd(parse("echo $((1+2))"));
  assert.equal(c.suffix[0].text, "$((1+2))");
});

test("( is subshell", () => {
  const ast = parse("(echo hello)");
  assert.equal(ast.commands[0].command.type, "Subshell");
});

// --- Arithmetic expressions in scripts ---

test("arithmetic expressions parse without errors", () => {
  const scripts = [
    "echo $((1 + 2 - 3 * 4 / 5))",
    "a=$((6 % 7 ** 8))",
    "echo $((a>b?5:10))",
    "echo $((${j:-5} + 1))",
    "echo $(( 0x12A ))",
    "echo $((++a))",
  ];
  for (const script of scripts) {
    const ast = parse(script);
    assert.ok(ast.commands.length > 0, `Failed: ${script}`);
  }
});
