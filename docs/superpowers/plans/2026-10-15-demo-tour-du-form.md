# Demo Tour Du-Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch every string the demo tour owns to the du-register (du for the visitor, euer for the company), apply marketing's rewrites from the 6 October review with five factual corrections, and replace the Sie-form guard rails so the register cannot drift back.

**Architecture:** Copy lives in `lib/demo/chapters/*.ts` (titles, goals, steps) and `lib/demo/scenes.ts` (scene blocks); three overlay strings in `lib/demo/overlays.ts` and one notice in `components/demo/demo-unavailable.tsx` are the only product-side strings the demo owns. A small `lib/demo/register.ts` helper defines the Sie-form pattern once; a tour-wide test iterates every string through `contentOf` and the walker applies the same pattern to the panel's and the scenes' on-screen text. Real product data (chat answers, transcripts, run rows) and product UI strings are untouched.

**Tech Stack:** Next.js 16, vitest (node), Playwright outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — section "Sub-project 6 — Du-Form und Marketing-Feedback (2026-10-15)".

**Branch:** `fix/demo-tour-du-form` from `main` (f55b395); spec commit 633f4a0.

**Source of the wording:** `/Users/daniel.claessen/Downloads/OPEN-IMP-Demo-Texte.docx.md` (marketing's "Neuer Text" column). Every string below is the applied wording; the "Deviations from marketing" table at the end lists where and why the plan departs from the document.

## Global Constraints

- Register (spec): *du / dein / dir / dich* for the visitor as a person, lowercase; *euer / eure / euch* for the company and what belongs to it; imperatives "Sieh zu", "Öffne", "Schau". Never `Sie`, `Ihnen`, `Ihr(e/em/en/er)` in a tour string — including sentence-initial, so tour copy avoids a sentence-initial "Sie" meaning "they".
- Numbers a fixture determines stay computed (`germanCount`/`capitalise` from `lib/demo/fixtures/meeting-tally.ts`, `MEMORY_COUNT_AFTER_CORRECTION`, `ALGI_MEETING_TALLY`); never typed.
- The honesty register in `lib/demo/tour.test.ts` stays satisfied: "Beispielwerte" and "keine Einsparung" in chapter 11, "beispielhaft" in chapter 8, "von Hand" in chapter 10, no claim phrasing, client names only in chapter 12 (`chapters/index.test.ts`).
- Chapter goals: one sentence, ≤ 14 words, ends with "." (`chapters/index.test.ts`); the first step's prose ≤ 32 words (`tour.test.ts`).
- Cross-references stay as they are: chapter 5 (techdoc), 6 (memory), 7 (config) — the order is unchanged.
- Daniel runs the production build (`NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build` / `… npx next start -p 3111`); the executor walks. Per-task gate: `npx vitest run <files>` + `npx eslint --no-warn-ignored <files>`. Commit per task (several commits inside Task 2 are fine); commitlint: lowercase subject, ≤ 100 chars; never push.
- Edits to the copy files are made with a node patch script that matches each current string exactly once (the SP3–SP5 lesson: no perl, no first-match helpers).

## Review Focus

1. A sentence-initial "Sie" meaning "they" would be flagged as Sie-form — Task 1's helper test pins the strictness, and Task 2's copy contains none (10.1's "Sie alle finden…" from marketing was not adopted).
2. "Sieben"/"Siebzehn"/"sieht" must not match the Sie pattern — Task 1's test covers "Sieben Basen" and "sieht dabei zu".
3. The walker's new check must read only the panel and the scenes, never `main` (the product UI is Sie-form) — Task 3 scopes it to `[data-demo-id="tour-panel"]` and `.demo-scene`; Task 4 verifies 38/38 on the build.
4. The closing scene and `contact.0` share the references paragraph — Task 2 changes both places to the same string and `tour.test.ts`'s closing test reads the scene.
5. Removing `MEMORY_OVERVIEW` must restore the product's own du-form description on `/memory` — Task 3 removes the overlay, its test and the component branch; Task 4 reads the header on the build.

---

### Task 1: The register helper

**Files:**
- Create: `lib/demo/register.ts`, `lib/demo/register.test.ts`

**Interfaces:**
- Produces: `SIE_FORM: RegExp` (case-sensitive, `\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer)\b`), `sieFormIn(text: string): string | null` (the first offending token or null).

- [ ] **Step 1: Write the failing test**

`lib/demo/register.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { sieFormIn } from "./register";

describe("sieFormIn", () => {
  it("names the Sie-form token in a sentence", () => {
    expect(sieFormIn("Sehen Sie zu, wie der Assistent sucht.")).toBe("Sie");
    expect(sieFormIn("Dort landete eben Ihre Korrektur.")).toBe("Ihre");
    expect(sieFormIn("Wie es bei Ihnen weitergeht.")).toBe("Ihnen");
    expect(sieFormIn("Zehn Ihrer Handbücher")).toBe("Ihrer");
  });

  it("is strict about a sentence-initial Sie, which tour copy avoids", () => {
    expect(sieFormIn("Sie alle finden hier ihren Platz.")).toBe("Sie");
  });

  it("passes du-form, lowercase sie and words that merely start with Sie", () => {
    expect(sieFormIn("Sieh zu, wie der Assistent sucht.")).toBeNull();
    expect(sieFormIn("Das Dokument, aus dem sie stammt.")).toBeNull();
    expect(sieFormIn("Sieben Basen, sieben Lesarten")).toBeNull();
    expect(sieFormIn("Niemand sieht dabei zu.")).toBeNull();
    expect(sieFormIn("deine Korrektur, euer Posteingang, für euch")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/demo/register.test.ts`
Expected: FAIL — `./register` not found.

- [ ] **Step 3: The helper**

`lib/demo/register.ts`:

```ts
/**
 * The tour's register is du (spec, sub-project 6): du/dein for the visitor,
 * euer/eure for the company. This is the one place the Sie-form pattern is
 * written; chapters/index.test.ts runs it over every tour string and
 * scripts/walk-demo.mjs over the panel's and the scenes' on-screen text.
 *
 * Case-sensitive and deliberately strict: a sentence-initial "Sie" could mean
 * "they", so tour copy phrases around it rather than the check allowing it.
 * Lowercase "sie" (she/they), "Sieben", "sieht" do not match.
 */
export const SIE_FORM = /\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer)\b/;

/** The first Sie-form token in `text`, or null when the text is du-form. */
export function sieFormIn(text: string): string | null {
  const match = SIE_FORM.exec(text);
  return match ? match[1] : null;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run lib/demo/register.test.ts && npx eslint --no-warn-ignored lib/demo/register.ts lib/demo/register.test.ts`
Expected: PASS, eslint clean.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/register.ts lib/demo/register.test.ts
git commit -m "feat(demo): the tour's register helper, du-form with a strict sie check"
```

---

### Task 2: The tour copy in du-form, with marketing's rewrites

**Files:**
- Modify: `lib/demo/chapters/{daten,struktur,aufnahme,zugriff,techdoc,memory,config,evals,email,meetings,kosten,contact}.ts`, `lib/demo/scenes.ts`
- Modify: `lib/demo/chapters/index.test.ts` (new test + comment at :119), `lib/demo/tour.test.ts:397`, `lib/demo/panel-rail.test.ts:13`

**Interfaces:**
- Consumes: `sieFormIn` (Task 1), `contentOf` (`lib/demo/step-content.ts`), `ContentBlock` kinds (`lib/demo/content.ts`: paragraph.text, bullets.items, callout.text, stat.value/label, figure.alt, sequence.steps, cta.label).

- [ ] **Step 1: Write the failing test**

Append to `lib/demo/chapters/index.test.ts` (import `sieFormIn` from `"../register"` and `contentOf` from `"../step-content"` if not already imported):

```ts
describe("the register is du (sub-project 6)", () => {
  // Every string the tour owns, by field, so a failure names the place.
  const strings = (): { where: string; text: string }[] => {
    const out: { where: string; text: string }[] = [];
    for (const chapter of CHAPTERS) {
      out.push({ where: `${chapter.id} title`, text: chapter.title });
      out.push({ where: `${chapter.id} goal`, text: chapter.goal });
      for (const step of chapter.steps) {
        out.push({ where: `${step.id} title`, text: step.title });
        if (step.lead) out.push({ where: `${step.id} lead`, text: step.lead });
        if (step.cta) out.push({ where: `${step.id} cta`, text: step.cta.label });
        contentOf(step).forEach((block, i) => {
          const at = `${step.id} block ${i} (${block.kind})`;
          switch (block.kind) {
            case "paragraph":
            case "callout":
              out.push({ where: at, text: block.text });
              break;
            case "bullets":
              block.items.forEach((t) => out.push({ where: at, text: t }));
              break;
            case "sequence":
              block.steps.forEach((t) => out.push({ where: at, text: t }));
              break;
            case "stat":
              out.push({ where: at, text: `${block.value} ${block.label}` });
              break;
            case "figure":
              if (block.alt) out.push({ where: at, text: block.alt });
              break;
            case "cta":
              out.push({ where: at, text: block.label });
              break;
          }
        });
      }
    }
    return out;
  };

  it("has no Sie-form in any title, goal, lead, block or button", () => {
    const offenders = strings()
      .map((s) => ({ ...s, token: sieFormIn(s.text) }))
      .filter((s) => s.token);
    expect(offenders.map((s) => `${s.where}: "${s.token}"`)).toEqual([]);
  });
});
```

Change the comment at `lib/demo/chapters/index.test.ts:119` from "One line, Sie-form, a full sentence" to "One line, du-form, a full sentence".

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/demo/chapters/index.test.ts`
Expected: FAIL — a list of roughly thirty offenders ("daten title: Ihr" … "contact-close block 4: Ihrer").

- [ ] **Step 3: Chapters 1–6**

Apply with a node patch script matching each current string exactly once (`node "$TMPDIR/patch-copy-a.mjs"`); every `from` is the current text as exported by `scripts/export-demo-copy.ts`, every `to` is below. Fields not listed keep their wording.

**daten.ts**
| Field | New text |
|---|---|
| chapter title | Eure Daten |
| chapter goal | Wo euer Wissen heute liegt, und warum eine KI damit nichts anfangen kann. |
| daten-pile title | Das Wissen ist längst da… |
| daten-problem title | …nur findet niemand die Antworten schnell genug |

**scenes.ts — `daten-pile`**
| Field | New text |
|---|---|
| stat label | Dokumente in einem typischen technischen Unternehmen |
| paragraph | Handbücher, Datenblätter, Schaltpläne, E-Mails, Support-Tickets, Besprechungsaufzeichnungen, in den Köpfen eurer Mitarbeiter — hier stecken die Antworten auf fast jede technische Frage. |

**scenes.ts — `daten-problem`**
| Field | New text |
|---|---|
| bullet 1 | Niemand weiß, welches Dokument das richtige ist |
| bullet 2 | Niemand weiß, welche Fassung die gültige ist |
| bullet 3 | Die, die die Antworten kennen, sind in absehbarer Zeit in Rente |
| paragraph | KI kann hier die Lösung sein. Aber ein Sprachmodell ohne Zugriff auf diese Unterlagen erfindet Antworten. Und ein Sprachmodell mit ungeordnetem Zugriff findet die falsche Fassung. Beides ist schlimmer als keine Antwort. |
| callout | Die nächsten Kapitel zeigen, was dazwischen liegt — und dass es Konfiguration ist, kein leeres Versprechen. |

**struktur.ts**
| Field | New text |
|---|---|
| struktur-empty paragraph | Damit ein Assistent etwas nachschlagen kann, darf es nicht irgendwo liegen. Es muss nach Art des Wissens getrennt werden und darf nicht in einem einzigen Topf landen. |
| struktur-full paragraph | Diese sieben Wissensbasen laufen in der hier gezeigten Umgebung. Die Anzahl ist nicht begrenzt, und welche ein Assistent durchsuchen darf, ist eine Einstellung pro Assistent, wie wir in Kapitel 7 zeigen. |

**aufnahme.ts**
| Field | New text |
|---|---|
| aufnahme-empty title | Kein Hochladen von Hand nötig |
| aufnahme-running paragraph | Jede Datei durchläuft dieselbe Strecke. Bei tausenden Dokumenten dauert das Stunden und niemand sieht dabei zu. Hier ist es zu Anschauungszwecken beschleunigt. |
| aufnahme-items paragraph | Aus jeder Datei sind Passagen geworden, jede mit ihrer Herkunft verknüpft. Das ist es, was die Suche, die wir später in Kapitel 5 genauer zeigen, tatsächlich durchsucht — und warum jede Aussage dort eine Quelle nennen kann. |

**zugriff.ts**
| Field | New text |
|---|---|
| chapter title | Berechtigungen und Zugriff |

**scenes.ts — `zugriff-consequence`**
| Field | New text |
|---|---|
| callout | Ein KI-Assistent kann nur nennen, was der Fragende lesen darf. Das ist keine Zusicherung im Systemprompt, sondern eine Prüfung der Nutzer-Berechtigung bei jedem Suchlauf. |
| paragraph | Derselbe Assistent beantwortet die Frage eines Technikers also anders als die eines externen Gasts — ohne dass jemand dafür einen zweiten KI-Assistenten bauen muss. |

**techdoc.ts**
| Field | New text |
|---|---|
| chapter title | Beispiel: Eine schwierige Frage |
| chapter goal | Eine echte Technikerfrage, beantwortet und mit Quellen belegt. |
| techdoc-ask paragraph | Ein Servicetechniker fragt nach einem Fehlerbild. Sieh zu, wie der Assistent sucht und antwortet — ein echter Austausch, so wie er stattfand. |
| techdoc-retrieval title | Die Suche, transparent gezeigt |
| techdoc-answer title | Jede Aussage mit Quelle belegt |
| techdoc-answer paragraph | Die Antwort belegt jede Aussage mit dem Dokument, aus dem sie stammt. Öffne diese Quelle und schau dir die Informationen selbst an. |

**memory.ts**
| Field | New text |
|---|---|
| chapter title | Ein Assistent, der mitlernt |
| memory-miss paragraph | Ein Techniker fragt nach einem exakten Menüpfad. Der KI-Assistent nennt, was die Dokumente hergeben, belegt es, und erfindet nichts dazu. |
| memory-correct title | Fehler gefunden, der Techniker korrigiert |
| memory-correct paragraph | In diesem Beispiel hat der KI-Assistent den genauen Menüpfad nicht gefunden, nur die Stelle im Handbuch. Der Techniker schickt den richtigen Pfad zurück. Schau, was der KI-Assistent daraus macht. |
| memory-write paragraph | Das Merken ist ein sichtbarer Schritt, kein verborgener Nebeneffekt. Du siehst genau, was gespeichert wurde. |
| memory-base title | Ein Gedächtnis, das dir gehört |
| memory-base paragraph (template literal; the count stays computed) | `${capitalise(germanCount(MEMORY_COUNT_AFTER_CORRECTION))} Einträge, ein Assistent, ein Beitragender — der jüngste ist deine Korrektur von eben. Jeder Eintrag ist einsehbar, änderbar, löschbar; ab sofort bekommen alle Kollegen die richtige Antwort.` |

Also update `lib/demo/panel-rail.test.ts:13`: `title: "Korrigieren"` → `title: "Ein Assistent, der mitlernt"`.

Run: `npx vitest run lib/demo/chapters/index.test.ts lib/demo/tour.test.ts lib/demo/scenes.test.ts lib/demo/panel-rail.test.ts lib/demo/resolvers.memory-bases.test.ts`
Expected: the register test still FAILS, now listing only chapters 7–12 offenders; everything else PASS.

Commit: `git add lib/demo/chapters lib/demo/scenes.ts lib/demo/panel-rail.test.ts && git commit -m "feat(demo): chapters 1-6 in du-form with marketing's rewrites"`

- [ ] **Step 4: Chapters 7–12 and the closing scene**

**config.ts**
| Field | New text |
|---|---|
| chapter goal | Der Assistent ist Konfiguration, die euer eigenes Team bedient. |
| config-overview title | Der ganze KI-Assistent ist Konfiguration |
| config-overview paragraph | Kein Feintuning, kein Code. Wissensbasen, Routing-Regeln, Gedächtnis an, und das alles in einem Editor, den euer Team selbst bedienen kann. |
| config-sources title | Drei verschiedene Lesarten |
| config-sources paragraph | Handbücher werden wie Dokumente gelesen, Support-Tickets wie Gespräche, die Servicedatenbank wie Datensätze. Jede Basis trägt einen Satz, wann der KI-Assistent dort nachschlägt. Die letzte ist sein eigenes Gedächtnis, dort landete deine Korrektur. |
| config-routing title | Routing-Regeln in ganzen Sätzen |
| config-routing paragraph | Fünf Regeln entscheiden, wo eine Frage zuerst landet und wohin sie gegebenenfalls ausweicht. Geschrieben als ganze Sätze und nicht als Code: Ein Fachexperte kann sie ohne Entwickler ändern. |
| config-vocabulary title | Der KI-Assistent lernt eure Sprache |
| config-vocabulary paragraph | In unserem Beispiel sind hier 55 Abkürzungen aus der Aufzugstechnik hinterlegt, wie ADM, SHK, UCM. Dazu kommen Produktnamen und Normen. Deshalb findet eine Frage zum SHK die richtigen Seiten, egal wie sie formuliert ist. |
| config-behavior title | Und wie gründlich er suchen soll |
| config-behavior paragraph | Wie viele Suchdurchläufe, wie viele Treffer, wann er aufgibt und ehrlich passt — hier findest du die Einstellung hinter der Absage aus Kapitel 6. |

**evals.ts**
| Field | New text |
|---|---|
| evals-suites paragraph | Eine gute Antwort kann jeder zeigen. Die Frage ist, was mit allen anderen passiert. Wir zeigen dir hier zwei Testreihen: eine für die technische Dokumentation, eine für Fragen, die aus Normen beantwortet werden müssen. |
| evals-matrix paragraph | Zeilen sind echte Technikerfragen, Spalten sind Läufe. Fällt eine Antwort unter die Schwelle, wird die Zelle rot. Eine Änderung, die eine Frage verbessert und eine andere verschlechtert, bleibt sichtbar. Die Werte hier sind beispielhaft. |
| evals-sources paragraph | Ein Testfall kann neben der richtigen Antwort die richtige Quelle verlangen: eine Normfrage muss in diesem Beispiel aus EN und DIN beantwortet werden, nicht aus einem Produkthandbuch. Richtig klingen und richtig sein werden getrennt bewertet. |

**email.ts**
| Field | New text |
|---|---|
| chapter title | Arbeitet, während du schläfst |
| email-routine title | Gleiches Produkt, anderer Einsatzzweck |
| email-routine paragraph | Ein weiteres Anwendungsbeispiel für OPEN IMP: Bei einem Hersteller hydraulischer Aufzugssysteme beantwortet der KI-Assistent keine Fragen im Chat — er bearbeitet eingehende Ersatzteilanfragen selbstständig per E-Mail. |
| email-trigger title | Euer Posteingang ist der Auslöser |
| email-trigger paragraph | Eine Routine können nur Absender der eigenen Domain starten: 60 pro Stunde, 10 je Absender. Und dafür ist keine Integration nötig, eine Weiterleitung reicht und den Rest übernimmt die Routine für euch. |
| email-runs title | Auch schiefgegangene Läufe bleiben sichtbar |
| email-runs paragraph | In diesem Beispiel gibt es 25 Läufe: 14 erledigt, 8 fehlgeschlagen, einer wartet auf einen Menschen, zwei wurden abgewiesen. Ein Verkäufer korrigiert die Entwürfe, und jede Korrektur wandert sofort ins Gedächtnis. |

**meetings.ts**
| Field | New text |
|---|---|
| meetings-list title (template literal) | `${capitalise(germanCount(T.hours))} Stunden Aufzeichnungen, die niemand nachhören wird` |
| meetings-guide title | Hier wird ein lesbares Dokument daraus |

**kosten.ts**
| Field | New text |
|---|---|
| kosten-verbrauch paragraph | Verbrauch wird laufend erfasst — pro Team, Nutzer und Assistent. Du siehst, wofür ausgegeben wurde, nicht nur wie viel. |
| kosten-entscheidung paragraph | Wer wie viel ausgeben darf, entscheidet ihr. Wir behaupten hier keine Einsparung — was die Einführung wert ist, hängt von euren Zahlen ab, nicht von unseren. |

**contact.ts**
| Field | New text |
|---|---|
| chapter title | Sprich mit uns |
| chapter goal | Wer damit arbeitet, und wie es bei euch weitergeht. |
| contact-references title | Wer jetzt schon mit OPEN IMP arbeitet |
| contact-references paragraph | Die Unternehmen NEW Lift Steuerungsbau (technische Dokumentation und Service) und ALGI Hydraulic (Angebots- und Ersatzteilprozesse) arbeiten bereits jetzt produktiv mit OPEN IMP. Alles, was du eben gesehen hast, ist daraus abgeleitet — aus Datenschutzgründen verallgemeinert, aber realistisch. |
| contact-close title | Eine Demo mit euren eigenen Dokumenten |

**scenes.ts — `contact-close`**
| Field | New text |
|---|---|
| references paragraph | (the same string as contact-references above) |
| stat 1 | 10 / eurer Handbücher |
| stat 2 | 2 Wochen / Setup-Zeit |
| stat 3 | 30 Minuten / reichen für die Planung |
| ask paragraph | Zehn eurer Handbücher, zwei Wochen Setup-Zeit, echte Fragen eures Serviceteams — genau auf der Plattform, die du gerade gesehen hast. 30 Minuten reichen für die Planung völlig aus. |

Also `lib/demo/tour.test.ts:397`: `/Zehn Ihrer Handbücher/i` → `/Zehn eurer Handbücher/i`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/demo/chapters/index.test.ts lib/demo/tour.test.ts lib/demo/scenes.test.ts lib/demo/panel-rail.test.ts lib/demo/resolvers.memory-bases.test.ts lib/demo/resolvers.approval.test.ts lib/demo/resolvers.models.test.ts && npx eslint --no-warn-ignored lib/demo/chapters lib/demo/scenes.ts lib/demo/chapters/index.test.ts lib/demo/tour.test.ts lib/demo/panel-rail.test.ts`
Expected: all PASS — the register test's offender list is empty; the kosten register (Beispielwerte, keine Einsparung) and the client-name rule hold.

- [ ] **Step 6: Commit**

```bash
git add lib/demo/chapters lib/demo/scenes.ts lib/demo/tour.test.ts
git commit -m "feat(demo): chapters 7-12 and the closing scene in du-form with marketing's rewrites"
```

---

### Task 3: Overlays, the notice, the walker's rule

**Files:**
- Modify: `lib/demo/overlays.ts` (two strings, `MEMORY_OVERVIEW` removed, doc comments), `lib/demo/overlays.test.ts`
- Modify: `app/(application)/memory/components/memory-overview.tsx` (revert to `t("description")`, drop the two imports)
- Modify: `components/demo/demo-unavailable.tsx:34`, `components/demo/chat-question-into-view.tsx:16` (comment)
- Modify: `scripts/walk-demo.mjs` (LEAKS du-form regex removed; Sie check over the panel and the scenes)

- [ ] **Step 1: Write the failing tests**

In `lib/demo/overlays.test.ts`: delete the `describe("MEMORY_OVERVIEW")` block and its import; replace the `sie` helper and the two Sie-form assertions (`:49`, `:58`, `:70-72`) with du-form ones:

```ts
import { sieFormIn } from "./register";
// …
const duForm = (s: string) => sieFormIn(s) === null;
// in "are Sie-form, non-empty, …" → rename to "are du-form, non-empty, and end empty-state descriptions with a sentence" and assert duForm(...) for every title/description;
// in "is a German, Sie-form phrase ending in an ellipsis" → rename to "is a German, du-form phrase ending in an ellipsis" and assert expect(sieFormIn(SEARCHING_LABEL)).toBeNull();
```

Add:

```ts
describe("the overlay strings the tour owns", () => {
  it("address the company as euer, never Sie", () => {
    expect(KNOWLEDGE_LIBRARY.description).toMatch(/\beure\b/);
    expect(EMPTY_STATES.knowledgeItems.description).toMatch(/\beuren\b/);
    for (const text of [KNOWLEDGE_LIBRARY.description, EMPTY_STATES.knowledgeItems.description]) {
      expect(sieFormIn(text)).toBeNull();
    }
  });
});
```

Run: `npx vitest run lib/demo/overlays.test.ts`
Expected: FAIL — "Ihre"/"Ihren" found; `MEMORY_OVERVIEW` import gone compiles only after Step 2.

- [ ] **Step 2: The strings**

`lib/demo/overlays.ts`:
- `KNOWLEDGE_LIBRARY.description`: `Die Wissensbasen, aus denen eure Assistenten antworten.`
- `EMPTY_STATES.knowledgeItems.description`: `Dokumente kommen aus euren Ablagen — per Freigabe, Laufwerk oder Anbindung. Im nächsten Schritt läuft die Aufnahme.`
- Delete `MEMORY_OVERVIEW` and its doc comment (the product string is du-form already). Move KNOWLEDGE_LIBRARY's doc comment back above KNOWLEDGE_LIBRARY (the SP5 deferred minor).
- Line 13 doc comment: "Every string is Sie-form" → "Every string is du-form (spec, sub-project 6)".

`app/(application)/memory/components/memory-overview.tsx`: `<PageHeader title={t("title")} description={t("description")} />`; remove the `isDemoMode` and `MEMORY_OVERVIEW` imports.

`components/demo/demo-unavailable.tsx:34`: `… In eurer eigenen Umgebung steht sie vollständig zur Verfügung.`

`components/demo/chat-question-into-view.tsx:16`: update the quoted sentence in the comment to the new 5.1 wording.

- [ ] **Step 3: The walker**

`scripts/walk-demo.mjs`: in `LEAKS`, delete the line `/\b(deinem|deinen|deiner|deine|dein)\b/,`. Where the row's leaks are computed from `main` text, add a second check over the tour's own text only:

```js
    // The product UI is Sie-form and stays so; the tour's own text (panel and
    // scenes) is du-form (spec, sub-project 6) — same pattern as
    // lib/demo/register.ts.
    const SIE_FORM = /\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer)\b/;
    const ownText = await page.evaluate(() =>
      [document.querySelector('[data-demo-id="tour-panel"]'), document.querySelector(".demo-scene")]
        .map((n) => n?.innerText ?? "").join(" "));
    const sie = SIE_FORM.exec(ownText);
    if (sie) row.leaks.push(`Sie-form: ${sie[1]}`);
```

(`row.leaks` is the array the LEAKS loop fills; place this right after that loop so `allPass` still sees it.)

Update the comment at the top of the LEAKS list if it mentions the du-form rule.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/demo/overlays.test.ts lib/demo/chapters/index.test.ts lib/demo/resolvers.memory-bases.test.ts && npx eslint --no-warn-ignored lib/demo/overlays.ts lib/demo/overlays.test.ts "app/(application)/memory/components/memory-overview.tsx" components/demo/demo-unavailable.tsx components/demo/chat-question-into-view.tsx scripts/walk-demo.mjs && node --check scripts/walk-demo.mjs`
Expected: PASS, eslint clean. Then `npx vitest run` (full suite): all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/overlays.ts lib/demo/overlays.test.ts "app/(application)/memory/components/memory-overview.tsx" components/demo/demo-unavailable.tsx components/demo/chat-question-into-view.tsx scripts/walk-demo.mjs
git commit -m "feat(demo): overlay strings and the notice in du-form; the walker checks the panel for sie-form"
```

---

### Task 4: Verify on Daniel's build; the sign-off sheet

**Files:**
- Create: `docs/superpowers/plans/2026-10-15-demo-tour-du-form-copy.csv` (the export, the sign-off sheet for Daniel, Doro and marketing)
- Modify: this plan (Verification)

- [ ] **Step 1: Ask Daniel to build and serve**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 2: Walk it**

`DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs` — expected **38/38**, `leaks=none` on every row (the Sie check included), 3 Tabs to Weiter.

- [ ] **Step 3: Spot checks (Playwright, scratch directory)**

- Panel header on `zugriff.0`, `techdoc.0`, `memory.0`: the longer chapter titles ("Berechtigungen und Zugriff", "Beispiel: Eine schwierige Frage", "Ein Assistent, der mitlernt") fit the header line or wrap cleanly; the chapter rail's current segment still reads correctly in the "Alle Kapitel" menu.
- `memory.3`: the page header reads "Was deine Agenten in Gesprächen gelernt haben." (the product's own string, the overlay gone).
- `contact.1`: the three stats read 10 / eurer Handbücher · 2 Wochen / Setup-Zeit · 30 Minuten / reichen für die Planung; the references paragraph names "bereits jetzt".
- `struktur.0`: the empty state's description reads "aus euren Ablagen"; `/data`'s header reads "eure Assistenten".
- A page outside the tour (e.g. `/users`): the notice reads "In eurer eigenen Umgebung".

- [ ] **Step 4: The sign-off sheet and the record**

`npx tsx scripts/export-demo-copy.ts > docs/superpowers/plans/2026-10-15-demo-tour-du-form-copy.csv`. Append `## Verification` to this plan. Commit:

```bash
git add docs/superpowers/plans/2026-10-15-demo-tour-du-form.md docs/superpowers/plans/2026-10-15-demo-tour-du-form-copy.csv
git commit -m "docs(demo): record the du-form walk and export the copy for sign-off"
```

## Deviations from marketing's document

| Field | Marketing wrote | Applied | Why |
|---|---|---|---|
| 5.1 paragraph | "in Real-Geschwindigkeit" | "ein echter Austausch, so wie er stattfand" | The replay is paced (search beat, holds); neither "live" nor "Real-Geschwindigkeit" is true. |
| 6.2 paragraph | "hat … einen falschen Menüpfad genutzt" | "hat den genauen Menüpfad nicht gefunden, nur die Stelle im Handbuch" | The stored answer points to the manual's section; it is an honest miss, which 6.1 claims. |
| 7.5 title | "Er lernt, wie gründlich er sucht" | "Und wie gründlich er suchen soll" | It is a setting; the chapter's claim is "alles ist Konfiguration". |
| 9.3 title | "Auch schiefgegangene Routinen werden gespeichert" | "Auch schiefgegangene Läufe bleiben sichtbar" | They are runs, and the point is that failures are shown. |
| 4.2 paragraph | "ohne, dass" | "ohne dass" | Comma error. |
| 1.2 paragraph | "KI kann hier die Lösung sein - aber …" | "KI kann hier die Lösung sein. Aber …" | Hyphen as dash; marketing avoids dashes elsewhere. |
| 2.1 paragraph | "getrennt werden, und nicht in einem einzigen Topf landen" | "getrennt werden und darf nicht in einem einzigen Topf landen" | Grammar. |
| 7.3 paragraph | "nicht als Code, ein Fachexperte kann …" | "nicht als Code: Ein Fachexperte kann …" | Comma splice. |
| 7.1, 7.4, 9.2, 12.2 | "dein Team", "deine Sprache", "für dich", "deiner Handbücher / deines Serviceteams" | "euer Team", "eure Sprache", "für euch", "eurer Handbücher / eures Serviceteams" | Register rule: euer for the company (Daniel, 2026-10-15). |
| 10.1 | title without the count; paragraph "Manche mit Erkenntnissen, manche nicht. Sie alle finden hier ihren Platz." | computed count kept in the title ("Dreizehn Stunden Aufzeichnungen, …"); paragraph unchanged (computed counts, failed recordings) | The chapter's credibility device; marketing's paragraph also starts a sentence with "Sie". |
| 4.1, 6.4, 9.4, 11.2 | (pre-date the rewrite) | current copy, register switched | Steps changed in sub-project 5. |
| 10.2 | (comment: missing transcript) | step removed in sub-project 5 | — |
