import { parse } from "../src/parser.ts";
import { join } from "node:path";
import { bench, group, run, summary } from "mitata";
import { short, advanced, installers, large } from "./fixtures.ts";

type ParseFn = (s: string) => unknown;
type Parser = { name: string; parse: ParseFn; limited?: boolean };

const parsers: Parser[] = [];

try {
  // @ts-ignore — CJS default export
  const bashParser = (await import("bash-parser")).default;
  parsers.push({ name: "bash-parser", parse: bashParser, limited: true });
} catch {
  console.warn("Error adding bash-parser");
}

try {
  // @ts-ignore — CJS default export
  const ecBashParser = (await import("@ericcornelissen/bash-parser")).default;
  parsers.push({ name: "@ericcornelissen/bash-parser", parse: ecBashParser, limited: true });
} catch {
  console.warn("Error adding @ericcornelissen/bash-parser");
}

try {
  // @ts-ignore
  const NativeParser = (await import("tree-sitter")).default;
  const tsbNative = new NativeParser();
  tsbNative.setLanguage((await import("tree-sitter-bash")).default as never);
  parsers.push({ name: "tree-sitter (native)", parse: tsbNative.parse.bind(tsbNative) });
} catch {
  console.warn("Error adding tree-sitter-bash");
}

try {
  // @ts-ignore
  const { Language, Parser: WasmParser } = await import("web-tree-sitter");
  await WasmParser.init();
  const lang = await Language.load(join(import.meta.dirname, "../node_modules/tree-sitter-bash/tree-sitter-bash.wasm"));
  const tsbWasm = new WasmParser();
  tsbWasm.setLanguage(lang);
  parsers.push({ name: "tree-sitter (WASM)", parse: tsbWasm.parse.bind(tsbWasm) });
} catch {
  console.warn("Error adding tree-sitter-bash.wasm");
}

type AsyncParser = { name: string; parse: (s: string) => Promise<unknown> };
const asyncParsers: AsyncParser[] = [];

try {
  const { parse: shSyntaxParse } = await import("sh-syntax");
  await shSyntaxParse("echo hello"); // warm up WASM
  asyncParsers.push({ name: "sh-syntax", parse: shSyntaxParse });
} catch {
  console.warn("Error adding sh-syntax");
}

for (const [label, scripts] of [
  ["short", short],
  ["advanced", advanced],
  ["medium", installers],
  ["large", large],
] as const) {
  group(label, () => {
    summary(() => {
      bench("unbash", () => {
        for (const script of scripts) parse(script);
      }).baseline();

      for (const parser of parsers) {
        if (/advanced|medium|large/.test(label) && parser.name.includes("bash-parser")) continue;

        bench(parser.name, () => {
          for (const script of scripts) parser.parse(script);
        });
      }

      for (const parser of asyncParsers) {
        bench(parser.name, async () => {
          for (const script of scripts) await parser.parse(script);
        });
      }
    });
  });
}

await run();
