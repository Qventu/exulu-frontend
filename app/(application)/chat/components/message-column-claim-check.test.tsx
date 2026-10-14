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

import { makeClaimCheck } from "./message-column";
import de from "@/messages/de.json";

// vitest.config.ts does not set `test.globals: true`, so testing-library's
// implicit afterEach(cleanup) registration never fires here — without this,
// a render from one test leaks into the jsdom document the next test queries.
afterEach(cleanup);

const message = { id: "msg_1", role: "assistant", parts: [], metadata: {} } as never;
const agent = { id: "a1", name: "Agent" } as never;

describe("makeClaimCheck", () => {
  // `@testing-library/jest-dom` is not a project dependency (confirmed by
  // claim-check.test.tsx: no other *.test.tsx uses `toBeInTheDocument`). The
  // house pattern pairs `getByText` — which already throws if nothing
  // matches — with `.toBeDefined()`, and a `container.firstChild` /
  // `.toBeNull()` check for absence, rather than jest-dom's
  // `toBeInTheDocument()` / `toBeEmptyDOMElement()` from the brief's snippet.

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
});
