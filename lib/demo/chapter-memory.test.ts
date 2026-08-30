import { gql } from "@apollo/client/core";
import { describe, expect, it } from "vitest";

import { scrollbackFor, turnsFor } from "./current-position";
import { getWorld } from "./fixtures";
import {
  CORRECTION_MEMORY,
  MEMORY_CONTEXT_ID,
  MEMORY_SESSION_ID,
  MEMORY_WRITTEN_AT_STEP,
} from "./fixtures/chapter-memory";
import { MEMORY_CORRECTION_PROMPT } from "./fixtures/memory-turns";
import { buildChunks } from "./script";
import { runDemoOperation } from "./test-support";
import { CHAPTERS, resolveStep } from "./tour";

/**
 * Chapter 4 is the correction loop: an engineer tells the assistant its answer
 * is wrong, and the correction becomes a durable, inspectable memory item.
 *
 * The failure modes worth guarding are the quiet ones. Every assertion here
 * exists because breaking it produces a chapter that still RENDERS — no error,
 * no warning — while no longer demonstrating anything.
 */

const memoryStepCount = () =>
  CHAPTERS.find((c) => c.id === "memory")!.steps.length;

describe("the memory write is visible, not implied", () => {
  it("streams a Create_Newton_Memory_Item tool part before the assistant speaks", () => {
    const [turn] = turnsFor("memory");
    const chunks = buildChunks(turn);

    const toolInput = chunks.findIndex(
      (c) => c.type === "tool-input-available",
    );
    const toolOutput = chunks.findIndex(
      (c) => c.type === "tool-output-available",
    );
    const textStart = chunks.findIndex((c) => c.type === "text-start");

    expect(toolInput, "no tool call in the memory turn").toBeGreaterThanOrEqual(
      0,
    );
    // The claim the chapter makes is that you can WATCH it remember. A turn
    // whose text arrived first would still read fine and prove nothing.
    expect(toolOutput).toBeGreaterThan(toolInput);
    expect(textStart).toBeGreaterThan(toolOutput);

    const call = chunks[toolInput] as { toolName: string };
    // The AI SDK derives the rendered part type from this name; a typo renders
    // a generic tool card instead of the memory one.
    expect(call.toolName).toBe("Create_Newton_Memory_Item");
  });

  it("stores the corrected menu path the engineer actually supplied", () => {
    const [turn] = turnsFor("memory");
    const stored = turn.toolCalls[0].input as { information: string };
    const path = "HAUPTMENUE/Konfig/Inbetriebnahme/Kalibrierfahrt";

    // The correction, the memory written from it, and the knowledge item that
    // results must all carry the same path. Three places, one fact — and a
    // mismatch would be invisible on screen because each looks plausible alone.
    expect(MEMORY_CORRECTION_PROMPT).toContain(path);
    expect(stored.information).toContain(path);
    expect(CORRECTION_MEMORY.information).toContain(path);
  });
});

describe("the payoff is not spoiled before the visitor earns it", () => {
  it("hides the new memory until the correction has been sent", () => {
    // Asserted explicitly, not left to the loop below: with the gate at 0 that
    // loop has no iterations and passes while proving nothing. (Found by
    // falsification — setting the gate to 0 left this test green.)
    expect(
      MEMORY_WRITTEN_AT_STEP,
      "the reveal is ungated: the memory exists from step 0, so the visitor sees it before creating it",
    ).toBeGreaterThan(0);

    const atZero =
      getWorld({ chapter: "memory", step: 0 }).itemsByContext?.[
        MEMORY_CONTEXT_ID
      ] ?? [];
    expect(atZero.some((i) => i.id === CORRECTION_MEMORY.id)).toBe(false);
    expect(atZero.length).toBeGreaterThan(0);

    for (let step = 0; step < MEMORY_WRITTEN_AT_STEP; step++) {
      const items =
        getWorld({ chapter: "memory", step }).itemsByContext?.[
          MEMORY_CONTEXT_ID
        ] ?? [];
      expect(
        items.some((i) => i.id === CORRECTION_MEMORY.id),
        `step ${step} already shows the memory the visitor has not created yet`,
      ).toBe(false);
    }
  });

  it("shows it from the write step onward", () => {
    for (let step = MEMORY_WRITTEN_AT_STEP; step < memoryStepCount(); step++) {
      const items =
        getWorld({ chapter: "memory", step }).itemsByContext?.[
          MEMORY_CONTEXT_ID
        ] ?? [];
      expect(
        items.some((i) => i.id === CORRECTION_MEMORY.id),
        `step ${step} lost the memory that was just written`,
      ).toBe(true);
    }
  });

  it("keeps the reveal step aligned with the step that navigates to it", () => {
    // MEMORY_WRITTEN_AT_STEP and the tour's step list are edited in different
    // files. If they drift, the knowledge page either spoils the ending or
    // shows three items where the visitor was just told there are four.
    const revealIndex = CHAPTERS.find((c) => c.id === "memory")!.steps.findIndex(
      (s) => s.route.includes(MEMORY_CONTEXT_ID),
    );
    expect(revealIndex, "no step opens the memory knowledge base").toBeGreaterThan(
      -1,
    );
    expect(revealIndex).toBeGreaterThanOrEqual(MEMORY_WRITTEN_AT_STEP);
  });
});

describe("the conversation the correction answers is on screen", () => {
  it("opens mid-conversation, ending on the answer that gets corrected", () => {
    const scrollback = scrollbackFor("memory");
    expect(scrollback.length).toBeGreaterThan(0);

    const last = scrollback[scrollback.length - 1];
    expect(last.role).toBe("assistant");

    // The chapter's premise is an honest miss rather than a hallucination: the
    // assistant says the exact path is not in the excerpts. If the scrollback
    // ever ends somewhere else, the correction reads as arbitrary.
    const text = last.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    expect(text).toContain("nicht direkt als detaillierter Pfad");
    expect(text).not.toContain("HAUPTMENUE/Konfig/Inbetriebnahme");
  });

  it("keeps each chapter's scrollback to itself", () => {
    // Third position for this assertion, and worth recording because it has
    // gone back and forth: no scrollback when chapter 1 asked the visitor to
    // type, then scrollback from step 0 when it opened mid-exchange so that
    // clicking Next was enough, and now empty at step 0 again — the tour types
    // the question itself and the answer streams, which is the flow a visitor
    // needs to see and neither earlier version showed.
    //
    // From step 1 the scrollback is present, because those steps anchor to
    // parts of the answer and must survive a deep link or a Tour-menu jump.
    // The step-0 case is asserted below.
    //
    // What has held throughout: the two chapters must not bleed into each other.
    const techdoc = scrollbackFor("techdoc", 1);
    const memory = scrollbackFor("memory", 0);

    expect(
      scrollbackFor("techdoc", 0),
      "the step that types its own question must open on an empty conversation",
    ).toEqual([]);

    expect(techdoc.length).toBeGreaterThan(0);
    expect(memory.length).toBeGreaterThan(0);

    const textOf = (messages: typeof techdoc) =>
      messages
        .flatMap((m) => m.parts)
        .map((p) => (p.type === "text" ? p.text : ""))
        .join(" ");

    expect(textOf(techdoc)).toContain("Nothalt COP");
    expect(textOf(techdoc)).not.toContain("Kalibrierfahrt");
    expect(textOf(memory)).not.toContain("Nothalt COP");
  });

  it("puts the correction on screen only once the chapter reaches it", () => {
    // Before the correction step the visitor must see the assistant failing to
    // find the menu path — that failure is what the chapter is about. From the
    // step that narrates the memory write onwards, the exchange is present
    // whether or not the visitor typed it, so the tool call that step anchors
    // to exists either way.
    const before = scrollbackFor("memory", MEMORY_WRITTEN_AT_STEP - 1);
    const after = scrollbackFor("memory", MEMORY_WRITTEN_AT_STEP);

    const hasMemoryToolCall = (messages: typeof before) =>
      messages.some((m) =>
        m.parts.some((p) => p.type === "tool-Create_Newton_Memory_Item"),
      );

    expect(hasMemoryToolCall(before)).toBe(false);
    expect(hasMemoryToolCall(after)).toBe(true);
    expect(after.length).toBeGreaterThan(before.length);
  });
});

describe("the knowledge base behind the reveal actually answers", () => {
  it("resolves the generated per-context operation for the memory context", async () => {
    // /data/[ctx] GENERATES `query <ctx>Pagination` at runtime, and the
    // response field is `<ctx>_itemsPagination` — the names differ. Getting
    // that wrong renders the page's empty state rather than an error.
    const data = await runDemoOperation(gql`
      query newton_memory_contextPagination {
        newton_memory_context_itemsPagination {
          pageInfo { itemCount }
          items { id name }
        }
      }
    `);
    const wrapper = data[`${MEMORY_CONTEXT_ID}_itemsPagination`] as {
      pageInfo: unknown;
      items: unknown[];
    };
    expect(wrapper, "memory context pagination unanswered").toBeTruthy();
    expect(wrapper.pageInfo).toBeTruthy();
    expect(wrapper.items.length).toBeGreaterThan(0);
  });

  it("still warns for operations that merely look generated", async () => {
    // The dynamic matcher is deliberately gated on real context ids. Without
    // that gate any `<something>Pagination` would resolve silently, and the
    // unmapped-operation warning is what has caught every missing resolver.
    await expect(
      runDemoOperation(gql`
        query totally_made_upPagination {
          totally_made_up_itemsPagination {
            items { id }
          }
        }
      `),
    ).rejects.toThrow(/unmapped/);
  });
});

describe("the chat route can serve the chapter", () => {
  it("returns the scrollback as JSON strings, newest-first when asked", async () => {
    const data = await runDemoOperation(
      gql`
        query GetAgentSessionMessages {
          agent_messagesPagination {
            items { id content }
          }
        }
      `,
      {
        filters: { session: { eq: MEMORY_SESSION_ID } },
        sort: { field: "createdAt", direction: "DESC" },
      },
    );
    const items = (
      data.agent_messagesPagination as { items: { content: string }[] }
    ).items;
    expect(items.length).toBeGreaterThan(0);

    // The page does JSON.parse(item.content) and then .reverse(). Returning
    // objects throws; returning ASC order renders the conversation backwards.
    const parsed = items.map((i) => JSON.parse(i.content));
    expect(parsed[0].role).toBe("assistant");
    expect(parsed[parsed.length - 1].role).toBe("user");
  });

  it("does not hand another session's history to it", async () => {
    const data = await runDemoOperation(
      gql`
        query GetAgentSessionMessages {
          agent_messagesPagination {
            items { id }
          }
        }
      `,
      { filters: { session: { eq: "some-other-session" } } },
    );
    expect(
      (data.agent_messagesPagination as { items: unknown[] }).items,
    ).toHaveLength(0);
  });
});

describe("the tour can reach every step", () => {
  it("resolves each memory step to a definition with a route", () => {
    for (let step = 0; step < memoryStepCount(); step++) {
      const resolved = resolveStep(CHAPTERS, { chapter: "memory", step });
      expect(resolved, `memory step ${step} does not resolve`).toBeTruthy();
      expect(resolved!.route).toMatch(/^\//);
    }
  });
});
