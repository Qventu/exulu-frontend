import type { DemoChapter } from "../tour";

/**
 * Chapter 11 — what it costs, and who controls it.
 *
 * THE ONLY CHAPTER WHOSE NUMBERS ARE INVENTED. Every other chapter shows
 * something that happened: nine real documents with real chunk counts, a
 * real meeting recording, real evals. No spend history was ever captured
 * from the deployment, so these figures are constructed —
 * lib/demo/fixtures/chapter-kosten.ts is the one source both /analytics and
 * /budgets read, so the two screens cannot disagree about who spent what.
 *
 * That is allowed here on one condition, and the condition is load-bearing:
 * the copy says so where a visitor reads it (the "Beispielwerte" callout
 * below), and tour.test.ts's register of chapters that show something
 * invented asserts the sentence stays. The evals chapter sets the same
 * precedent for its scores.
 *
 * The argument is attribution and control — never savings. A demo that
 * claims "cheaper than a headcount" invites an argument it cannot win and
 * spends the credibility the previous ten chapters built. tour.test.ts's
 * register also asserts the NEGATIVE: no step here may claim a return, even
 * though the chapter's own honest disclaimer ("Wir behaupten hier keine
 * Einsparung") contains the word "Einsparung" — the assertion forbids CLAIM
 * PHRASINGS ("spart Ihnen", "rechnet sich", …), never that bare word, or it
 * would fail on the very sentence that makes the chapter honest.
 *
 * Three steps, not two: /analytics' attribution point and its
 * example-figures disclosure fit one step; /budgets carries both the
 * control point (a limit enforced in operation) AND the closing
 * no-savings-claim disclaimer, and the two together overran the popover
 * word cap, so the disclaimer got its own step rather than being trimmed
 * away.
 *
 * BOTH routes carry a query parameter, and neither is cosmetic. /analytics
 * defaults to dimension=agents and /budgets to type=user (DEFAULT_DIMENSION
 * in analytics/lens.ts; the `type` fall-back in budgets-view.tsx), and this
 * tour has spend for exactly one roster: the three teams. Landing on the
 * defaults put "Keine Daten für diese Ansicht" under a step claiming
 * "Sie sehen, wofür ausgegeben wurde" and "Noch keine Budgets" under one
 * claiming "Jedes Team bekommt ein monatliches Limit" — the argument
 * contradicted by the screen making it. hrefFor() already appends `tour=`
 * with `&` when a route carries a query, and the route-allowlist test splits
 * on "?", so both were anticipated.
 *
 * /budgets' second step also carries a short clause distinguishing what the
 * two screens measure: /analytics sums a chosen window (14 days by default,
 * ~$208.63 the day this was measured — a day-generator sum that drifts with
 * the date it runs on, not a fixed figure; a 30d preset lands roughly near
 * the /budgets total, not tightly) while /budgets shows a fixed monthly cap
 * ($400 across the three teams). Nothing in the product itself marks that
 * distinction, so a visitor who switches to the 30d preset and compares the
 * two totals has no on-screen cue that they are looking at a rolling window
 * next to a calendar-month limit rather than a discrepancy.
 *
 * CURRENCY: the product renders LiteLLM's spend in USD (kpi-strip.tsx's
 * SPEND_CURRENCY, lib/budget.ts's formatUsd — both hardcode USD/en-US), and
 * every dollar figure in this file and in fixtures/chapter-kosten.ts is USD
 * accordingly. Don't "fix" the fixtures to EUR later.
 *
 * KNOWN HAZARD, NOT FIXED HERE: /analytics' own controls (RangePicker,
 * KPIStrip's hrefFor) rebuild the URL from lensToSearchParams() alone
 * (analytics-view.tsx's updateLens, kpi-strip.tsx's hrefFor), which drops
 * any unknown query param including `?tour=` — and tour-provider.tsx falls
 * back to the START position (chapter 1) once `?tour=` is gone. This does
 * NOT bite in this chapter today: all three of its steps are `anchor: null`
 * modal steps, so Shepherd's overlay sits above the range picker and the KPI
 * tiles and swallows the click before it reaches them. It WOULD start biting
 * the moment any /analytics step here (or elsewhere) is given a non-null
 * `anchor` — that cuts a hole in the overlay onto the underlying controls.
 * The tour engine serves all twelve chapters and is not being changed for a
 * path this chapter cannot currently reach.
 */
export const kostenChapter: DemoChapter = {
  id: "kosten",
  title: "Was es kostet",
  steps: [
    {
      id: "kosten-verbrauch",
      route: "/analytics?dimension=teams",
      anchor: null,
      size: "wide",
      title: "Jede Anfrage hat einen Preis — und einen Absender",
      content: [
        {
          kind: "figure",
          src: "/demo/kosten.webp",
          alt: "Verbrauch nach Team",
        },
        {
          kind: "paragraph",
          text: "Verbrauch wird laufend erfasst — pro Team, Nutzer und Assistent. Sie sehen, wofür ausgegeben wurde, nicht nur wie viel.",
        },
        {
          kind: "callout",
          tone: "fact",
          text: "Die Zahlen auf diesem Bildschirm sind Beispielwerte, keine Messwerte — anders als die Dokumente und Auswertungen der vorigen Kapitel.",
        },
      ],
    },
    {
      id: "kosten-kontrolle",
      route: "/budgets?type=team",
      anchor: null,
      title: "Ein Limit ist eine Einstellung, kein Versprechen",
      content: [
        {
          kind: "paragraph",
          text: "Jedes Team bekommt ein monatliches Limit. Ist es erreicht, greift die Grenze im Betrieb — nicht in einer Richtlinie, an die sich jemand erinnern muss.",
        },
        {
          kind: "paragraph",
          text: "Der Zeitraum in der Analyse eben war frei wählbar; dieses Limit läuft fest pro Abrechnungsmonat.",
        },
      ],
    },
    {
      id: "kosten-entscheidung",
      route: "/budgets?type=team",
      anchor: null,
      title: "Keine Einsparung wird hier behauptet",
      content: [
        {
          kind: "paragraph",
          text: "Wer wie viel ausgeben darf, entscheiden Sie. Wir behaupten hier keine Einsparung — was die Einführung wert ist, hängt von Ihren Zahlen ab, nicht von unseren.",
        },
      ],
    },
  ],
};
