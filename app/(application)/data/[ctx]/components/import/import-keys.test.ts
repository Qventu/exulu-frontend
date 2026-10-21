import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { IMPORT_ERROR_CODES } from "@/lib/api/imports";
import { IMPORT_JOB_STATES } from "@/lib/import/job-view";
import deMessages from "@/messages/de.json";
import enMessages from "@/messages/en.json";

/**
 * Guards drift between the STATIC `t("workspace.import.server…")` /
 * `t("workspace.pipeline…imports…")` keys the import wizard, the run step
 * and the imports card actually call, and what `messages/en.json` /
 * `messages/de.json` provide under them. Every `t` in these files is
 * `useTranslations("knowledge")`-scoped (see step-run-server.tsx,
 * import-job-row.tsx, imports-card.tsx, …), so a key the source calls
 * `t("workspace.import.server.run.cancel")` resolves at
 * `knowledge.workspace.import.server.run.cancel` in the message files.
 *
 * The source walk only collects STATIC literals — the two call sites that
 * build a key from a union (`t(\`workspace.import.server.errors.${code}\`)` in
 * use-server-import.ts / imports-card.tsx / step-run-server.tsx, and
 * `t(\`workspace.import.server.state.${view.state}\`)` in import-job-row.tsx)
 * are string-matched by nothing. The second describe below walks the unions
 * themselves instead: `IMPORT_ERROR_CODES` (which `ImportErrorCode` is derived
 * from) and `IMPORT_JOB_STATES` (derived from `STATE_BADGE`, which is
 * `Record<ImportJobState, …>`), so a code or state added to either union
 * cannot reach a `t()` call without copy in both locales.
 *
 * It exists so a future rename or typo in either the component or the message
 * files fails loudly instead of shipping a raw
 * "workspace.import.server.run.…" string to users — this repo sets no
 * next-intl `getMessageFallback`/`onError`, so a missing key renders its own
 * path on the one screen whose job is to explain a failure.
 */

const COMPONENTS_DIR = path.join(
  process.cwd(),
  "app",
  "(application)",
  "data",
  "[ctx]",
  "components",
);
const IMPORT_WIZARD_DIR = path.join(COMPONENTS_DIR, "import");
const IMPORTS_CARD_FILE = path.join(COMPONENTS_DIR, "imports-card.tsx");

const KEY_PATTERN =
  /\bt\(\s*"((?:workspace\.import\.server|workspace\.pipeline\.imports)[^"]*)"/g;

function collectKeysFromFile(file: string, out: Set<string>) {
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(KEY_PATTERN)) out.add(m[1]);
}

/** Non-recursive: the import wizard's files all sit directly in this dir. */
function collectKeysFromDir(dir: string, out: Set<string>) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) continue;
    if (entry.includes(".test.")) continue;
    if (!/\.tsx?$/.test(entry)) continue;
    collectKeysFromFile(full, out);
  }
}

function resolve(messages: unknown, dottedKey: string): unknown {
  return dottedKey
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      messages,
    );
}

const keys = new Set<string>();
collectKeysFromDir(IMPORT_WIZARD_DIR, keys);
collectKeysFromFile(IMPORTS_CARD_FILE, keys);

describe("import i18n key resolution", () => {
  it("found the static t() keys to guard (catches a broken directory walk)", () => {
    expect(keys.size).toBeGreaterThan(0);
  });

  for (const key of [...keys].sort()) {
    const full = `knowledge.${key}`;
    it(`"${full}" resolves in en and de`, () => {
      expect(
        resolve(enMessages, full),
        `messages/en.json is missing ${full}`,
      ).not.toBeUndefined();
      expect(
        resolve(deMessages, full),
        `messages/de.json is missing ${full}`,
      ).not.toBeUndefined();
    });
  }
});

describe("import i18n keys built from a union", () => {
  it("found both unions to walk (catches a renamed or emptied export)", () => {
    expect(IMPORT_ERROR_CODES.length).toBeGreaterThan(0);
    expect(IMPORT_JOB_STATES.length).toBeGreaterThan(0);
  });

  for (const code of IMPORT_ERROR_CODES) {
    const full = `knowledge.workspace.import.server.errors.${code}`;
    it(`"${full}" resolves in en and de`, () => {
      expect(
        resolve(enMessages, full),
        `messages/en.json is missing ${full}`,
      ).not.toBeUndefined();
      expect(
        resolve(deMessages, full),
        `messages/de.json is missing ${full}`,
      ).not.toBeUndefined();
    });
  }

  for (const state of IMPORT_JOB_STATES) {
    const full = `knowledge.workspace.import.server.state.${state}`;
    it(`"${full}" resolves in en and de`, () => {
      expect(
        resolve(enMessages, full),
        `messages/en.json is missing ${full}`,
      ).not.toBeUndefined();
      expect(
        resolve(deMessages, full),
        `messages/de.json is missing ${full}`,
      ).not.toBeUndefined();
    });
  }
});
