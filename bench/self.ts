import { parse } from "../src/parser.ts";
import { bench, group, run } from "mitata";
import { short, advanced, specialized, installers, large } from "./fixtures.ts";

for (const [label, scripts] of [
  ["short", short],
  ["advanced", advanced],
  ...specialized,
  ["medium", installers],
  ["large", large],
] as const) {
  group(label, () => {
    bench(label, () => {
      for (const s of scripts) parse(s);
    });
  });
}

await run();
