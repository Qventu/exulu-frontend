// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { ClaimCheck, type ClaimCheckState } from "./claim-check";
import de from "@/messages/de.json";

// vitest.config.ts does not set `test.globals: true`, so testing-library's
// implicit afterEach(cleanup) registration never fires here — without this,
// renders from earlier tests in this file pile up in the same jsdom
// document, which turns an unambiguous `queryByText` into a "found multiple
// elements" throw once two tests render overlapping text (e.g. the same
// quote via two different `show()` calls).
afterEach(cleanup);

const show = (state: ClaimCheckState, extra: { guestMode?: boolean; sourceNames?: Record<string, string> } = {}) =>
  render(
    <NextIntlClientProvider locale="de" messages={de as never}>
      <ClaimCheck state={state} {...extra} />
    </NextIntlClientProvider>,
  );

const result = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    status: "ok",
    score: { claims: 4, supported: 3, contradicted: 1, unsupported: 0, unsupportedShare: 0.25, label: "warn" },
    sentences: [{ index: 0, start: 0, end: 34, state: "checked", claimIds: ["c1"] }],
    claims: [
      {
        id: "c1",
        sentenceIndex: 0,
        text: "Die FST-2XT arbeitet mit 230 Volt.",
        inferred: false,
        verdict: "supported",
        evidence: [{ sourceId: "i1", quote: "arbeitet mit 230 Volt" }],
        rationale: "Die Quelle nennt 230 Volt.",
        rechecked: false,
      },
      {
        id: "c2",
        sentenceIndex: 0,
        text: "Die FST-2XT wiegt 12 kg.",
        inferred: false,
        verdict: "contradicted",
        evidence: [{ sourceId: "i1", quote: "wiegt 18 kg" }],
        rationale: "Die Quelle nennt 18 kg.",
        rechecked: false,
      },
    ],
    usage: { calls: 8, inputTokens: 1, outputTokens: 1 },
    timings: { totalMs: 5000 },
    limits: { truncated: false, sentencesSkipped: 0 },
    notes: [],
    ...over,
  }) as never;

describe("ClaimCheck", () => {
  // `@testing-library/jest-dom` is not a project dependency (confirmed:
  // no other *.test.tsx uses `toBeInTheDocument`). The house pattern
  // (context-map-card.test.tsx, base-shell.test.tsx) pairs `getByText` —
  // which already throws if nothing matches — with `.toBeDefined()`, and
  // `queryByText` with `.toBeNull()` for absence. Same assertions as the
  // brief's snippet, repo's matcher style.

  it("renders nothing when there is no state", () => {
    const { container } = show(null);
    expect(container.firstChild).toBeNull();
  });

  // Review Focus 1
  it("shows a running state while the check is in flight", () => {
    show({ status: "running" });
    expect(screen.getByText(/wird geprüft/i)).toBeDefined();
  });

  it("shows a failed state without pretending to have a score", () => {
    show({ status: "failed" });
    expect(screen.getByText(/konnte nicht abgeschlossen/i)).toBeDefined();
    expect(screen.queryByText(/belegt/i)).toBeNull();
  });

  // M3: the summary used one invariable plural, so a one-claim answer read
  // "1 von 1 Aussagen belegt". The neighbouring wizard keys all use ICU
  // plurals.
  it("uses the singular when exactly one claim was checked", () => {
    show({
      status: "done",
      result: result({
        score: { claims: 1, supported: 1, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "ok" },
        claims: [],
      }),
    });
    expect(screen.getByText("1 von 1 Aussage belegt")).toBeDefined();
  });

  it("uses the plural for more than one", () => {
    show({ status: "done", result: result() });
    expect(screen.getByText("3 von 4 Aussagen belegt")).toBeDefined();
  });

  it("leads with the counts and names contradictions separately from missing evidence", () => {
    show({ status: "done", result: result() });
    expect(screen.getByText(/3 von 4 Aussagen belegt/i)).toBeDefined();
    expect(screen.getByText(/1 widerlegt/i)).toBeDefined();
  });

  // Mirror of the above with the two counts swapped: every other fixture in
  // this file sets `unsupported: 0`, so without this case nothing would
  // catch a copy-paste slip in the unsupported badge line — wrong key, wrong
  // variant, or an accidental reuse of the `contradicted` one. Requirement 2
  // ("contradicted and unsupported are never merged into one count or one
  // colour") needs both halves pinned, not just the contradicted one.
  it("names missing evidence separately from contradictions when it is unsupported, not contradicted, that is non-zero", () => {
    show({
      status: "done",
      result: result({
        score: { claims: 4, supported: 2, contradicted: 0, unsupported: 2, unsupportedShare: 0.5, label: "warn" },
      }),
    });
    expect(screen.getByText(/2 von 4 Aussagen belegt/i)).toBeDefined();
    expect(screen.getByText(/2 ohne Belegstelle/i)).toBeDefined();
    expect(screen.queryByText(/widerlegt/i)).toBeNull();
  });

  // Review Focus 3
  it("says nothing was checkable instead of showing a zero score when label is n/a", () => {
    show({
      status: "done",
      result: result({
        score: { claims: 0, supported: 0, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "n/a" },
        claims: [],
      }),
    });
    expect(screen.getByText(/Keine überprüfbaren Aussagen/i)).toBeDefined();
    expect(screen.queryByText(/0 von 0/i)).toBeNull();
  });

  // I2: the backend returns `label: "n/a"` for three different things —
  // genuinely nothing checkable, an internal failure, and claims that were
  // never judged because no passage was usable. Only the first means "no
  // checkable statements in this answer"; saying it for the other two tells
  // the reader something false about their own answer. `status: "partial"`
  // is what separates them.
  it("says the check could not be completed, not that nothing was checkable, when n/a is partial", () => {
    show({
      status: "done",
      result: result({
        status: "partial",
        score: { claims: 0, supported: 0, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "n/a" },
        claims: [],
        notes: ["claim check failed internally: boom"],
      }),
    });
    expect(screen.getByText(/nicht vollständig geprüft/i)).toBeDefined();
    expect(screen.queryByText(/Keine überprüfbaren Aussagen/i)).toBeNull();
    expect(screen.queryByText(/0 von 0/i)).toBeNull();
  });

  // The real reason is in `notes`, which was never rendered anywhere. (The
  // one note that is NOT shown — the raw internal-failure message — has its
  // own cases below.)
  it("shows the engine's notes for an n/a partial, where the reason actually is", () => {
    show({
      status: "done",
      result: result({
        status: "partial",
        score: { claims: 0, supported: 0, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "n/a" },
        claims: [],
        notes: ["decomposition did not report an outcome for 3 sentence(s)"],
      }),
    });
    expect(screen.getByText("decomposition did not report an outcome for 3 sentence(s)")).toBeDefined();
  });

  it("shows the engine's notes inside the expanded panel of a scored check", async () => {
    const { container } = show({
      status: "done",
      result: result({ status: "partial", notes: ["12 sentence(s) marked not_checked: selection aborted"] }),
    });
    // Collapsed: a diagnostic line must not crowd the summary bar.
    expect(screen.queryByText(/marked not_checked/)).toBeNull();
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    expect(await screen.findByText("12 sentence(s) marked not_checked: selection aborted")).toBeDefined();
  });

  // One of the engine's notes is `claim check failed internally: ${err.message}`
  // (ee/claim-check/run.ts), i.e. a raw exception message. That is a log line,
  // not something to put in front of whoever reads the answer — this
  // component ignores guestMode, so external-role users see the panel too.
  // The incomplete line already tells the reader the check did not finish.
  it("never shows the engine's internal-failure note to a reader", () => {
    show({
      status: "done",
      result: result({
        status: "partial",
        score: { claims: 0, supported: 0, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "n/a" },
        claims: [],
        notes: ["claim check failed internally: Cannot read properties of undefined (reading 'id')"],
      }),
    });
    expect(screen.getByText(/nicht vollständig geprüft/i)).toBeDefined();
    expect(screen.queryByText(/failed internally/)).toBeNull();
    expect(screen.queryByText(/Cannot read properties/)).toBeNull();
    // No heading either: the only note there was is gone, so the block is empty.
    expect(screen.queryByText(de.chat.claimCheckNotesTitle)).toBeNull();
  });

  it("keeps the reader-facing notes alongside a filtered internal-failure one", () => {
    show({
      status: "done",
      result: result({
        status: "partial",
        score: { claims: 0, supported: 0, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "n/a" },
        claims: [],
        notes: [
          "12 sentence(s) marked not_checked: selection aborted",
          "claim check failed internally: boom",
        ],
      }),
    });
    expect(screen.getByText("12 sentence(s) marked not_checked: selection aborted")).toBeDefined();
    expect(screen.queryByText(/failed internally/)).toBeNull();
  });

  it("filters the internal-failure note inside the expanded panel too", async () => {
    const { container } = show({
      status: "done",
      result: result({ status: "partial", notes: ["claim check failed internally: boom"] }),
    });
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    await screen.findByText("Die FST-2XT wiegt 12 kg.");
    expect(screen.queryByText(/failed internally/)).toBeNull();
    expect(screen.queryByText(de.chat.claimCheckNotesTitle)).toBeNull();
  });

  it("renders no notes block when the engine reported none", async () => {
    const { container } = show({ status: "done", result: result() });
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    await screen.findByText("Die FST-2XT wiegt 12 kg.");
    expect(screen.queryByText(de.chat.claimCheckNotesTitle)).toBeNull();
  });

  // Review Focus 4
  it("warns that the check is incomplete when the status is partial", () => {
    show({ status: "done", result: result({ status: "partial", notes: ["selection aborted"] }) });
    expect(screen.getByText(/unvollständig/i)).toBeDefined();
  });

  it("is collapsed by default: the claim list is not rendered until opened", () => {
    show({ status: "done", result: result() });
    expect(screen.queryByText("Die FST-2XT wiegt 12 kg.")).toBeNull();
  });

  it("shows each claim with its verdict and rationale once opened", async () => {
    const { container } = show({ status: "done", result: result() });
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    expect(await screen.findByText("Die FST-2XT wiegt 12 kg.")).toBeDefined();
    expect(screen.getByText(/Die Quelle nennt 18 kg\./i)).toBeDefined();
  });

  // A row without its evidence quote would be an unexplained accusation
  // about the reader's own answer (plan fix f87da41, backend repo): deferring
  // in-body highlighting and source-viewer links was argued on the quote
  // being present, so it must render once the panel is open.
  it("shows each claim's evidence quote once opened", async () => {
    const { container } = show({ status: "done", result: result() });
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    // The quote marks disambiguate the evidence line from c1's own claim
    // text, which happens to contain the same words ("… arbeitet mit 230
    // Volt.").
    expect(await screen.findByText(/„arbeitet mit 230 Volt“/)).toBeDefined();
    expect(screen.getByText(/„wiegt 18 kg“/)).toBeDefined();
  });

  it("names the source next to its quote when sourceNames carries one for that evidence", async () => {
    const { container } = show({ status: "done", result: result() }, { sourceNames: { i1: "handbuch.pdf" } });
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    expect(await screen.findByText(/handbuch\.pdf.*arbeitet mit 230 Volt/)).toBeDefined();
    // No sourceNames entry anywhere names a raw id — only the quote and,
    // when known, the given name ever reach the reader.
    expect(screen.queryByText(/i1/)).toBeNull();
  });

  it("renders a claim with no evidence without a quote block, rather than an empty one or a crash", async () => {
    const { container } = show({
      status: "done",
      result: result({
        claims: [
          {
            id: "c3",
            sentenceIndex: 0,
            text: "Die FST-2XT ist wartungsfrei.",
            inferred: false,
            verdict: "unsupported",
            evidence: [],
            rationale: "Keine Quelle erwähnt Wartungsfreiheit.",
            rechecked: false,
          },
        ],
      }),
    });
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    expect(await screen.findByText("Die FST-2XT ist wartungsfrei.")).toBeDefined();
    expect(screen.queryByText(/„/)).toBeNull();
  });

  // M1: the running icon is Loader2 — a spinner whose whole job is to turn —
  // and QuietLine hardcoded `size-3.5 shrink-0`, so it sat still.
  it("spins the running icon, and only that one", () => {
    const { container } = show({ status: "running" });
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    cleanup();
    const failed = show({ status: "failed" });
    expect(failed.container.querySelector(".animate-spin")).toBeNull();
  });

  // The panel appears seconds AFTER the answer has finished streaming, so a
  // screen-reader user gets no cue unless the transition is announced.
  it("announces the state through a live region, running and done", () => {
    const running = show({ status: "running" });
    const region = running.container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute("aria-live")).toBe("polite");
    expect(region!.textContent).toMatch(/wird geprüft/i);
    cleanup();

    const done = show({ status: "done", result: result() });
    const doneRegion = done.container.querySelector('[role="status"]');
    expect(doneRegion).not.toBeNull();
    expect(doneRegion!.textContent).toMatch(/3 von 4 Aussagen belegt/);
  });

  // The whole point of the region: `aria-live` announces changes INSIDE an
  // element that already exists, so a region that is itself replaced on the
  // transition announces nothing. One wrapper must survive running -> done.
  it("keeps the same live-region element across the running -> done transition", () => {
    const { container, rerender } = render(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <ClaimCheck state={{ status: "running" }} />
      </NextIntlClientProvider>,
    );
    const before = container.querySelector('[role="status"]');
    rerender(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <ClaimCheck state={{ status: "done", result: result() }} />
      </NextIntlClientProvider>,
    );
    const after = container.querySelector('[role="status"]');
    expect(after).toBe(before);
    expect(after!.textContent).toMatch(/3 von 4 Aussagen belegt/);
  });

  // The claim list is long and the reader opens it deliberately; without the
  // override it would be re-read by the live region on every expand.
  it("exempts the expanded claim list from the live region", () => {
    const { container } = show({ status: "done", result: result() });
    const off = container.querySelector('[aria-live="off"]');
    expect(off).not.toBeNull();
  });

  // An assistant message with no check must add nothing at all — not an
  // empty live region under every answer in the conversation.
  it("adds no live region when there is no state", () => {
    const { container } = show(null);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
