// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

// message-column.tsx imports AgentVisual from "@/components/lottie", which
// pulls in lottie-react/lottie-web — lottie-web creates a <canvas> and calls
// getContext("2d") at module-eval time, which jsdom doesn't implement without
// the "canvas" npm package, crashing the import before any test body runs.
// Stubbed here since this suite only exercises makeClaimCheck.
vi.mock("@/components/lottie", () => ({ default: () => null }));

// Spies on the real `collectSources` so the test below can assert it is not
// called at all for a message with no check state — the ~89,000-character
// parse this component used to pay on every render of every triggered
// message (the AI SDK hands back a new `messages` array on nearly every
// streamed tick).
const { collectSpy } = vi.hoisted(() => ({ collectSpy: vi.fn() }));
vi.mock("./claim-check-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./claim-check-data")>();
  return {
    ...actual,
    collectSources: (...a: Parameters<typeof actual.collectSources>) => {
      collectSpy(...a);
      return actual.collectSources(...a);
    },
  };
});

import { makeClaimCheck } from "./message-column";
import de from "@/messages/de.json";

// vitest.config.ts does not set `test.globals: true`, so testing-library's
// implicit afterEach(cleanup) registration never fires here — without this,
// a render from one test leaks into the jsdom document the next test queries.
afterEach(cleanup);

const message = { id: "msg_1", role: "assistant", parts: [], metadata: {} } as never;
const agent = { id: "a1", name: "Agent" } as never;

/** A triggered message whose retrieval part is the expensive thing to parse. */
const triggeredMessage = {
  id: "msg_triggered",
  role: "assistant",
  metadata: { claimCheck: { enabled: true, sources: [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }] } },
  parts: [
    {
      type: "tool-Context_Search",
      toolCallId: "call_1",
      output: { result: JSON.stringify({ chunks: [{ item_id: "i1", item_name: "h.pdf", chunk_content: "230 Volt." }] }) },
    },
  ],
} as never;

describe("makeClaimCheck", () => {
  // `@testing-library/jest-dom` is not a project dependency (confirmed by
  // claim-check.test.tsx: no other *.test.tsx uses `toBeInTheDocument`). The
  // house pattern pairs `getByText` — which already throws if nothing
  // matches — with `.toBeDefined()`, and a `container.firstChild` /
  // `.toBeNull()` check for absence, rather than jest-dom's
  // `toBeInTheDocument()` / `toBeEmptyDOMElement()` from the brief's snippet.

  // Fix round 3, minor: the labels are derived from the message's own tool
  // output, which means re-parsing ~89,000 characters — and this component
  // re-renders constantly, because the AI SDK hands back a new `messages`
  // array on nearly every streamed tick. A message with no check state has
  // no panel and nothing to label, so the work must not happen at all.
  it("does not parse the message's tool output when there is no check for it", () => {
    collectSpy.mockClear();
    const Component = makeClaimCheck({}, false);
    render(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={triggeredMessage} agent={agent} />
      </NextIntlClientProvider>,
    );
    expect(collectSpy).not.toHaveBeenCalled();
  });

  it("parses it once, not once per render, for a message that does have a check", () => {
    collectSpy.mockClear();
    const Component = makeClaimCheck({ msg_triggered: { status: "running" } }, false);
    const ui = (
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={triggeredMessage} agent={agent} />
      </NextIntlClientProvider>
    );
    const { rerender } = render(ui);
    // A fresh message object with the same id, as the SDK hands back on
    // every streamed tick.
    rerender(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={{ ...(triggeredMessage as object) } as never} agent={agent} />
      </NextIntlClientProvider>,
    );
    expect(collectSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the panel for a message that has state", () => {
    const Component = makeClaimCheck({ msg_1: { status: "running" } }, false);
    render(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={message} agent={agent} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/wird geprüft/i)).toBeDefined();
  });

  it("renders nothing for a message with no state", () => {
    const Component = makeClaimCheck({}, false);
    const { container } = render(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={message} agent={agent} />
      </NextIntlClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  // Guards against a factory that looks up state by something other than
  // the rendered message's own id (e.g. an off-by-one keying bug, or one
  // that ignores the id and just reads "the" entry) — state keyed to a
  // DIFFERENT message id must render nothing for this message.
  it("renders nothing when the state belongs to a different message", () => {
    const Component = makeClaimCheck({ msg_2: { status: "running" } }, false);
    const { container } = render(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={message} agent={agent} />
      </NextIntlClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  // The one thing this task adds beyond wiring: the factory derives
  // sourceNames from the message's own retrieval tool part via
  // collectSources(message, trigger.sources), so an evidence quote is
  // attributed to its document rather than shown as an anonymous snippet.
  it("names the evidence source from the message's retrieval part", async () => {
    const messageWithSource = {
      id: "msg_named",
      role: "assistant",
      metadata: { claimCheck: { enabled: true, sources: [{ type: "knowledge_base", id: "i1", toolCallId: "call_1" }] } },
      parts: [
        {
          type: "tool-Context_Search",
          toolCallId: "call_1",
          output: {
            result: JSON.stringify({
              chunks: [{ item_id: "i1", item_name: "handbuch.pdf", chunk_content: "Das Gerät arbeitet mit 230 Volt." }],
            }),
          },
        },
      ],
    } as never;
    const result = {
      status: "ok",
      score: { claims: 1, supported: 1, contradicted: 0, unsupported: 0, unsupportedShare: 0, label: "ok" },
      sentences: [{ index: 0, start: 0, end: 34, state: "checked", claimIds: ["c1"] }],
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
    } as never;
    const Component = makeClaimCheck({ msg_named: { status: "done", result } }, false);
    const { container } = render(
      <NextIntlClientProvider locale="de" messages={de as never}>
        <Component message={messageWithSource} agent={agent} />
      </NextIntlClientProvider>,
    );
    const trigger = container.querySelector("[data-claim-check-trigger]") as HTMLElement;
    trigger.click();
    expect(await screen.findByText(/handbuch\.pdf.*arbeitet mit 230 Volt/)).toBeDefined();
    // The id itself must never reach a reader as a stand-in for the name.
    expect(screen.queryByText(/i1/)).toBeNull();
  });
});
