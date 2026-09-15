/**
 * Exports every piece of client-facing German copy in the demo tour to a CSV
 * sheet, so Daniel and OPEN's marketing lead can review and rewrite it
 * without touching code.
 *
 * One row per TEXT FIELD, not per step or per content block: a bullet list
 * with three items is three rows, because "Neuer Text" is a single string a
 * reviewer edits in place, and cramming three sentences into one cell makes
 * that impossible to do without re-inventing CSV escaping by hand in a
 * spreadsheet editor.
 *
 * A scene step (route under /demo/szene/) carries no content of its own — the
 * copy lives in lib/demo/scenes.ts and renders full-width instead of in the
 * panel. This script reads through lib/demo/step-content.ts's `contentOf`,
 * the one shared lookup the tests use too, so a scene's words are in the
 * sheet like everything else. A scene's TITLE is not a special case: it is
 * the step's title, the same single field every other step has.
 *
 * `Kurzfassung` is `lead` — the one sentence always visible in the panel,
 * `content` behind "Mehr" (see lib/demo/tour.ts's DemoStep.lead). No step has
 * one yet; every step therefore also gets an explicit Kurzfassung row with an
 * empty "Text (aktuell)", which is the row a reviewer fills in with the new
 * sentence rather than a rewrite of something that already exists.
 *
 * Run with: npx tsx scripts/export-demo-copy.ts > IMP-Demo-Texte.csv
 */
import { CHAPTERS } from "../lib/demo/chapters";
import type { ContentBlock } from "../lib/demo/content";
import { contentOf } from "../lib/demo/step-content";
import type { DemoStep } from "../lib/demo/tour";

const COLUMNS = [
  "Kapitel",
  "Kapitel-ID",
  "Kapitel-Titel",
  "Schritt",
  "Schritt-ID",
  "Feld",
  "Kurzfassung",
  "Text (aktuell)",
  "Neuer Text",
  "Kommentar",
] as const;

interface Row {
  kapitel: number;
  kapitelId: string;
  kapitelTitel: string;
  schritt: number;
  schrittId: string;
  feld: string;
  /** The step's own Kurzfassung (lead), repeated on every row of that step. */
  kurzfassung: string;
  text: string;
}

/** RFC 4180 quoting: only when the field needs it, never gratuitously. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

/** Every editable German string a single content block carries, labelled. */
function fieldsOfBlock(block: ContentBlock): Array<{ feld: string; text: string }> {
  switch (block.kind) {
    case "paragraph":
      return [{ feld: "Absatz", text: block.text }];
    case "bullets":
      return block.items.map((text, i) => ({ feld: `Bullet ${i + 1}`, text }));
    case "callout":
      return [{ feld: `Callout (${block.tone === "fact" ? "Fakt" : "Zitat"})`, text: block.text }];
    case "stat":
      return [
        { feld: "Stat-Wert", text: block.value },
        { feld: "Stat-Label", text: block.label },
      ];
    case "figure":
      return block.alt ? [{ feld: "Bild-Alt", text: block.alt }] : [];
    case "sequence":
      return block.steps.map((text, i) => ({ feld: `Sequenzschritt ${i + 1}`, text }));
    default: {
      const unhandled: never = block;
      return unhandled;
    }
  }
}

/** Every editable German string a single step carries, in reading order. */
function fieldsOfStep(step: DemoStep): Array<{ feld: string; text: string }> {
  const fields: Array<{ feld: string; text: string }> = [{ feld: "Titel", text: step.title }];
  // The Kurzfassung row always exists, current text empty until the sheet
  // comes back — see this file's docblock. step.lead is never populated by
  // this implementation, but the row shape holds regardless.
  fields.push({ feld: "Kurzfassung", text: step.lead ?? "" });
  for (const block of contentOf(step)) {
    fields.push(...fieldsOfBlock(block));
  }
  if (step.cta) {
    fields.push({ feld: "CTA-Label", text: step.cta.label });
  }
  return fields;
}

function buildRows(): Row[] {
  const rows: Row[] = [];
  CHAPTERS.forEach((chapter, chapterIndex) => {
    chapter.steps.forEach((step, stepIndex) => {
      const kurzfassung = step.lead ?? "";
      for (const { feld, text } of fieldsOfStep(step)) {
        rows.push({
          kapitel: chapterIndex + 1,
          kapitelId: chapter.id,
          kapitelTitel: chapter.title,
          schritt: stepIndex + 1,
          schrittId: step.id,
          feld,
          kurzfassung,
          text,
        });
      }
    });
  });
  return rows;
}

function toCsv(rows: Row[]): string {
  const lines = [csvLine([...COLUMNS])];
  for (const row of rows) {
    lines.push(
      csvLine([
        String(row.kapitel),
        row.kapitelId,
        row.kapitelTitel,
        String(row.schritt),
        row.schrittId,
        row.feld,
        row.kurzfassung,
        row.text,
        "",
        "",
      ]),
    );
  }
  return lines.join("\n") + "\n";
}

function main() {
  const rows = buildRows();
  const csv = toCsv(rows);

  const chapterCount = new Set(rows.map((r) => r.kapitelId)).size;
  const stepCount = new Set(rows.map((r) => `${r.kapitelId}/${r.schrittId}`)).size;

  process.stdout.write(csv);
  console.error(`\n${rows.length} rows across ${chapterCount} chapters and ${stepCount} steps.`);
}

main();
