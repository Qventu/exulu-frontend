import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEMO_EPOCH, parseTimestamp } from "./date-shift";

const DAY = 86_400_000;
const STAMP = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)\b/g;

/**
 * Every fixture timestamp must sit BEFORE the epoch, or at least two days
 * after it (the wall-clock window the shifter leaves alone). A stamp in
 * between is clamped to "a minute ago" on screen — a one-hour recording
 * "vor 1 Minute", a nightly eval run that finished just now. The epoch is
 * chosen to sit past the latest fixture stamp; this pins that choice for
 * the fixtures sub-project 5 will add.
 */
describe("fixture timestamps and the demo epoch", () => {
  const dir = path.join(__dirname, "fixtures");
  const files = fs.readdirSync(dir).filter((f) => /\.(ts|json)$/.test(f) && !f.endsWith(".test.ts"));
  const epoch = Date.parse(DEMO_EPOCH);
  const cutoff = epoch + 2 * DAY;

  it("no fixture stamp falls in the window the shifter clamps", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of text.matchAll(STAMP)) {
        const ms = parseTimestamp(m[0]);
        if (ms !== null && ms >= epoch && ms < cutoff) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("has at least one stamp close to the epoch (the fixtures are not months old)", () => {
    let latest = 0;
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      for (const m of text.matchAll(STAMP)) {
        const ms = parseTimestamp(m[0]);
        if (ms !== null && ms < epoch) latest = Math.max(latest, ms);
      }
    }
    expect(epoch - latest).toBeLessThan(3 * DAY);
  });
});
