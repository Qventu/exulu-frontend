// @vitest-environment jsdom
//
// Citation badges inside `Response`, rendered through the real markdown
// pipeline (rehype-raw turns the `<cite-marker-knowledge-source>` element the
// message renderer emits into `KnowledgeSourceCitationBadge`).
//
// Background (ALGI, 2026-11-11, session 21e8d25c): the whole chat page fell
// into the navigation error boundary ("Navigationsfehler") and users could
// not give feedback. Two defects combined:
//
//  1. Memory recall cites with QUOTED values — `{item_name: "…", item_id: "…",
//     context: "agent_memory_context"}` (backend recall-collector.ts) — and
//     the renderer's field regex keeps the quotes, so the badge built
//     `query GetChunkById"agent_memory_context"…` and gql threw
//     `Syntax Error: Expected "{", found String "agent_memory_context"`.
//  2. The badge returned early AFTER `useState` and BEFORE `useQuery`,
//     `useMutation`, `useEffect`. When a badge instance switched between a
//     citation it could query and one it could not (the markdown tree keeps
//     element positions across re-renders), React saw a different number of
//     hooks and threw — straight into the page-level boundary.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import * as React from "react";

// The badge's PDF preview reaches for the file picker's presign helper; the
// picker pulls uppy at module scope, which jsdom has no business loading.
vi.mock("@/components/primitives/file-picker", () => ({
  getPresignedUrl: vi.fn(async () => ""),
}));

import { Response } from "./response";

afterEach(cleanup);

const marker = (parts: string[]) =>
  `<cite-marker-knowledge-source data-citation="${encodeURIComponent(parts.join("|"))}"></cite-marker-knowledge-source>`;

// item_name|item_id|chunk_id|chunk_index|context — exactly what
// message-renderer.tsx builds from the model's citation objects.
const knowledgeCitation = marker(["wartung.pdf", "item-1", "chunk-1", "0", "tech_doc_context"]);
const memoryCitation = marker(['"T-AZK Standard 118111"', '"mem-1"', "", "", '"agent_memory_context"']);

class CrashCatcher extends React.Component<
  { onError: (error: Error) => void; children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.crashed ? <div data-testid="crashed" /> : this.props.children;
  }
}

function tree(markdown: string, onError: (error: Error) => void = () => {}) {
  return (
    <MockedProvider mocks={[]}>
      <CrashCatcher onError={onError}>
        <Response>{markdown}</Response>
      </CrashCatcher>
    </MockedProvider>
  );
}

describe("citation badges in Response", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders a memory citation whose values carry quotes without a parse error", () => {
    render(tree(`Laut Memory ${memoryCitation} ist 118111 der Standard.`));

    const parseErrors = consoleError.mock.calls.filter((call) => String(call[0]).includes("Error parsing citation"));
    expect(parseErrors).toEqual([]);
    expect(screen.queryByTestId("crashed")).toBeNull();
    // The quotes are stripped, so the flat badge shows "<context> - <title>".
    expect(screen.getByText(/agent memory context - T-AZK Standard 118111/)).toBeTruthy();
  });

  it("keeps the hook order when a badge slot switches from a queryable citation to a memory citation", () => {
    const errors: Error[] = [];
    const { rerender } = render(tree(`Quelle ${knowledgeCitation} sagt es.`, (e) => errors.push(e)));
    expect(screen.queryByTestId("crashed")).toBeNull();

    rerender(tree(`Quelle ${memoryCitation} sagt es.`, (e) => errors.push(e)));

    expect(errors.map((e) => e.message)).toEqual([]);
    expect(screen.queryByTestId("crashed")).toBeNull();
  });

  it("keeps the hook order in the other direction too (memory citation first, then a queryable one)", () => {
    const errors: Error[] = [];
    const { rerender } = render(tree(`Quelle ${memoryCitation} sagt es.`, (e) => errors.push(e)));
    rerender(tree(`Quelle ${knowledgeCitation} sagt es.`, (e) => errors.push(e)));

    expect(errors.map((e) => e.message)).toEqual([]);
    expect(screen.queryByTestId("crashed")).toBeNull();
  });
});
