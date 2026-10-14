// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { ClaimCheck, type ClaimCheckState } from "./claim-check";
import de from "@/messages/de.json";

const show = (state: ClaimCheckState) =>
  render(
    <NextIntlClientProvider locale="de" messages={de as never}>
      <ClaimCheck state={state} />
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

  it("leads with the counts and names contradictions separately from missing evidence", () => {
    show({ status: "done", result: result() });
    expect(screen.getByText(/3 von 4 Aussagen belegt/i)).toBeDefined();
    expect(screen.getByText(/1 widersprochen/i)).toBeDefined();
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
});
