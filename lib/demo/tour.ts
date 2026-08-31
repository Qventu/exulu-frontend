import { ALGI_ROUTINE_ID } from "./fixtures/chapter-email";
import { ALGI_MEETING_ID } from "./fixtures/chapter-meetings";
import { MEMORY_SESSION_ID } from "./fixtures/chapter-memory";
import { DEMO_AGENT_ID, TECHDOC_SESSION_ID } from "./fixtures/chapter-techdoc";

/**
 * The chat chapters run on the product's own route, not a demo-only one.
 *
 * They used to render at /demo/tour — a parallel page that existed only
 * because chapter 1 was built before fetchGraphQLServerSide learned to answer
 * from fixtures. That page carried a SECOND root layout, and it drifted from
 * the real one exactly as lib/graphql/server.ts warned it would: the theme
 * provider went missing from it once, and the OPEN favicon a second time.
 *
 * The session id in the path is what the resolvers key scrollback off, so each
 * chapter opens its own conversation without the route needing to know
 * anything about the tour.
 */
const TECHDOC_CHAT = `/chat/${DEMO_AGENT_ID}/${TECHDOC_SESSION_ID}`;
const MEMORY_CHAT = `/chat/${DEMO_AGENT_ID}/${MEMORY_SESSION_ID}`;

/**
 * The closing step's booking link — a HubSpot meetings URL.
 *
 * ==> THIS IS THE LAST THING TO SET BEFORE THE DEMO GOES LIVE. <==
 *
 * Empty until that link exists. The closing step reads the emptiness and drops
 * the invitation clause entirely rather than rendering a dead anchor or the
 * word "TO_BE_FILLED" at a prospect — so an unset link costs the tour its ask,
 * which is bad, instead of showing something broken, which is worse.
 *
 * tour.test.ts asserts that behaviour in both directions, so setting this is
 * the only change needed: the link appears, and the copy comes with it.
 */
export const DEMO_BOOKING_URL = "";

export type DemoChapterId =
  | "intro"
  | "techdoc"
  | "ingestion"
  | "config"
  | "memory"
  | "evals"
  | "email"
  | "meetings"
  | "contact";

export interface DemoStep {
  id: string;
  /** Route the shell navigates to for this step. */
  route: string;
  /** `data-demo-id` value to spotlight, or null for a full-screen step. */
  anchor: string | null;
  title: string;
  body: string;
  /**
   * Optional schematic, shown above the body. Path under /public.
   *
   * Only on chapter-opening steps: an illustration on every step would compete
   * with the product screen the tour is pointing at, which is the thing the
   * visitor is meant to be looking at.
   */
  image?: string;
  /**
   * Terminal call to action, rendered as the step's primary button.
   *
   * A button rather than a link in the body: the last step has no Next, so
   * without one the footer holds only "Back" and the tour ends by asking a
   * question the visitor cannot answer. Putting the ask where every other step
   * puts "Next" is what makes it the obvious thing to press.
   */
  cta?: { label: string; href: string };
  /**
   * Turns off the dimming overlay for this step.
   *
   * The overlay exists to point at one element, which is wrong for a step whose
   * subject is the whole screen changing. techdoc.0 anchors to the composer —
   * correct, that is where the question is typed — but the answer then streams
   * ABOVE it, and everything outside the composer's cutout was greyed out. The
   * step said "watch it search and answer" over a dimmed transcript.
   */
  noDim?: boolean;
  /**
   * How the anchor is scrolled into view. Default "nearest" (move the minimum,
   * never re-centre something already visible — centring the composer once
   * scrolled the whole page down). "start" for anchors that HEAD a long list:
   * nearest leaves the header at the bottom edge with the list below the fold,
   * and the step is about the list.
   */
  scrollBlock?: "start" | "nearest";
}

export interface DemoChapter {
  id: DemoChapterId;
  title: string;
  steps: DemoStep[];
}

export interface TourPosition {
  chapter: DemoChapterId;
  step: number;
}

export const CHAPTERS: DemoChapter[] = [
  // German throughout, per the change brief: the product content (questions,
  // answers, documents) was always German; the tour chrome and copy now match.
  // Sie-form — the audience is technical directors evaluating a purchase.
  // Newlift and ALGI are deliberately NOT named on the demo data; they appear
  // once, as case-study references, next to the closing ask (contact.0).
  {
    id: "intro",
    title: "Was das hier ist",
    steps: [
      {
        id: "intro-overview",
        route: TECHDOC_CHAT,
        anchor: null,
        // The drawing shows seven elevators and the copy says nine chapters —
        // known mismatch, the asset needs regenerating (no image tooling in
        // this environment). The previous copy said "Seven chapters" against a
        // "1 of 9" badge, which was worse: wrong on its own screen.
        image: "/demo/structure.webp",
        title: "Neun Kapitel, rund zwölf Minuten",
        body: "Eine laufende OPEN IMP Umgebung — echte Oberflächen, realistische Daten aus der Aufzugsbranche. Mit Weiter geht es Schritt für Schritt; über den Tour-Knopf unten rechts springen Sie frei zwischen den Kapiteln.",
      },
    ],
  },
  {
    id: "techdoc",
    title: "Eine schwierige Frage",
    steps: [
      {
        // No illustration: the popover flips up over the transcript here, and
        // an image made it tall enough to cover the answer the step says to
        // watch. The answer streams above the composer, so nothing is dimmed.
        id: "techdoc-ask",
        route: TECHDOC_CHAT,
        anchor: "chat-composer",
        noDim: true,
        title: "Eine Frage mit einer präzisen Antwort",
        body: "Ein Servicetechniker fragt nach einem Fehlerbild. Sehen Sie zu, wie der Assistent sucht und antwortet — live, keine Aufzeichnung.",
      },
      {
        // `chat-retrieval`, not `chat-tool-trace`: Context_Search renders its
        // own card, not the generic tool block.
        id: "techdoc-retrieval",
        route: TECHDOC_CHAT,
        anchor: "chat-retrieval",
        title: "Die Suche, offen gezeigt",
        body: "Der Assistent entscheidet selbst, welche Wissensbasen er durchsucht — und zeigt jeden Schritt.",
      },
      {
        // `chat-citation`, not `chat-sources`: this agent's citations travel
        // inline and render as badges; the source-URL block never mounts.
        id: "techdoc-answer",
        route: TECHDOC_CHAT,
        anchor: "chat-citation",
        title: "Jede Aussage mit Quelle",
        body: "Die Antwort belegt jede Aussage mit dem Dokument, aus dem sie stammt. Öffnen Sie eine Quelle und prüfen Sie selbst.",
      },
    ],
  },
  {
    id: "memory",
    title: "Korrigieren",
    steps: [
      {
        id: "memory-miss",
        image: "/demo/ch4-memory.webp",
        route: MEMORY_CHAT,
        anchor: "chat-messages",
        title: "Wenn er etwas nicht weiß, sagt er das",
        body: "Ein Techniker fragt nach einem exakten Menüpfad. Der Assistent nennt, was die Dokumente hergeben, belegt es — und erfindet nichts dazu.",
      },
      {
        id: "memory-correct",
        route: MEMORY_CHAT,
        anchor: "chat-composer",
        noDim: true,
        title: "Der Techniker korrigiert",
        body: "Der Techniker schickt den richtigen Menüpfad zurück. Sehen Sie, was der Assistent daraus macht.",
      },
      // MEMORY_WRITTEN_AT_STEP in fixtures/chapter-memory.ts is tied to this
      // index: the memory must not appear in the knowledge base before this.
      {
        id: "memory-write",
        route: MEMORY_CHAT,
        anchor: "chat-tool-trace",
        title: "Aus der Korrektur wird Gedächtnis",
        body: "Das Merken ist ein sichtbarer Werkzeugaufruf, kein verborgener Nebeneffekt. Sie sehen genau, was gespeichert wurde.",
      },
      {
        id: "memory-item",
        route: "/data/newton_memory_context",
        anchor: null,
        title: "Und ein Wissenseintrag, der Ihnen gehört",
        body: "Die Korrektur liegt jetzt als Eintrag in einer eigenen Wissensbasis — einsehbar, änderbar, löschbar. Ab sofort bekommen alle Kollegen die richtige Antwort.",
      },
    ],
  },
  {
    id: "ingestion",
    // Trimmed from four steps to two on review: the pipeline step highlighted
    // a screen of form fields and "stays current" highlighted nothing at all.
    // What survives of both lives in these two bodies.
    title: "Woher das Wissen kommt",
    steps: [
      {
        id: "ingestion-library",
        image: "/demo/ch2-ingestion.webp",
        route: "/data/software_documentation_context",
        anchor: "knowledge-items",
        title: "Niemand hat diese Dateien hochgeladen",
        body: "Neun Dokumente, direkt aus der Dateiablage des Herstellers — deutsche und englische Fassungen nebeneinander. Neue Revisionen erscheinen hier von selbst, und der Assistent wählt pro Frage die passende.",
      },
      {
        id: "ingestion-chunks",
        route:
          "/data/software_documentation_context/items/d92dd3f2-2803-41e4-8136-a1a0ccb99e6c?section=embeddings",
        anchor: "item-chunks",
        // "start": the anchor heads a 93-row list. "nearest" left the header at
        // the bottom edge and every chunk below the fold — the visible screen
        // was empty form fields under a step about the chunks.
        scrollBlock: "start",
        title: "Was die Suche wirklich durchsucht",
        body: "Das Handbuch, zerlegt in 93 einzeln durchsuchbare Passagen. Genau deshalb kann eine Antwort einen Absatz zitieren statt nur einen Dateinamen — eine davon haben Sie in Kapitel 2 geöffnet.",
      },
    ],
  },
  {
    id: "config",
    // Runs on the product's real agent editor; `?wizard=` is a genuine deep
    // link into the retrieval wizard, not demo scaffolding.
    title: "Anpassen ohne Code",
    steps: [
      {
        id: "config-overview",
        image: "/demo/ch3-config.webp",
        route: "/agents/edit/demo-agent-newton",
        anchor: "agent-agentic-retrieval",
        title: "Der ganze Assistent ist Konfiguration",
        body: "Kein Feintuning, kein Code. Sieben Wissensbasen, fünf Routing-Regeln, Gedächtnis an — alles in einem Editor, den Ihr eigenes Team bedienen kann.",
      },
      {
        // SEVEN because the screen says seven: the summary card reads
        // "7 knowledge bases", the seventh being the assistant's own memory.
        id: "config-sources",
        route: "/agents/edit/demo-agent-newton?wizard=sources",
        anchor: "agent-wizard-sources",
        title: "Sieben Wissensbasen, drei Lesarten",
        body: "Handbücher werden wie Dokumente gelesen, Support-Tickets wie Gespräche, die Servicedatenbank wie Datensätze. Jede Basis trägt einen Satz, wann der Assistent dort nachschlägt. Die siebte ist sein eigenes Gedächtnis — dort landete eben Ihre Korrektur.",
      },
      {
        id: "config-routing",
        route: "/agents/edit/demo-agent-newton?wizard=routing",
        anchor: "agent-wizard-routing",
        title: "Routing, in ganzen Sätzen",
        body: "Fünf Regeln entscheiden, wo eine Frage zuerst landet und wohin sie ausweicht. Geschrieben als Sätze, nicht als Code — ein Fachexperte ändert sie ohne Entwickler.",
      },
      {
        id: "config-vocabulary",
        route: "/agents/edit/demo-agent-newton?wizard=vocabulary",
        anchor: "agent-wizard-vocabulary",
        title: "Er lernt Ihre Sprache",
        body: "55 Abkürzungen aus der Aufzugstechnik — ADM, SHK, UCM — dazu Produktnamen und Normen. Deshalb findet eine Frage zum SHK die richtigen Seiten, egal wie sie formuliert ist.",
      },
      {
        id: "config-behavior",
        route: "/agents/edit/demo-agent-newton?wizard=behavior",
        anchor: "agent-wizard-behavior",
        title: "Und wie gründlich er sucht",
        body: "Wie viele Suchdurchläufe, wie viele Treffer, wann er aufgibt und ehrlich passt — die Einstellung hinter der Absage aus Kapitel 3.",
      },
    ],
  },
  {
    id: "evals",
    // The questions and suite structure are real; the SCORES are illustrative
    // and the evals-matrix body says so on screen. See fixtures/evals.ts.
    title: "Belegen statt behaupten",
    steps: [
      {
        id: "evals-suites",
        image: "/demo/ch5-evals.webp",
        route: "/evals",
        anchor: "evals-suites",
        title: "Der Teil, den niemand vorführt",
        body: "Eine gute Antwort kann jeder zeigen. Die Frage ist, was mit allen anderen passiert. Zwei Testreihen: eine für die technische Dokumentation, eine für Fragen, die aus Normen beantwortet werden müssen.",
      },
      {
        id: "evals-matrix",
        route: "/evals/evalset-techdoc-regression",
        anchor: "evals-matrix",
        title: "Jede Frage, jeder Lauf, ein Raster",
        body: "Zeilen sind echte Technikerfragen, Spalten sind Läufe. Fällt eine Antwort unter die Schwelle, wird die Zelle rot — eine Änderung, die eine Frage verbessert und eine andere verschlechtert, bleibt sichtbar. Die Werte hier sind beispielhaft.",
      },
      {
        id: "evals-sources",
        route: "/evals/evalset-techdoc-regression?tab=testCases",
        anchor: "evals-cases",
        title: "Auch die Quelle wird geprüft",
        body: "Ein Testfall kann neben der richtigen Antwort die richtige Quelle verlangen — eine Normfrage muss aus EN und DIN beantwortet werden, nicht aus einem Produkthandbuch. Richtig klingen und richtig sein werden getrennt bewertet.",
      },
    ],
  },
  {
    id: "email",
    // A second deployment, deliberately unnamed on screen: the point of the
    // switch is that a prospect stops watching one company's clever setup and
    // starts seeing a product that runs in more than one place.
    title: "Arbeitet, während Sie schlafen",
    steps: [
      {
        id: "email-routine",
        image: "/demo/ch6-email.webp",
        route: "/workflows",
        anchor: "routine-runs",
        title: "Ein zweiter Einsatz, dasselbe Produkt",
        body: "Ortswechsel: ein Hersteller hydraulischer Aufzugssysteme. Hier beantwortet der Assistent keine Fragen im Chat — er bearbeitet eingehende Ersatzteilanfragen per E-Mail, von selbst.",
      },
      {
        id: "email-trigger",
        route: `/workflows/${ALGI_ROUTINE_ID}`,
        anchor: "routine-email-trigger",
        title: "Der Posteingang ist der Auslöser",
        body: "Nur Absender der eigenen Domain starten die Routine — 60 pro Stunde, 10 je Absender. Keine Integration nötig: eine Weiterleitung genügt, den Rest übernimmt die Routine.",
      },
      {
        id: "email-runs",
        route: `/workflows/${ALGI_ROUTINE_ID}`,
        anchor: "routine-runs",
        // "start" for the same reason as the chunks step: the anchor heads the
        // runs list, and the step is about the runs.
        scrollBlock: "start",
        title: "Auch die, die schiefgegangen sind",
        body: "25 Läufe: 14 erledigt, 8 fehlgeschlagen, einer wartet auf einen Menschen, zwei abgewiesen. Dazwischen korrigiert ein Verkäufer die Entwürfe — und jede Korrektur wandert sofort ins Gedächtnis.",
      },
    ],
  },
  {
    id: "meetings",
    // The recordings, durations and statuses are from a live deployment; the
    // work instruction in the last step is the one artefact the product did
    // not produce, and the body says so on screen.
    title: "Festhalten, was besprochen wurde",
    steps: [
      {
        id: "meetings-list",
        image: "/demo/ch7-meetings.webp",
        route: "/transcriptions",
        anchor: "transcriptions",
        title: "Siebzehn Stunden, die niemand nachhören wird",
        body: "28 Besprechungen, aufgezeichnet von einem Bot, der einfach mitkommt — Produktionsplanung, Service, Schulung. Drei abgebrochen, eine fehlgeschlagen.",
      },
      {
        id: "meetings-transcript",
        route: `/transcriptions?review=${ALGI_MEETING_ID}`,
        anchor: null,
        title: "So sieht eine halbe Stunde davon aus",
        body: "Vier von sieben Personen im Raum, sie unterbrechen einander, Sätze enden zwei Beiträge später. Fast die Hälfte der Zeilen hat drei Wörter oder weniger — niemand liest das je nach.",
      },
      {
        id: "meetings-guide",
        route: `/transcriptions?review=${ALGI_MEETING_ID}`,
        anchor: "meeting-guide",
        // The outputs render at the BOTTOM of the review sheet's scroll;
        // "start" brings the document itself on screen, not just its header.
        scrollBlock: "start",
        title: "Also wird ein Dokument daraus",
        body: "Dieselbe Besprechung als Arbeitsanweisung: Freigabe prüfen, Lüftung nicht aus der Kabinentür ableiten, offene Punkte benennen. Alles Entschiedene, nichts vom Rauschen. Dieses eine Dokument entstand von Hand — der Kunde hat den Schritt noch nicht ausgeführt.",
      },
    ],
  },
  {
    id: "contact",
    // The case studies live HERE, not on the demo data: the premise is
    // generalized-but-realistic data with no attribution, and the one place
    // names are allowed is next to the ask, where references belong.
    title: "Sprechen Sie mit uns",
    steps: [
      {
        id: "contact-references",
        image: "/demo/structure.webp",
        route: TECHDOC_CHAT,
        anchor: null,
        title: "Wer damit arbeitet",
        body: "NEW Lift Steuerungsbau (technische Dokumentation und Service) und ALGI Hydraulic (Angebots- und Ersatzteilprozesse) arbeiten produktiv mit OPEN IMP. Alles, was Sie eben gesehen haben, ist daraus abgeleitet — verallgemeinert, aber realistisch.",
      },
      {
        id: "contact-close",
        route: TECHDOC_CHAT,
        anchor: null,
        title: "Mit Ihren eigenen Dokumenten",
        body: "Zehn Ihrer Handbücher, zwei Wochen, echte Fragen Ihres Serviceteams — auf genau dem, was Sie eben gesehen haben. Dreißig Minuten reichen für die Planung.",
        ...(DEMO_BOOKING_URL
          ? { cta: { label: "30-Minuten-Termin buchen", href: DEMO_BOOKING_URL } }
          : {}),
      },
    ],
  },
];

function chapterIndex(chapters: DemoChapter[], id: DemoChapterId): number {
  return chapters.findIndex((c) => c.id === id);
}

export function resolveStep(chapters: DemoChapter[], pos: TourPosition): DemoStep | null {
  const chapter = chapters[chapterIndex(chapters, pos.chapter)];
  if (!chapter) return null;
  return chapter.steps[pos.step] ?? null;
}

export function nextPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  const chapter = chapters[ci];
  if (pos.step + 1 < chapter.steps.length) {
    return { chapter: chapter.id, step: pos.step + 1 };
  }
  const next = chapters[ci + 1];
  return next ? { chapter: next.id, step: 0 } : null;
}

export function prevPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  if (pos.step > 0) return { chapter: pos.chapter, step: pos.step - 1 };
  const prev = chapters[ci - 1];
  return prev ? { chapter: prev.id, step: prev.steps.length - 1 } : null;
}

export function startOfChapter(id: DemoChapterId): TourPosition {
  return { chapter: id, step: 0 };
}

/**
 * The tour position lives in the URL, as `?tour=<chapter>.<step>`.
 *
 * It has to. Chapters 3 and 4 end on the product's own routes — the agent
 * editor, the knowledge base — which are in a different route group with its
 * own layout, so React state in a provider does not survive the navigation.
 * Held in the URL it does, and the position is shareable and reloadable as a
 * bonus: a salesperson can send a prospect a link to step 3 of chapter 5.
 */
export const TOUR_PARAM = "tour";

export function encodePosition(pos: TourPosition): string {
  return `${pos.chapter}.${pos.step}`;
}

/**
 * Returns null for anything unparseable, so a hand-edited or stale URL starts
 * the tour from the beginning rather than rendering a chapter with no steps.
 */
export function parsePosition(
  raw: string | null | undefined,
  chapters: DemoChapter[] = CHAPTERS,
): TourPosition | null {
  if (!raw) return null;
  const [chapterId, rawStep] = raw.split(".");
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  const step = Number(rawStep);
  if (!Number.isInteger(step) || step < 0 || step >= chapter.steps.length) {
    return null;
  }
  return { chapter: chapter.id, step };
}

/** The href a step lives at: its route, carrying the position. */
export function hrefFor(
  pos: TourPosition,
  chapters: DemoChapter[] = CHAPTERS,
): string {
  const step = resolveStep(chapters, pos);
  const route = step?.route ?? TECHDOC_CHAT;
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}${TOUR_PARAM}=${encodePosition(pos)}`;
}
