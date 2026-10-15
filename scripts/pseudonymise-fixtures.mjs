/**
 * One-off: applies lib/demo/fixtures/pseudonyms.ts to the fixture files'
 * string content and renames the chunk export. Comment lines in TS files are
 * left alone (they record provenance). Idempotent; re-running changes nothing.
 *
 *   npx tsx scripts/pseudonymise-fixtures.mjs
 *
 * Kept in the repo as the record of the transformation, next to the three
 * build-algi-*-fixture.py scripts that produced the redacted exports.
 */
import fs from "node:fs";
import path from "node:path";

import { pseudonymise } from "../lib/demo/fixtures/pseudonyms.ts";

const DIR = path.resolve("lib/demo/fixtures");
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

let changed = 0;
for (const name of fs.readdirSync(DIR)) {
  if (name === "pseudonyms.ts" || name.endsWith(".test.ts")) continue;
  if (!name.endsWith(".ts") && !name.endsWith(".json")) continue;
  const file = path.join(DIR, name);
  const before = fs.readFileSync(file, "utf8");
  const after = name.endsWith(".json")
    ? pseudonymise(before)
    : before.split("\n").map((line) => (isComment(line) ? line : pseudonymise(line))).join("\n");
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
    console.log("rewrote", name);
  }
}
const oldChunks = path.join(DIR, "chunks-fst2xt-de.json");
if (fs.existsSync(oldChunks)) {
  fs.renameSync(oldChunks, path.join(DIR, "chunks-ks2xt-de.json"));
  console.log("renamed chunks-fst2xt-de.json → chunks-ks2xt-de.json");
}
console.log(`${changed} file(s) rewritten`);
