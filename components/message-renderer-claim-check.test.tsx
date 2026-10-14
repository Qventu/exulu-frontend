// @vitest-environment jsdom
//
// The claim-check panel, asserted through the real `MessageRenderer` rather
// than against the factory's output.
//
// This file exists because of a whole-branch review finding no task-scoped
// test could see: `message-column-claim-check.test.tsx` renders
// `makeClaimCheck(...)`'s output directly, so it proved the panel renders
// while the panel was in fact invisible in the product. The chat surface
// feeds `MessageItem` a `ClaimCheckComponent` built by a `useMemo` over
// `controller.claimChecks`, and `messageItemPropsEqual` skipped it as if it
// were an event handler — so the one prop that changes when a check starts
// or finishes was discarded and `memo` bailed out. The panel only appeared a
// turn later, when some unrelated prop of that item happened to change.
//
// So the assertion here is specifically: re-render with EVERY other prop
// reference-identical and only the claim-check component swapped, and the
// panel must appear. `status="ready"` keeps `streamingLabel` at `null`
// (otherwise MessageRenderer's 3s placeholder interval would itself change a
// prop and mask the bug), and `messages`/`agent` are module-level constants
// reused across both renders for the same reason.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

// MessageRenderer reaches for the app router in its edit/remove handlers; no
// Next.js router exists under vitest.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
// message-column.tsx imports AgentVisual from "@/components/lottie", and
// lottie-web calls canvas.getContext("2d") at module-eval time, which jsdom
// does not implement without the "canvas" package.
vi.mock("@/components/lottie", () => ({ default: () => null }));

import { MessageRenderer } from "./message-renderer";
import { makeClaimCheck } from "@/app/(application)/chat/components/message-column";
import type { ClaimCheckState } from "@/app/(application)/chat/components/claim-check";
import de from "@/messages/de.json";

// vitest.config.ts sets no `test.globals`, so testing-library's implicit
// afterEach(cleanup) never registers.
afterEach(cleanup);

const agent = { id: "a1", name: "Agent" } as never;

const messages = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "Arbeitet das Gerät mit 230 Volt?" }] },
  {
    id: "m1",
    role: "assistant",
    parts: [{ type: "text", text: "Ja, das Gerät arbeitet mit 230 Volt." }],
    metadata: {},
  },
] as never[];

const DONE: ClaimCheckState = {
  status: "done",
  result: {
    status: "ok",
    score: { claims: 1, supported: 1, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "ok" },
    sentences: [{ index: 0, start: 0, end: 36, state: "checked", claimIds: ["c1"] }],
    claims: [
      {
        id: "c1",
        sentenceIndex: 0,
        text: "Das Gerät arbeitet mit 230 Volt.",
        inferred: false,
        verdict: "supported",
        evidence: [{ sourceId: "i1", quote: "arbeitet mit 230 Volt" }],
        rationale: "Die Quelle nennt 230 Volt.",
        rechecked: false,
      },
    ],
    usage: { calls: 1, inputTokens: 1, outputTokens: 1 },
    timings: {},
    limits: { truncated: false, sentencesSkipped: 0 },
    notes: [],
  },
};

function tree(checks: Record<string, ClaimCheckState>) {
  return (
    <NextIntlClientProvider locale="de" messages={de as never}>
      <MessageRenderer
        messages={messages}
        agent={agent}
        status="ready"
        ClaimCheckComponent={makeClaimCheck(checks, false)}
      />
    </NextIntlClientProvider>
  );
}

describe("MessageRenderer renders the claim-check panel", () => {
  it("reveals the running state when claimChecks is the only changed prop", () => {
    const { rerender } = render(tree({}));
    expect(screen.queryByText(/wird geprüft/i)).toBeNull();

    rerender(tree({ m1: { status: "running" } }));
    expect(screen.getByText(/wird geprüft/i)).toBeDefined();
  });

  it("replaces running with the finished score when the result arrives", () => {
    const { rerender } = render(tree({ m1: { status: "running" } }));
    expect(screen.getByText(/wird geprüft/i)).toBeDefined();

    rerender(tree({ m1: DONE }));
    expect(screen.queryByText(/wird geprüft/i)).toBeNull();
    expect(screen.getByText(/1 von 1 Aussage.* belegt/)).toBeDefined();
  });

  it("rehydrates a stored check straight into the finished state", () => {
    // The reload path (spec §5.2): the session's stored checks land in
    // `claimChecks` after the messages are already on screen, so the panel
    // depends on the same prop-identity signal as a live check.
    const { rerender } = render(tree({}));
    rerender(tree({ m1: DONE }));
    expect(screen.getByText(/1 von 1 Aussage.* belegt/)).toBeDefined();
  });
});
