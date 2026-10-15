# Demo Tour Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the tour its growth moment (the memory map with a sweeping time slider), show what a routine run is about instead of that some fail, state the platform in chapters 10 and 11, and end on the offer with a call to action on every step.

**Architecture:** Four chapter edits and one new fixture family. The memory map is the product's `ContextMapCard` on `/memory/[ctx]`, answered by new demo resolvers from a seeded fixture of example memories; a product-neutral `timelineAutoplayMs` prop sweeps the slider once. Chapter 9 gets a `?run=` deep link into `RoutineRunsList` and a second anchor on the stored session. Chapters 10 and 11 are copy. The closing scene gets a `paths` content block and the real booking URL; the panel footer links to it on every step. The tour ends at 38 steps.

**Tech Stack:** Next.js 16, three.js (already in the map), Apollo demo link, vitest (node), Playwright outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — section "Sub-project 8 — Wachstum, Inhalt, Plattform, Abschluss (2026-10-15)".

**Branch:** `fix/demo-tour-growth` from `main` (62a55b3); spec commit 8885639.

**Decisions since the spec (Daniel, 2026-10-15):** the closing scene uses layout A (two paths side by side, one button) with the texts of variant B; the booking URL is `https://meetings-eu1.hubspot.com/dclaessen/kostenlose-erstberatung-open-imp`; no customer names on the last step. Ruling to record in the spec: with one URL and one button, the label is "Kostenlose Erstberatung buchen" (the page the URL opens), used for the scene button and the panel link alike; no path is highlighted.

## Global Constraints

- Register: du/dein for the visitor, euer/eure for the company, never Sie (`lib/demo/register.ts`; `chapters/index.test.ts` scans every string; a sentence-initial "Ihr" is refused).
- Honesty register (`tour.test.ts`): chapter 8 "beispielhaft", chapter 10 "von Hand", chapter 11 "Beispielwerte" and no `SAVINGS_CLAIM`; this plan adds chapter 6 "Beispieleinträge". Client names only in chapter 12 and `brand.ts` — and for now not in the closing scene either.
- Product identifiers stay pseudonymised (`lib/demo/fixtures/pseudonyms.ts`; the scan test covers every fixture, so the new memory fixture must use KS-… names, never FST).
- Every string a document selects is returned by its resolver; cache-backed tests (`runDemoQueryThroughCache`) are the gate for new rows.
- Numbers a fixture determines are computed into copy; `germanCount` returns digits above twenty, so "64 Einträge" is correct output.
- Daniel runs the production build; the executor walks. Per-task gate `npx vitest run <files>` + `npx eslint --no-warn-ignored <files>`; commits per task, commitlint ≤ 100 chars, never push. Node patch scripts with exact-match guards for edits; the Write tool for new files.

## Review Focus

1. The slider sweep must not run under `prefers-reduced-motion`, must run once, and must leave the window cleared — Task 3's component test (node, pure helper `sweepFrames`) pins the frame plan; the build check watches it.
2. The `?run=` param must not throw on a page without a search-param Suspense boundary and must ignore unknown ids — Task 2 reads it once on mount and the page is `force-dynamic`.
3. The example memories must be marked on screen in both chapter-6 steps that show their count or cloud (`memory.3` copy and `memory.4` copy) — Task 3's register test asserts "Beispieleinträge" in chapter 6.
4. The persistent panel link must not change the keyboard path to Weiter (3 Tabs) — Task 4 places it last in DOM order and first visually; the walker's count is the check.
5. The old `logos` block kind and `MEMORY_COUNT_AFTER_CORRECTION`'s consumers (overview row, chapter copy, chapter-memory tests) must agree on 64 — Task 3's tests pin the count in three places.

---

### Task 1: Chapters 10 and 11 state the platform

**Files:**
- Modify: `lib/demo/chapters/meetings.ts`, `lib/demo/chapters/kosten.ts`, `lib/demo/tour.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/demo/tour.test.ts` inside `describe("the chapters that show something invented")` (after the kosten tests):

```ts
  it("states the platform in chapter 10 and keeps the hand-made document honest", () => {
    expect(bodies("meetings")).toMatch(/Teams, Google Meet und Zoom/);
    expect(bodies("meetings")).toMatch(/Sprecherzuordnung/);
    expect(bodies("meetings")).toMatch(/Follow-up-Mails/);
    expect(bodies("meetings")).toMatch(/von Hand/i);
  });

  it("frames chapter 11's first step as making usage visible", () => {
    const first = CHAPTERS.find((c) => c.id === "kosten")!.steps[0];
    expect(first.title).toBe("Mach die KI-Nutzung sichtbar");
    expect(contentText(first.content)).toMatch(/welche Modelle am besten funktionieren/);
    expect(contentText(first.content)).toMatch(/Beispielwerte/);
  });
```

Run: `npx vitest run lib/demo/tour.test.ts` — Expected: FAIL on both.

- [ ] **Step 2: The copy**

`lib/demo/chapters/meetings.ts` (the `T`/`germanCount`/`capitalise` imports become unused — remove them):
| Field | New text |
|---|---|
| meetings-list title | Besprechungen, die zu Wissen werden |
| meetings-list paragraph | OPEN IMP vereint euer Wissen, Besprechungen eingeschlossen: Transkripte aus Teams, Google Meet und Zoom, Audioaufnahmen aus Vor-Ort-Terminen mit Sprecherzuordnung — und ein Rechtemanagement, das ein Transkript nur den richtigen Personen zeigt. |
| meetings-guide paragraph | Dieselbe Besprechung als Arbeitsanweisung: Freigabe prüfen, Lüftung nicht aus der Kabinentür ableiten, offene Punkte benennen. Ein Transkript lässt sich automatisch an einen eurer Assistenten geben: zusammenfassen, Follow-up-Mails verschicken, Tickets anlegen und mehr. Dieses eine Dokument entstand noch von Hand — der Kunde hat den Schritt nicht ausgeführt. |

Header comment of `meetings.ts`: add "Sub-project 8: the list step states the platform (Teams, Meet, Zoom, on-site audio, rights); the tally stays available for other copy."

`lib/demo/chapters/kosten.ts`:
| Field | New text |
|---|---|
| kosten-verbrauch title | Mach die KI-Nutzung sichtbar |
| kosten-verbrauch paragraph | Welches Team, welches Projekt, welcher Nutzer die KI am meisten nutzt, welche Modelle am besten funktionieren und wie sich das über die Zeit entwickelt — laufend erfasst, in einer Auswertung. |
| callout | unchanged ("Die Zahlen auf diesem Bildschirm sind Beispielwerte, …") |

- [ ] **Step 3: Gate and commit**

Run: `npx vitest run lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/fixtures/pseudonyms.test.ts && npx eslint --no-warn-ignored lib/demo/chapters/meetings.ts lib/demo/chapters/kosten.ts lib/demo/tour.test.ts`
Expected: PASS.

```bash
git add lib/demo/chapters/meetings.ts lib/demo/chapters/kosten.ts lib/demo/tour.test.ts
git commit -m "feat(demo): chapters 10 and 11 state the platform and make usage visible"
```

---

### Task 2: Chapter 9 shows what a run is about

**Files:**
- Modify: `components/widgets/routine-runs/runs-list.tsx` (`?run=` seed, `data-demo-id="routine-run-open"`), `lib/demo/chapters/email.ts`, `lib/demo/routes.ts` (`ALGI_RUNS_OPEN`), `lib/demo/resolvers.approval.test.ts`, `lib/demo/tour.test.ts` (37), `scripts/walk-demo.mjs` (probes)

**Interfaces:**
- Produces: route `ALGI_RUNS_OPEN = /workflows/${ALGI_ROUTINE_ID}?run=${APPROVAL_RUN_ID}` (export `APPROVAL_RUN_ID` from `chapter-email.ts`), anchor `routine-run-open`, step ids `email-runs` (expanded), `email-request` (session top), `email-approval`.

- [ ] **Step 1: Write the failing test**

In `lib/demo/resolvers.approval.test.ts` replace the "is the chapter's last step…" test:

```ts
  it("shows the run, then what it is about, then the approval", () => {
    const steps = CHAPTERS.find((c) => c.id === "email")!.steps;
    expect(steps.map((s) => s.id)).toEqual(["email-routine", "email-trigger", "email-runs", "email-request", "email-approval"]);
    expect(steps[2].route).toBe(ALGI_RUNS_OPEN);
    expect(steps[2].anchor).toBe("routine-run-open");
    expect(steps[3].route).toBe(ALGI_CHAT);
    expect(steps[3].anchor).toBe("chat-messages");
    expect(steps[3].scrollBlock).toBe("start");
    expect(steps[4].anchor).toBe("chat-tool-approval");
  });
```
(import `ALGI_RUNS_OPEN` from `./routes`.) In `lib/demo/tour.test.ts` the count becomes 37 ("plus chapter 9's request step").

Run: `npx vitest run lib/demo/resolvers.approval.test.ts lib/demo/tour.test.ts` — Expected: FAIL.

- [ ] **Step 2: The deep link and the anchor**

`components/widgets/routine-runs/runs-list.tsx`: import `useSearchParams` from `next/navigation`; replace the `expandedId` state line:

```tsx
  // `?run=<id>` opens that row on load — a deep link for a notification or a
  // guided walk. Read once; the user's clicks own the state afterwards.
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = React.useState<string | null>(
    () => searchParams?.get("run") ?? null,
  );
```

On the expanded panel (`:640`): `<div className="space-y-3 border-t bg-muted/10 px-3 py-3" data-demo-id="routine-run-open">`.

- [ ] **Step 3: Routes, steps, probes**

`lib/demo/fixtures/chapter-email.ts`: `export const APPROVAL_RUN_ID …` (it is `const` today). `lib/demo/routes.ts`: import it and add `export const ALGI_RUNS_OPEN = \`/workflows/${ALGI_ROUTINE_ID}?run=${APPROVAL_RUN_ID}\`;` (import `ALGI_ROUTINE_ID` too).

`lib/demo/chapters/email.ts` — the `email-runs` step becomes:

```ts
    {
      id: "email-runs",
      route: ALGI_RUNS_OPEN,
      anchor: "routine-run-open",
      scrollBlock: "start",
      title: "Fünfundzwanzig Anfragen, von selbst bearbeitet",
      content: [
        {
          kind: "paragraph",
          text: "In zwei Wochen sind hier 25 Anfragen eingegangen und ohne Zutun bearbeitet worden. Eine ist geöffnet: eine Ersatzteilanfrage per Mail, mit Absender und Betreff. Was daraus wurde, siehst du im nächsten Schritt.",
        },
      ],
    },
    {
      id: "email-request",
      route: ALGI_CHAT,
      anchor: "chat-messages",
      scrollBlock: "start",
      title: "Worum es geht",
      content: [
        {
          kind: "paragraph",
          text: "Die Mail oben ist die Anfrage: ein Dichtungssatz für einen Hydraulikheber, Kommissionsnummer dabei. Der Assistent hat den Katalog durchsucht und einen Angebotsentwurf geschrieben — drei Positionen, Preise, Empfehlung. Ein Verkäufer hat ihn dreimal korrigiert; jede Korrektur ist ins Gedächtnis gewandert.",
        },
      ],
    },
```
(`email-approval` follows unchanged; import `ALGI_RUNS_OPEN` from `../routes`.)

`scripts/walk-demo.mjs` `CLICK_PROBES`: `"email.2"` → `{ attempts: [{ spec: { kind: "css", selector: '[data-demo-id="routine-run-open"] a[href^="/chat/"]' }, describe: "the open run's 'Unterhaltung öffnen' link — would navigate to the session" }] }`; add `"email.3": COPY_BUTTON,` and `"email.4": COPY_BUTTON,`.

- [ ] **Step 4: Gate and commit**

Run: `npx vitest run lib/demo/resolvers.approval.test.ts lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/nav-routes.test.ts lib/demo/supported-routes.test.ts && npx eslint --no-warn-ignored components/widgets/routine-runs/runs-list.tsx lib/demo/chapters/email.ts lib/demo/routes.ts lib/demo/fixtures/chapter-email.ts scripts/walk-demo.mjs && node --check scripts/walk-demo.mjs`
Expected: PASS (`supported-routes.test` splits the route on `?`).

```bash
git add components/widgets/routine-runs/runs-list.tsx lib/demo/chapters/email.ts lib/demo/routes.ts lib/demo/fixtures/chapter-email.ts lib/demo/resolvers.approval.test.ts lib/demo/tour.test.ts scripts/walk-demo.mjs
git commit -m "feat(demo): chapter 9 opens the waiting run and shows what it is about"
```

---

### Task 3: The memory map with a sweeping slider

**Files:**
- Create: `lib/demo/fixtures/memory-examples.ts`, `lib/demo/resolvers.memory-map.test.ts`, `components/widgets/context-map/sweep.ts`, `components/widgets/context-map/sweep.test.ts`
- Modify: `lib/demo/fixtures/chapter-memory.ts` (examples join the base; `MEMORY_COUNT_AFTER_CORRECTION`, `MEMORY_CONTRIBUTORS`), `lib/demo/resolvers.ts` (map operations, `MemoryBaseById`, `MemoriesPagination` branch, source session/messages, `MemoryBases` contributors), `components/widgets/context-map/context-map-card.tsx` (anchor, `timelineAutoplayMs`), `app/(application)/memory/[ctx]/components/base-shell.tsx` (pass it in demo), `lib/demo/chapters/memory.ts` (memory.3 copy, new memory.4), `lib/demo/chapter-memory.test.ts`, `lib/demo/resolvers.memory-bases.test.ts`, `lib/demo/tour.test.ts` (38, "Beispieleinträge"), `scripts/walk-demo.mjs` (memory.4 probe; wait), comments "36" → "38"

**Interfaces:**
- Produces: `MEMORY_EXAMPLES: Item[]` (60), `MEMORY_TOPICS` (4 centres), `memoryMapPoints(items)`, `MEMORY_CONTRIBUTORS` (5 names), `MEMORY_COUNT_AFTER_CORRECTION` = 64, anchor `memory-map`, `timelineAutoplayMs` prop, `sweepFrames(bounds, durationMs, stepMs)`.

- [ ] **Step 1: Write the failing tests**

`components/widgets/context-map/sweep.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { DAY_MS } from "./map-data";
import { sweepFrames } from "./sweep";

describe("sweepFrames", () => {
  const bounds = { from: 0, to: 10 * DAY_MS };

  it("walks the window's end from the first day to the last and ends cleared", () => {
    const frames = sweepFrames(bounds, 1000, 250);
    expect(frames[0]).toEqual({ from: 0, to: 0 });
    expect(frames[frames.length - 2]).toEqual({ from: 0, to: 10 * DAY_MS });
    expect(frames[frames.length - 1]).toBeNull();
    expect(frames).toHaveLength(6);
  });

  it("is empty when the span is a single day or the duration is zero", () => {
    expect(sweepFrames({ from: 0, to: 0 }, 1000, 250)).toEqual([]);
    expect(sweepFrames(bounds, 0, 250)).toEqual([]);
  });
});
```

`lib/demo/resolvers.memory-map.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GET_MEMORY_BASE, GET_MEMORY_ITEMS, GET_SOURCE_SESSION } from "@/app/(application)/memory/queries";
import { GET_CONTEXT_MAP_POINTS, GET_CONTEXT_MAP_TOPICS, GET_CONTEXT_PROJECTION_STATUS } from "@/lib/graphql/operations/context-map";

import { contentText } from "./content";
import { MEMORY_CONTEXT_ID, MEMORY_COUNT_AFTER_CORRECTION, MEMORY_CONTRIBUTORS, MEMORY_WRITTEN_AT_STEP } from "./fixtures/chapter-memory";
import { MEMORY_EXAMPLES, MEMORY_TOPICS } from "./fixtures/memory-examples";
import { runDemoQueryThroughCache as run } from "./test-support";
import { CHAPTERS } from "./tour";

const AT = { chapter: "memory", step: 4 } as const;
type Point = { id: string; itemId: string; x: number; y: number; z: number; itemName: string; group: string | null; chunks: number; createdAtMs: number | null };

describe("the memory map (chapter 6, last step)", () => {
  it("has sixty example memories over eight weeks in four topics, pseudonym-clean", () => {
    expect(MEMORY_EXAMPLES).toHaveLength(60);
    expect(MEMORY_TOPICS).toHaveLength(4);
    const days = new Set(MEMORY_EXAMPLES.map((m) => (m.createdAt as string).slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(30);
    for (const m of MEMORY_EXAMPLES) expect(m.name, m.id).not.toMatch(/FST/);
  });

  it("answers the map with one point per memory, clustered around fitted topics", async () => {
    const status = await run(GET_CONTEXT_PROJECTION_STATUS, { contextId: MEMORY_CONTEXT_ID }, AT);
    expect((status.contextProjectionStatus as { fitted: boolean; mappedChunks: number }).fitted).toBe(true);
    const topics = (await run(GET_CONTEXT_MAP_TOPICS, { contextId: MEMORY_CONTEXT_ID }, AT)).contextMapTopics as { id: string; label: string; count: number }[];
    expect(topics.map((t) => t.label)).toEqual(MEMORY_TOPICS.map((t) => t.label));
    expect(topics.reduce((n, t) => n + t.count, 0)).toBe(MEMORY_COUNT_AFTER_CORRECTION);
    const data = await run(GET_CONTEXT_MAP_POINTS, { contextId: MEMORY_CONTEXT_ID, mode: "PASSAGES", groupField: "type", limit: 5000 }, AT);
    const points = (data.contextMapPoints as { points: Point[]; total: number }).points;
    expect(points).toHaveLength(MEMORY_COUNT_AFTER_CORRECTION);
    for (const p of points) {
      expect(typeof p.x + typeof p.y + typeof p.z).toBe("numbernumbernumber");
      expect(p.createdAtMs).toBeGreaterThan(0);
    }
    // Deterministic: the same world yields the same cloud.
    const again = (await run(GET_CONTEXT_MAP_POINTS, { contextId: MEMORY_CONTEXT_ID, mode: "PASSAGES", groupField: "type", limit: 5000 }, AT)).contextMapPoints as { points: Point[] };
    expect(again.points.map((p) => [p.x, p.y, p.z])).toEqual(points.map((p) => [p.x, p.y, p.z]));
  });

  it("answers the base page's own operations", async () => {
    const base = (await run(GET_MEMORY_BASE, { id: MEMORY_CONTEXT_ID }, AT)).contextById as { memoryBase: { ok: boolean } };
    expect(base.memoryBase.ok).toBe(true);
    const items = (await run(GET_MEMORY_ITEMS(MEMORY_CONTEXT_ID, true), { page: 1, limit: 50 }, AT)) as Record<string, { items: unknown[] }>;
    expect(items[`${MEMORY_CONTEXT_ID}_itemsPagination`].items.length).toBe(50);
    const session = await run(GET_SOURCE_SESSION, { id: "b6251e12-1624-4197-a9b4-0ad657bae7f1" }, AT);
    expect((session.agent_sessionById as { id: string }).id).toBeTruthy();
  });

  it("counts 64 after the correction and 63 before, with five contributors", async () => {
    expect(MEMORY_COUNT_AFTER_CORRECTION).toBe(64);
    expect(MEMORY_CONTRIBUTORS).toHaveLength(5);
    const before = (await run(GET_MEMORY_ITEMS(MEMORY_CONTEXT_ID, true), { page: 1, limit: 100 }, { chapter: "memory", step: MEMORY_WRITTEN_AT_STEP - 1 })) as Record<string, { pageInfo: { itemCount: number } }>;
    expect(before[`${MEMORY_CONTEXT_ID}_itemsPagination`].pageInfo.itemCount).toBe(63);
  });

  it("is chapter 6's last step and says the map shows example entries", () => {
    const steps = CHAPTERS.find((c) => c.id === "memory")!.steps;
    expect(steps.map((s) => s.id)).toEqual(["memory-miss", "memory-correct", "memory-write", "memory-base", "memory-map"]);
    expect(steps[4].route).toBe(`/memory/${MEMORY_CONTEXT_ID}`);
    expect(steps[4].anchor).toBe("memory-map");
    expect(contentText(steps[4].content)).toMatch(/Beispieleinträge/);
    expect(contentText(steps[3].content)).toMatch(/^64 Einträge/);
  });
});
```

Updates to existing tests: `lib/demo/resolvers.memory-bases.test.ts` — `stats.contributors` becomes `MEMORY_CONTRIBUTORS.length` (5) and the copy regex `/^64 Einträge/`; the "answers in a world that is not chapter 6's" test keeps `toBeGreaterThanOrEqual(0)`. `lib/demo/chapter-memory.test.ts` — the three/four counts become `MEMORY_COUNT_AFTER_CORRECTION - 1` / `MEMORY_COUNT_AFTER_CORRECTION` where they are literal (read the file; it references `memoryStepCount()` and the constant already). `lib/demo/tour.test.ts` — count 38; add to the invented register: `expect(bodies("memory")).toMatch(/Beispieleinträge/);`.

Run: `npx vitest run components/widgets/context-map/sweep.test.ts lib/demo/resolvers.memory-map.test.ts lib/demo/tour.test.ts` — Expected: FAIL (modules missing, operations unmapped, 36 steps).

- [ ] **Step 2: The example memories**

`lib/demo/fixtures/memory-examples.ts` — the texts are the deliverable; sixty entries, four topics, dates 2026-07-02 … 2026-08-22 (day offsets below, from 2026-07-02T08:00Z, spread so no day holds more than three), types mixed. Names and information use KS-… only.

```ts
import type { Item } from "@/types/models/item";

import { demoItem } from "./item";

/**
 * Sixty EXAMPLE memories for the map in chapter 6 (spec, sub-project 8):
 * what a service team teaches an assistant over eight weeks. Invented, and
 * declared as examples on screen — chapter 6's copy says so, the way chapters
 * 8 and 11 mark their numbers. The four real memories in chapter-memory.ts
 * sit among them. Product identifiers follow the pseudonym scheme (KS-…).
 */
export type MemoryTopic = { id: string; label: string; x: number; y: number; z: number };

export const MEMORY_TOPICS: readonly MemoryTopic[] = [
  { id: "topic-steuerung", label: "Steuerung & Inbetriebnahme", x: -6, y: 2, z: 0 },
  { id: "topic-fehler", label: "Fehlerbilder & Diagnose", x: 6, y: 2, z: 0 },
  { id: "topic-normen", label: "Normen & Prüfung", x: 0, y: -5, z: 3 },
  { id: "topic-ablaeufe", label: "Kunden & Abläufe", x: 0, y: 5, z: -3 },
];

type Example = [day: number, topic: 0 | 1 | 2 | 3, type: "FACT" | "PREFERENCE" | "INSIGHT", name: string, information: string];

const EXAMPLES: Example[] = [
  [0, 0, "FACT", "KS-2XT Lernfahrt vor Kalibrierfahrt", "Die Lernfahrt muss vor der Kalibrierfahrt abgeschlossen sein, sonst bricht die Kalibrierfahrt mit Meldung 41 ab."],
  [1, 1, "FACT", "Meldung 12 bei Türzonenfehler", "Meldung 12 erscheint, wenn der Türzonenschalter im Stand nicht schließt; zuerst den Magneten am Fahrkorb prüfen."],
  [2, 2, "FACT", "Prüffrist Notrufsystem", "Das Notrufsystem ist alle drei Tage automatisch zu testen; der Test wird im Prüfbuch dokumentiert."],
  [3, 3, "PREFERENCE", "Angebote immer mit Kommissionsnummer", "Ersatzteilangebote tragen die Kommissionsnummer der Anlage im Betreff, damit der Kunde sie zuordnen kann."],
  [4, 0, "FACT", "Parameter P07 Verzögerungsweg", "P07 setzt den Verzögerungsweg in Millimetern; bei Hydraulik typischerweise 900 bis 1200."],
  [5, 1, "INSIGHT", "Sporadischer Nothalt nach Umbau", "Ein sporadischer Nothalt nach Umbau auf KS-2XT lag bisher immer an einer losen Schirmung am CAN-Bus."],
  [6, 2, "FACT", "EN 81-20 Lichtstärke Fahrkorb", "Die Beleuchtungsstärke im Fahrkorb muss mindestens 100 Lux am Boden erreichen, auch bei Notbeleuchtung 5 Lux."],
  [7, 3, "FACT", "Ansprechpartner Kundendienst Nord", "Für Anlagen im Bezirk Nord ist der Kundendienst über die Hotline mit Vorwahl 040 erreichbar, nicht über das Ticketportal."],
  [8, 0, "FACT", "Menüpfad Fehlerspeicher KS-3", "Der Fehlerspeicher der KS-3 liegt unter HAUPTMENUE/Diagnose/Fehlerspeicher; Einträge lassen sich dort einzeln quittieren."],
  [9, 1, "FACT", "Meldung 27 Überlast", "Meldung 27 bedeutet Überlast; vor dem Quittieren die Lastmessung kalibrieren, sonst kehrt die Meldung zurück."],
  [10, 2, "FACT", "Prüfung Fangvorrichtung", "Die Fangvorrichtung ist bei der Hauptprüfung mit Prüflast zu testen; das Protokoll gehört in die Anlagenakte."],
  [11, 3, "PREFERENCE", "Antworten an Techniker kurz halten", "Techniker im Einsatz wollen den Menüpfad und den Parameterwert, keine Einleitung."],
  [12, 0, "FACT", "KS-2 Softwarestand ablesen", "Der Softwarestand der KS-2 steht unter HAUPTMENUE/Info/Version; für Updates ist V2.19 der Mindeststand."],
  [13, 1, "INSIGHT", "Türfehler bei Kälte", "Türfehler in den Wintermonaten häufen sich bei Anlagen mit Außenschacht; die Türmotorparameter um 10 Prozent anheben hilft."],
  [14, 2, "FACT", "Dokumentationspflicht Änderungen", "Jede Änderung an sicherheitsrelevanten Parametern wird mit Datum, Wert und Name im Anlagenbuch festgehalten."],
  [15, 3, "FACT", "Ersatzteile Lieferzeit Standard", "Standard-Ersatzteile sind ab Lager in zwei Werktagen verfügbar; Sonderanfertigungen brauchen drei Wochen."],
  [16, 0, "FACT", "Einfahrtweg bei Hydraulik", "Der Einfahrtweg wird bei Hydraulikanlagen über P12 gesetzt und nach jeder Ölwechsel-Wartung geprüft."],
  [17, 1, "FACT", "Meldung 55 Schachtkopiersystem", "Meldung 55 zeigt eine Störung des Schachtkopiersystems; zuerst den Magnetbandsensor auf Verschmutzung prüfen."],
  [18, 2, "FACT", "Wartungsintervall Seile", "Tragseile werden halbjährlich auf Drahtbrüche geprüft; ab zehn Brüchen je Schlaglänge ist der Austausch fällig."],
  [19, 3, "INSIGHT", "Rückfragen zu Angeboten", "Rückfragen kommen fast immer zur Dichtungsgröße; ein Satz zur Zylindergröße im Angebot spart die Rückfrage."],
  [20, 0, "FACT", "Kalibrierfahrt Dauer", "Eine Kalibrierfahrt über zehn Haltestellen dauert etwa vier Minuten; vorher alle Türen schließen."],
  [21, 1, "FACT", "Meldung 08 Phasenfolge", "Meldung 08 meldet eine falsche Phasenfolge; zwei Phasen am Hauptschalter tauschen, nicht am Umrichter."],
  [22, 2, "FACT", "Prüfbuch Aufbewahrung", "Das Prüfbuch verbleibt an der Anlage und wird mindestens zehn Jahre aufbewahrt."],
  [23, 3, "PREFERENCE", "Anrede in Kundenmails", "Kunden der Region Süd werden in Mails förmlich angesprochen; die Vorlage Angebot-Süd verwenden."],
  [24, 0, "FACT", "Parameterreset KS-2XT", "Ein Parameterreset erfolgt über HAUPTMENUE/Konfig/Werkseinstellungen und löscht auch die Lernfahrt."],
  [25, 1, "INSIGHT", "Bündigkeit nach Antriebstausch", "Nach einem Antriebstausch stimmt die Bündigkeit erst nach erneuter Lernfahrt; eine Korrektur über P12 allein reicht nicht."],
  [26, 2, "FACT", "Notbefreiung Unterweisung", "Beauftragte Personen für die Notbefreiung werden jährlich unterwiesen; die Unterweisung wird dokumentiert."],
  [27, 3, "FACT", "Störungsannahme Zeiten", "Störungen außerhalb der Geschäftszeit laufen über die Bereitschaft; Reaktionszeit zwei Stunden."],
  [28, 0, "FACT", "KS-3 Anzeigehelligkeit", "Die Anzeigehelligkeit des DP-TFT wird unter HAUPTMENUE/Anzeige/Helligkeit eingestellt, Werte 1 bis 10."],
  [29, 1, "FACT", "Meldung 33 Übertemperatur", "Meldung 33 zeigt Übertemperatur im Schaltschrank; Lüfterfilter prüfen, bevor der Umrichter getauscht wird."],
  [30, 2, "FACT", "Hauptprüfung Frist", "Die Hauptprüfung ist alle zwei Jahre fällig, die Zwischenprüfung jeweils dazwischen."],
  [31, 3, "INSIGHT", "Angebotsannahme per Mail", "Kunden bestätigen Angebote meist per Antwortmail ohne Unterschrift; das reicht für die Auftragsanlage."],
  [32, 0, "FACT", "Gruppensteuerung Adresse", "In einer Gruppe trägt jede Steuerung eine eindeutige Adresse unter HAUPTMENUE/Konfig/Gruppe; Adresse 0 ist der Master."],
  [33, 1, "FACT", "Meldung 61 Lichtschranke", "Meldung 61 zeigt eine unterbrochene Lichtschranke; nach dem Reinigen den Sender neu ausrichten."],
  [34, 2, "FACT", "Aufzugswärter Aufgaben", "Der Aufzugswärter prüft wöchentlich Notruf, Beleuchtung und Türfunktion und trägt das Ergebnis ein."],
  [35, 3, "FACT", "Sammelrechnung Monatsende", "Kunden mit Rahmenvertrag erhalten eine Sammelrechnung zum Monatsende, keine Einzelrechnungen."],
  [36, 0, "PREFERENCE", "Menüpfade immer vollständig", "Menüpfade werden immer vollständig ab HAUPTMENUE angegeben, nicht nur der letzte Punkt."],
  [37, 1, "INSIGHT", "Wiederkehrende Meldung 12", "Kehrt Meldung 12 nach dem Magnetentausch zurück, ist in der Regel das Kabel zum Türzonenschalter gebrochen."],
  [38, 2, "FACT", "Barrierefreiheit Rufknöpfe", "Rufknöpfe sind in 900 bis 1100 mm Höhe anzubringen, taktil erkennbar und mit Kontrast zum Tableau."],
  [39, 3, "FACT", "Zendesk Ticketkategorien", "Tickets werden nach Störung, Wartung und Angebot kategorisiert; Angebote nicht als Störung anlegen."],
  [40, 0, "FACT", "Firmware-Update Ablauf", "Firmware-Updates werden per Speicherkarte eingespielt; vorher die Parameter unter HAUPTMENUE/Konfig/Sichern exportieren."],
  [41, 1, "FACT", "Meldung 19 Fahrzeitüberschreitung", "Meldung 19 bedeutet Fahrzeitüberschreitung; die Laufzeitüberwachung LSU prüft die Fahrzeit zwischen zwei Haltestellen."],
  [42, 2, "FACT", "Schachtbeleuchtung Abstand", "Schachtleuchten sitzen höchstens sieben Meter auseinander, mit je einer Leuchte am Kopf und an der Grube."],
  [43, 3, "INSIGHT", "Zwei Angebotsvarianten", "Kunden wählen schneller, wenn ein Angebot zwei Varianten enthält: Dichtungssatz allein und Satz mit Kolbenring."],
  [44, 0, "FACT", "KS-2XT Anzahl Haltestellen", "Die KS-2XT verwaltet bis zu 32 Haltestellen; darüber ist die KS-3 einzusetzen."],
  [45, 1, "FACT", "Meldung 44 Bremse", "Meldung 44 zeigt eine nicht öffnende Bremse; zuerst den Bremsgleichrichter messen."],
  [46, 2, "FACT", "Prüfung nach Ölwechsel", "Nach einem Ölwechsel an Hydraulikanlagen ist eine Probefahrt mit Prüflast vorgeschrieben."],
  [47, 3, "FACT", "Ersatzteilkatalog Stand", "Der Ersatzteilkatalog gilt in der Fassung vom März; ältere Artikelnummern mit der Umschlüsselungsliste prüfen."],
  [48, 0, "FACT", "Zeitfenster Nachtabsenkung", "Die Nachtabsenkung der Fahrgeschwindigkeit wird unter HAUPTMENUE/Konfig/Zeiten eingestellt."],
  [49, 1, "INSIGHT", "Meldung 27 bei Lastmessung", "Meldung 27 ohne tatsächliche Überlast deutet auf eine verschobene Lastmessung; nach jedem Seiltausch neu kalibrieren."],
  [50, 2, "FACT", "Notruf Zweiwegesprechverbindung", "Der Notruf muss eine Zweiwegesprechverbindung zur ständig besetzten Stelle herstellen und sich selbst prüfen."],
  [51, 3, "PREFERENCE", "Erst Bestand, dann Angebot", "Vor einem Angebot wird der Lagerbestand geprüft; nur lieferbare Positionen anbieten."],
  [52, 0, "FACT", "Türparameter Öffnungszeit", "Die Türöffnungszeit wird unter HAUPTMENUE/Türen/Zeiten eingestellt; Standard sind vier Sekunden."],
  [53, 1, "FACT", "Meldung 70 Umrichter", "Meldung 70 kommt vom Umrichter; der Umrichter-Fehlercode steht im Fehlerspeicher als Zusatzwert."],
  [54, 2, "FACT", "Kennzeichnung Fahrkorb", "Im Fahrkorb sind Tragfähigkeit, Personenzahl und Anlagennummer dauerhaft anzubringen."],
  [55, 3, "INSIGHT", "Anfragen am Montagmorgen", "Die meisten Ersatzteilanfragen kommen am Montagmorgen; die Routine arbeitet sie bis Mittag ab."],
  [56, 0, "FACT", "Sprache der Anzeige", "Die Anzeigesprache wird unter HAUPTMENUE/Anzeige/Sprache gesetzt und gilt für alle Tableaus."],
  [57, 1, "FACT", "Meldung 03 Sicherheitskreis", "Meldung 03 zeigt einen offenen Sicherheitskreis; die Kontakte von der Grube aufwärts prüfen."],
  [58, 2, "FACT", "Prüfung Geschwindigkeitsbegrenzer", "Der Geschwindigkeitsbegrenzer wird bei jeder Hauptprüfung ausgelöst und sein Ansprechwert dokumentiert."],
  [59, 3, "FACT", "Rahmenvertrag Rabattstufen", "Rahmenvertragskunden erhalten die Rabattstufe aus dem Vertrag; die Routine liest sie aus dem Kundenstamm."],
];

const START_MS = Date.parse("2026-07-02T08:00:00.000Z");
const SPACING_MS = 20.5 * 3_600_000; // ~0.85 days apart: 60 entries over 51 days

export const MEMORY_EXAMPLES: Item[] = EXAMPLES.map(([day, topic, type, name, information], i) =>
  demoItem({
    id: `demo-memory-${String(i + 1).padStart(3, "0")}`,
    name,
    type,
    information,
    createdAt: new Date(START_MS + day * SPACING_MS).toISOString(),
    // Not a field the product reads; the map resolver uses it for clustering.
    topic: MEMORY_TOPICS[topic].id,
  } as Parameters<typeof demoItem>[0] & { topic: string }),
);

/** Deterministic jitter, so the cloud is the same on every build and every reload. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The topic a memory belongs to: its fixture tag, or the nearest by name for the four real ones. */
export function topicOf(item: Item & { topic?: string }): MemoryTopic {
  if (item.topic) return MEMORY_TOPICS.find((t) => t.id === item.topic) ?? MEMORY_TOPICS[0];
  const name = `${item.name ?? ""} ${(item as { information?: string }).information ?? ""}`;
  if (/Fehler|Meldung|Reset/.test(name)) return MEMORY_TOPICS[1];
  if (/Norm|Prüf|Ticket|Statistic|ELA/.test(name)) return MEMORY_TOPICS[2];
  if (/Kunde|Angebot|Zendesk/.test(name)) return MEMORY_TOPICS[3];
  return MEMORY_TOPICS[0];
}

/** One map point per memory, clustered around its topic's centre. */
export function memoryMapPoints(items: (Item & { topic?: string })[]) {
  return items.map((item, i) => {
    const centre = topicOf(item);
    const rnd = mulberry32(i * 7919 + 17);
    const jitter = () => (rnd() - 0.5) * 4.4;
    return {
      id: `${item.id}-p0`,
      itemId: item.id,
      x: centre.x + jitter(),
      y: centre.y + jitter(),
      z: centre.z + jitter(),
      itemName: item.name ?? "",
      group: (item as { type?: string }).type ?? null,
      chunks: 1,
      createdAtMs: item.createdAt ? Date.parse(item.createdAt) : null,
    };
  });
}
```

(If `demoItem` rejects an unknown `topic` key at the type level, spread it after the call: `{ ...demoItem({...}), topic }`. `Item` is loose; check `lib/demo/fixtures/item.ts`.)

`lib/demo/fixtures/chapter-memory.ts`:
- import `MEMORY_EXAMPLES` and add it to the base's items in `memoryWorld`: the array becomes `[correction?, ...EXISTING_MEMORIES, ...MEMORY_EXAMPLES]`, sorted by `createdAt` descending is not required (the list sorts).
- `export const MEMORY_COUNT_AFTER_CORRECTION = EXISTING_MEMORIES.length + MEMORY_EXAMPLES.length + 1;` (= 64)
- `export const MEMORY_CONTRIBUTORS = [{ id: 0, name: "Demo" }, { id: 11, name: "J. Brandt" }, { id: 12, name: "L. Hoffmann" }, { id: 13, name: "T. Krüger" }, { id: 14, name: "N. Weber" }];` — five invented contributors (initials, no real people), with a comment.

- [ ] **Step 3: The resolvers**

`lib/demo/resolvers.ts` — import `MEMORY_CONTRIBUTORS` and `MEMORY_EXAMPLES`-independent helpers `memoryMapPoints`, `MEMORY_TOPICS`, `topicOf` from `./fixtures/memory-examples`, and `checkMemoryBase` is already there. Add, next to the memory block:

```ts
  // --- /memory/[ctx]: the base page and its map (chapter 6, last step) -----
  MemoryBaseById: (_world, variables) => {
    const context = CONTEXTS.find((c) => c.id === variables.id) ?? CONTEXTS.find((c) => c.id === MEMORY_CONTEXT_ID)!;
    return {
      contextById: {
        id: context.id,
        name: context.name,
        description: context.description ?? null,
        fields: context.fields ?? [],
        configuration: context.configuration ?? null,
        memoryBase: checkMemoryBase({ fields: context.fields ?? [] }),
      },
    };
  },
  MemorySourceSession: (world, variables) => ({
    agent_sessionById: world.sessions.find((s) => s.id === variables.id) ?? world.sessions[0],
  }),
  MemorySourceMessages: () => ({ agent_messagesPagination: { items: [] } }),
  // The map: positions are fixture data (memory-examples.ts), one point per
  // memory, clustered around four topic centres; fitted, so the card draws.
  ContextProjectionStatus: (world, variables) => {
    const items = world.itemsByContext?.[String(variables.contextId)] ?? [];
    return {
      contextProjectionStatus: { fitted: true, fittedAt: "2026-08-27T06:00:00.000Z", residual: 0.12, mappedChunks: items.length, totalChunks: items.length },
    };
  },
  ContextMapTopics: (world, variables) => {
    const items = world.itemsByContext?.[String(variables.contextId)] ?? [];
    return {
      contextMapTopics: MEMORY_TOPICS.map((t) => ({ ...t, count: items.filter((i) => topicOf(i).id === t.id).length })),
    };
  },
  ContextMapPoints: (world, variables) => {
    const items = world.itemsByContext?.[String(variables.contextId)] ?? [];
    const points = memoryMapPoints(items);
    return { contextMapPoints: { points, total: points.length, sampled: false } };
  },
  ContextMapEdges: () => ({ contextMapEdges: [] }),
  ContextMapItem: (world, variables) => {
    const item = (world.itemsByContext?.[String(variables.contextId)] ?? []).find((i) => i.id === variables.itemId);
    return {
      contextMapItem: item
        ? { id: item.id, name: item.name, chunks: 1, textLength: ((item as { information?: string }).information ?? "").length, source: null, createdAt: item.createdAt ?? null, updatedAt: item.updatedAt ?? item.createdAt ?? null }
        : null,
    };
  },
```

(Match the exact field names of each document in `lib/graphql/operations/context-map.ts` — `points { id itemId x y z itemName group chunks createdAtMs }`, `total`, `sampled`; `fitted fittedAt residual mappedChunks totalChunks`; `id label count x y z`; `source target score`; `id name chunks textLength source createdAt updatedAt`.) Add `__typename`s only if the cache test asks.

`dynamicResolver`: add before the `Pagination` match:

```ts
  // The memory workbench's list: `<ctx>MemoriesPagination` → `<ctx>_itemsPagination`,
  // paged, newest first (the document's default sort).
  const memoriesMatch = /^([a-z0-9_]+)MemoriesPagination$/.exec(operationName);
  if (memoriesMatch && isContext(memoriesMatch[1])) {
    const ctx = memoriesMatch[1];
    return (world, variables) => {
      const all = [...(world.itemsByContext?.[ctx] ?? [])].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      const pageNo = Number(variables.page ?? 1);
      const limit = Number(variables.limit ?? 20);
      const items = all.slice((pageNo - 1) * limit, pageNo * limit).map((item) => ({
        rights_mode: "public", created_by: 0, description: null, source_session: null, updatedAt: item.createdAt ?? null,
        ...item,
      }));
      return { [`${ctx}_itemsPagination`]: { pageInfo: { ...page(all.length), currentPage: pageNo, pageCount: Math.ceil(all.length / limit) }, items } };
    };
  }
```
(check `page()`'s shape at `resolvers.ts:212` and keep its keys.)

`MemoryBases` (resolvers.ts ~795): `contributors: items.length ? MEMORY_CONTRIBUTORS.length : 0`; `MemoryBaseContributors: () => ({ memoryBaseContributors: MEMORY_CONTRIBUTORS })`.

- [ ] **Step 4: The card's anchor and the sweep**

`components/widgets/context-map/sweep.ts`:

```ts
import { DAY_MS, type TimeWindow } from "./map-data";

/**
 * The frames of a one-time sweep of the time window's end from the first day
 * to the last, then a clearing frame (null = whole span). Pure, so the plan
 * can be tested without a clock; the card plays it with setInterval.
 */
export function sweepFrames(bounds: TimeWindow, durationMs: number, stepMs: number): (TimeWindow | null)[] {
  if (durationMs <= 0 || stepMs <= 0 || bounds.to - bounds.from < DAY_MS) return [];
  const steps = Math.max(1, Math.round(durationMs / stepMs));
  const frames: (TimeWindow | null)[] = [];
  for (let i = 0; i <= steps; i++) {
    const to = bounds.from + Math.round(((bounds.to - bounds.from) * i) / steps);
    frames.push({ from: bounds.from, to });
  }
  frames.push(null);
  return frames;
}
```

`components/widgets/context-map/context-map-card.tsx`:
- prop `timelineAutoplayMs?: number` (doc: "Sweep the time window once from the first day to the last over this many ms when the data arrives; used by the guided demo. Skipped under prefers-reduced-motion."), destructured with the others.
- the card root (`:522-525`) gets `data-demo-id="memory-map"` (next to `data-testid`).
- after the `boundsKey` reset effect:

```tsx
  // A one-time sweep (guided demo): the window's end walks from the first day
  // to the last, so a viewer watches the base fill up without touching the
  // slider; then the window clears to the whole span.
  React.useEffect(() => {
    if (!timelineAutoplayMs || bounds === null || !drawn) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const frames = sweepFrames(bounds, timelineAutoplayMs, 80);
    if (frames.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      setTimeWindow(frames[i] ?? null);
      i += 1;
      if (i >= frames.length) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
    // boundsKey stands in for bounds; drawn gates on the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineAutoplayMs, boundsKey, drawn]);
```
(`drawn` is declared at `:468`, after this effect's position — move the effect below `drawn`'s declaration.)

`app/(application)/memory/[ctx]/components/base-shell.tsx`: import `isDemoMode` from `@/lib/demo/flag`; pass `timelineAutoplayMs={isDemoMode() ? 6000 : undefined}` on the `ContextMapCard`.

- [ ] **Step 5: The chapter**

`lib/demo/chapters/memory.ts`:
- `memory-base` paragraph (the computed count now reads "64"): `${capitalise(germanCount(MEMORY_COUNT_AFTER_CORRECTION))} Einträge, ein Assistent, ${germanCount(MEMORY_CONTRIBUTORS.length)} Beitragende — der jüngste ist deine Korrektur von eben; die meisten sind Beispieleinträge aus acht Wochen Servicealltag. Jeder Eintrag ist einsehbar, änderbar, löschbar.` (import `MEMORY_CONTRIBUTORS`).
- new last step:

```ts
    {
      id: "memory-map",
      route: `/memory/${MEMORY_CONTEXT_ID}`,
      anchor: "memory-map",
      scrollBlock: "start",
      title: "Ein Gedächtnis, das wächst",
      content: [
        {
          kind: "paragraph",
          text: "Jeder Punkt ist ein Eintrag, die Farben sind Themen. Der Zeitregler läuft einmal von selbst durch: Sieh zu, wie sich das Gedächtnis über acht Wochen füllt — aus Korrekturen, Hinweisen und Entscheidungen des Serviceteams. Die Einträge hier sind Beispieleinträge; die Mechanik ist die echte.",
        },
      ],
    },
```
(import `MEMORY_CONTEXT_ID`.)

`scripts/walk-demo.mjs`: `"memory.4": { attempts: [{ spec: { kind: "css", selector: '[data-demo-id="memory-map"] [role="tab"]' }, describe: "a tab of the base page — would switch the overview away from the map" }] }`; comments "36 steps" → "38 steps" (walker, `dump-demo-steps.ts`, `scenes.ts`, `chapters/index.test.ts`). In the walker's per-step settle, no change: the sweep alters no text.

- [ ] **Step 6: Gate and commit**

Run: `npx vitest run components/widgets/context-map lib/demo/resolvers.memory-map.test.ts lib/demo/resolvers.memory-bases.test.ts lib/demo/chapter-memory.test.ts lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/fixtures/pseudonyms.test.ts lib/demo/apollo-link.operations.test.ts && npx eslint --no-warn-ignored lib/demo/fixtures/memory-examples.ts lib/demo/fixtures/chapter-memory.ts lib/demo/resolvers.ts lib/demo/chapters/memory.ts components/widgets/context-map/sweep.ts components/widgets/context-map/sweep.test.ts components/widgets/context-map/context-map-card.tsx "app/(application)/memory/[ctx]/components/base-shell.tsx" lib/demo/resolvers.memory-map.test.ts scripts/walk-demo.mjs`
Expected: PASS. Then `npx vitest run` (full): PASS.

```bash
git add -A lib/demo components/widgets/context-map "app/(application)/memory/[ctx]/components/base-shell.tsx" scripts/walk-demo.mjs scripts/dump-demo-steps.ts
git commit -m "feat(demo): chapter 6 ends on the memory map, sixty example memories and a sweeping slider"
```

---

### Task 4: The closing scene carries the offer; the call to action on every step

**Files:**
- Modify: `lib/demo/content.ts` (`paths` kind + `contentText`), `components/demo/step-panel.tsx` (render), `scripts/export-demo-copy.ts` (rows), `app/globals.css` (`.demo-block-paths`), `lib/demo/content.test.ts`
- Modify: `lib/demo/scenes.ts` (`contact-close`), `lib/demo/chapters/contact.ts` (title, lead, cta label), `lib/demo/routes.ts` (`DEMO_BOOKING_URL`), `components/demo/tour-panel.tsx` (persistent link), `lib/demo/tour.test.ts` (closing tests: kinds, cta present), `lib/demo/panel-controls.test.ts` (unchanged), `docs/superpowers/specs/…` (the layout/label ruling)

**Interfaces:**
- Produces: `ContentBlock` member `{ kind: "paths"; items: { tag: string; price?: string; text: string }[] }`; `contentText` → `items.map((p) => [p.tag, p.price, p.text].filter(Boolean).join(" · ")).join(" | ")`; export rows `Weg`, `Weg-Preis`, `Weg-Text`; `DEMO_BOOKING_URL = "https://meetings-eu1.hubspot.com/dclaessen/kostenlose-erstberatung-open-imp"`; `DEMO_BOOKING_LABEL = "Kostenlose Erstberatung buchen"` (routes.ts).

- [ ] **Step 1: Write the failing tests**

Append to `lib/demo/content.test.ts`:

```ts
describe("paths block", () => {
  it("flattens each path's tag, price and text", () => {
    expect(contentText([{ kind: "paths", items: [{ tag: "Weg 1", price: "600 €", text: "Testen." }, { tag: "Weg 2", text: "Richtig." }] }] as ContentBlock[]))
      .toBe("Weg 1 · 600 € · Testen. | Weg 2 · Richtig.");
  });
});
```

In `lib/demo/tour.test.ts`, the closing-scene describe: the kinds become `["paragraph", "paths", "paragraph", "cta"]`; the URL-dependent tests flip (the URL is set now): `closingStep().cta?.href` equals `DEMO_BOOKING_URL` and the scene ends on a `cta` block; add:

```ts
  it("carries the offer as two paths, no customer name, and the booking link", () => {
    const text = closing();
    expect(text).toMatch(/3 Monate unverbindlich/);
    expect(text).toMatch(/600 €/);
    expect(text).toMatch(/20 % Aufschlag/);
    expect(text).toMatch(/zwei Arbeitstagen/);
    expect(text).not.toMatch(/NEW Lift|ALGI/);
    expect(closingStep().cta?.label).toBe("Kostenlose Erstberatung buchen");
  });
```

Run: `npx vitest run lib/demo/content.test.ts lib/demo/tour.test.ts` — Expected: FAIL.

- [ ] **Step 2: The block kind**

`lib/demo/content.ts`: add `| { kind: "paths"; items: { tag: string; price?: string; text: string }[] }` and the `contentText` case. `components/demo/step-panel.tsx`:

```tsx
    case "paths":
      return (
        <ul className="demo-block-paths">
          {block.items.map((p) => (
            <li key={p.tag} className="demo-path">
              <span className="demo-path-tag">{p.tag}</span>
              {p.price && <span className="demo-path-price">{p.price}</span>}
              <span className="demo-path-text">{p.text}</span>
            </li>
          ))}
        </ul>
      );
```
`scripts/export-demo-copy.ts`: `case "paths": return block.items.flatMap((p) => [{ feld: "Weg", text: p.tag }, ...(p.price ? [{ feld: "Weg-Preis", text: p.price }] : []), { feld: "Weg-Text", text: p.text }]);`

`app/globals.css`:

```css
/* The closing scene's two paths (sub-project 8): side by side, equal weight. */
.demo-block-paths { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
.demo-path { display: flex; flex-direction: column; gap: 0.4rem; padding: 1.25rem 1.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.75rem; background: hsl(var(--card)); }
.demo-path-tag { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: hsl(var(--primary)); }
.demo-path-price { font-size: 1.6rem; font-weight: 700; line-height: 1.1; }
.demo-path-text { color: hsl(var(--muted-foreground)); line-height: 1.5; }
.demo-scene .demo-path-price { font-size: 2rem; }
```

- [ ] **Step 3: The scene, the chapter, the URL, the panel link**

`lib/demo/routes.ts`: `export const DEMO_BOOKING_URL = "https://meetings-eu1.hubspot.com/dclaessen/kostenlose-erstberatung-open-imp";` and `export const DEMO_BOOKING_LABEL = "Kostenlose Erstberatung buchen";` (update the comment above: the URL exists now).

`lib/demo/chapters/contact.ts`: title `Erst ausprobieren oder gleich richtig?`; lead `Alles, was du gesehen hast, läuft auch mit euren Dokumenten — auf zwei Wegen, beide beginnen mit einem Gespräch.`; `cta: { label: DEMO_BOOKING_LABEL, href: DEMO_BOOKING_URL }` (the spread stays conditional on the URL).

`lib/demo/scenes.ts` `contact-close` content (replaces the logos block, the references paragraph, the stats and the ask):

```ts
      {
        kind: "paragraph",
        text: "Du entscheidest, wie schnell und wie tief. Beide Wege führen zu eurem IMP.",
      },
      {
        kind: "paths",
        items: [
          {
            tag: "Ausprobieren · 3 Monate unverbindlich",
            price: "600 € / Monat, −50 % · Setup in zwei Tagen",
            text: "Beliebig viele Dokumente, Transkripte und Besprechungsaufnahmen, ohne Systemanbindung. Variable Kosten mit 20 % Aufschlag.",
          },
          {
            tag: "Vollwertig · in drei Schritten",
            text: "Planungsgespräch → Anbindung an eure Systeme und Import eurer Daten → produktive Instanz innerhalb von zwei Arbeitstagen.",
          },
        ],
      },
      {
        kind: "paragraph",
        text: "Beide Wege beginnen mit einem Gespräch von 30 Minuten.",
      },
      ...(DEMO_BOOKING_URL ? [{ kind: "cta" as const, label: DEMO_BOOKING_LABEL, href: DEMO_BOOKING_URL }] : []),
```
(import `DEMO_BOOKING_LABEL`; the `logos` kind stays in code for later; the scene comment says the references return once the logo files and the decision exist.)

`components/demo/tour-panel.tsx` footer — add the persistent link last in DOM order, first visually:

```tsx
      <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
        {controls.includes("back") && (…unchanged…)}
        {controls.includes("cta") && step.cta && (…unchanged…)}
        {controls.includes("next") && (…unchanged…)}
        {/* The booking link on every step but the last (which has the button).
            Last in DOM so Tab reaches Weiter in the same three presses;
            first visually, at the far left (order-first + mr-auto). */}
        {DEMO_BOOKING_URL && !step.cta && (
          <a href={DEMO_BOOKING_URL} className="order-first mr-auto text-sm text-primary underline underline-offset-4" data-demo-id="tour-booking-link">
            {DEMO_BOOKING_LABEL}
          </a>
        )}
      </div>
```
(import both from `@/lib/demo/routes`.)

- [ ] **Step 4: Spec note, gate, commit**

Append to the spec's sub-project 8 section, point 5: "Decided 2026-10-15: layout A with variant B's texts; URL set; one button and the panel link both read "Kostenlose Erstberatung buchen"; no path highlighted."

Run: `npx vitest run lib/demo/content.test.ts lib/demo/tour.test.ts lib/demo/scenes.test.ts lib/demo/chapters/index.test.ts lib/demo/panel-controls.test.ts && npx eslint --no-warn-ignored lib/demo/content.ts components/demo/step-panel.tsx scripts/export-demo-copy.ts lib/demo/scenes.ts lib/demo/chapters/contact.ts lib/demo/routes.ts components/demo/tour-panel.tsx && npx tsx scripts/export-demo-copy.ts | grep -c "Weg"`
Expected: PASS; the export prints 5 Weg rows (2 tags, 1 price, 2 texts).

```bash
git add lib/demo/content.ts lib/demo/content.test.ts components/demo/step-panel.tsx scripts/export-demo-copy.ts app/globals.css lib/demo/scenes.ts lib/demo/chapters/contact.ts lib/demo/routes.ts components/demo/tour-panel.tsx lib/demo/tour.test.ts docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md
git commit -m "feat(demo): the closing scene carries the offer; the booking link sits on every step"
```

---

### Task 5: Verify on Daniel's build; the sign-off sheet

- [ ] **Step 1: Build**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 2: Walk** — `DEMO_BASE_URL=http://localhost:3111 node …/scripts/walk-demo.mjs`: **38/38**, `leaks=none`, 3 Tabs to Weiter.

- [ ] **Step 3: Spot checks (Playwright, scratch)**

- `memory.4`: the card is drawn (a `canvas` inside `[data-demo-id="memory-map"]`), the slider is present; sample the slider's second thumb's `aria-valuetext` every 500 ms for 8 s — it advances and ends at the last day; four legend/topic labels; the panel copy says Beispieleinträge. Screenshot.
- `memory.3`: the row reads 64 memories, 5 contributors.
- `email.2`: `[data-demo-id="routine-run-open"]` is visible with "Von", "Betreff", "Unterhaltung öffnen"; `email.3`: the first message (the inbound mail) is at the top of the viewport; `email.4`: the approval card.
- `meetings.0` / `kosten.0`: the new titles.
- `contact.0`: two path cards, the price line, the button with the HubSpot URL; on any other step the panel shows the booking link at the bottom left; `tabsToWeiter` stays 3.
- Console: zero errors on `/memory/newton_memory_context`.

- [ ] **Step 4: Record** — export `docs/superpowers/plans/2026-10-15-demo-tour-growth-copy.csv`; append `## Verification`; commit `docs(demo): record the growth walk and export the copy for sign-off`.

## Copy for sign-off

All new German strings are in Tasks 1–4 above (chapter 9's two steps, chapter 10's two, chapter 11's one, chapter 6's two, the closing scene's paths and lead, the booking label) plus the sixty example memories in `memory-examples.ts`. The CSV export after Task 5 is the sheet.

## Verification

2026-10-15 — Daniel's production demo builds; final 64ROZ6XBsyU-CNSPKKEGX of b3b4e03, `next start -p 3111`, Playwright at 1440×900.

- Walker in Weiter mode: **38/38**, zero leaks, 3 Tabs to Weiter (the persistent booking link sits after Weiter in DOM order). A run with three probes hitting the server at the same time had timed out on chapter 6; alone, the walk is clean.
- `memory.4`: the map draws (canvas), both slider thumbs present, the "to" thumb sweeps through 13 dates from 02.07.2026 to the correction's day; four topic labels; the panel says Beispieleinträge. `memory.3`: the row reads 64 memories, 5 contributors, saved "jetzt".
- `email.2`: the waiting run's row is expanded (Von, Betreff, "Unterhaltung öffnen"), in the Weiter flow too (the `?run=` param is followed on client-side navigation). `email.3`: the inbound mail is at the top of the conversation on a deep link (at 4 s) and in the Weiter flow (3.5 s); `email.4`: the approval card is in view.
- Chapter 5: the question is aligned above its answer after the stream for the first time — the SP2 helper had fired during the chat's own scroll animation and lost to it; it now waits for height and position to settle and verifies once.
- `meetings.0` "Besprechungen, die zu Wissen werden"; `kosten.0` "Mach die KI-Nutzung sichtbar".
- `contact.0`: two path cards, the button to the HubSpot page labelled "Kostenlose Erstberatung buchen", no customer name; on every other step the panel footer carries the same link.
- Console pass over the checked screens, `/memory/newton_memory_context` included: zero errors.
- Found on the builds and fixed: the run param read only at mount; the question alignment pushing the approval card away; the alignment firing mid-animation (pre-existing); the composer-anchored steps losing their alignment.
- Unit: full suite 143 files / 1,521 tests at a77d7bd plus the alignment tests (3) at b3b4e03.
- Sign-off sheet: `docs/superpowers/plans/2026-10-15-demo-tour-growth-copy.csv` (145 rows, 38 steps).

**Post-review** (b94e2a9): the fresh review found no critical and two important items, both fixed with a test that failed first — the map's `createdAtMs` was never date-shifted (numbers pass the link's shifter untouched), so the slider spanned the fixture's real July–August up to today, about fifteen weeks under copy that says eight; it is shifted at the source now and the test pins the window to nine weeks. And the alignment's verify ticks could fight a visitor who scrolls by scrollbar or keyboard; both now count as taking over. Six minors deferred (listed in the ledger and the closing message). Suite 144 files / 1,527 tests at b94e2a9. The shifted axis is a data change covered by the unit test; the next production build of `main` shows it on the slider.
