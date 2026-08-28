import { describe, expect, it, vi } from "vitest";

import { runDemoQueryThroughCache } from "@/lib/demo/test-support";

import {
  GET_CONTEXTS_EDITOR,
  GET_SKILLS_EDITOR,
  GET_TOOL_CATEGORIES_EDITOR,
  GET_TOOLS_EDITOR,
} from "./queries";

/**
 * Chapter 3 is the agent editor, and its entire subject — the agentic
 * retrieval card and the wizard behind it — renders only if ONE condition
 * holds: the deployment tool catalogue contains a tool with the id
 * `agentic_context_search` (hooks.ts:587, consumed at sections/knowledge.tsx).
 *
 * That catalogue arrives through a client-side useQuery, so it is invisible in
 * server-rendered HTML — curl cannot check it, and a bare 200 on the route
 * says nothing about whether the chapter has anything to show. Hence this.
 *
 * Run through a real cache rather than the raw link: EditorTools selects
 * `total`, `page` and `limit` alongside `items`, and a resolver returning only
 * `items` leaves the cache diff incomplete. That is not cosmetic here the way
 * it was on the knowledge table — an incomplete diff can hand `useQuery`
 * undefined data, and undefined data hides the card, which is the chapter.
 */

const run = (
  document: Parameters<typeof runDemoQueryThroughCache>[0],
  variables: Record<string, unknown> = {},
) => runDemoQueryThroughCache(document, variables, { chapter: "config", step: 0 });

describe("the agentic retrieval card can render", () => {
  it("finds the tool the card is gated on", async () => {
    const data = await run(GET_TOOLS_EDITOR, {
      search: "",
      category: null,
      limit: 20,
      page: 1,
    });
    const items = (data.tools as { items: { id: string }[] })?.items ?? [];
    expect(
      items.some((t) => t.id === "agentic_context_search"),
      "the deployment catalogue has no agentic_context_search, so the Knowledge section renders without the card and chapter 3 has no subject",
    ).toBe(true);
  });

  it("answers every field the document selects", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await run(GET_TOOLS_EDITOR, { search: "", limit: 20, page: 1 });
      expect(
        spy.mock.calls.map((c) => String(c[0])),
        "Apollo logged while writing EditorTools — a selected field is missing from the fixture",
      ).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("the rest of the editor loads quietly", () => {
  // Not about chapter 3's subject, but the visitor sees the whole page. Any of
  // these logging errors puts red in the console of a screen a prospect is
  // being walked through.
  it.each([
    ["EditorSkills", GET_SKILLS_EDITOR, { page: 1, limit: 20 }],
    ["EditorToolCategories", GET_TOOL_CATEGORIES_EDITOR, {}],
  ])("answers %s completely", async (_name, document, variables) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await run(document, variables as Record<string, unknown>);
      expect(spy.mock.calls.map((c) => String(c[0]))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("the wizard has knowledge bases to show", () => {
  it("returns the contexts the Sources step lists", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const data = await run(GET_CONTEXTS_EDITOR);
      const items =
        (data.contexts as { items: { id: string; name: string }[] })?.items ??
        [];

      // The wizard keys its knowledge-base profiles by context id. A context
      // in the saved config with no matching entry here is simply not drawn —
      // so the Sources step would show four of six with no error.
      const ids = items.map((c) => c.id);
      for (const id of [
        "tech_doc_context",
        "vorschriften_context",
        "software_documentation_context",
        "custom_documents_context",
        "zendesk_context",
        "new_servicedb_context",
      ]) {
        expect(ids, `the wizard config routes to ${id}, which no context provides`).toContain(id);
      }

      expect(spy.mock.calls.map((c) => String(c[0]))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
