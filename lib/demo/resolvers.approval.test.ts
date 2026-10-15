import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  GET_AGENT_BY_ID,
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
  GET_AGENT_SESSIONS,
} from "@/app/(application)/chat/queries";

import { DEMO_AGENT_ID } from "./fixtures";
import {
  ALGI_AGENT_ID,
  ALGI_APPROVAL_ID,
  ALGI_APPROVAL_TOOL,
  ALGI_RUNS,
  ALGI_SESSION_ID,
  quoteDraftFrom,
} from "./fixtures/chapter-email";
import { ALGI_CHAT } from "./routes";
import { runDemoOperation as run, runDemoQueryThroughCache } from "./test-support";
import { CHAPTERS } from "./tour";

const AT = { chapter: "email", step: 3 } as const;

const sessionsFor = (agent: string) =>
  run(GET_AGENT_SESSIONS, { page: 1, limit: 20, filters: { agent: { eq: agent } } }, AT);

describe("chapter 9 opens the waiting run's session on a pending approval", () => {
  it("shows exactly one run waiting, and it is the scripted session's", () => {
    const waiting = ALGI_RUNS.filter((r) => r.state === "waiting_approval");
    expect(waiting).toHaveLength(1);
    expect(waiting[0].session).toBe(ALGI_SESSION_ID);
    // The export's distribution survives the state swap.
    const count = (state: string) => ALGI_RUNS.filter((r) => r.state === state).length;
    expect([count("completed"), count("failed"), count("filtered"), count("waiting_approval")]).toEqual([14, 8, 2, 1]);
  });

  it("resolves ALFREDO by id with every field the chat page selects, and its session", async () => {
    const agent = await runDemoQueryThroughCache(GET_AGENT_BY_ID, { id: ALGI_AGENT_ID }, AT);
    expect((agent.agentById as { id: string }).id).toBe(ALGI_AGENT_ID);
    const session = await run(GET_AGENT_SESSION_BY_ID, { id: ALGI_SESSION_ID }, AT);
    expect((session.agent_sessionById as { id: string; agent: string }).agent).toBe(ALGI_AGENT_ID);
  });

  it("lists each agent's own sessions only — ALFREDO's rail shows the open one, not Newton's", async () => {
    const ids = (data: Record<string, unknown>) =>
      (data.agent_sessionsPagination as { items: { id: string }[] }).items.map((s) => s.id);
    expect(ids(await sessionsFor(ALGI_AGENT_ID))).toEqual([ALGI_SESSION_ID]);
    const newton = ids(await sessionsFor(DEMO_AGENT_ID));
    expect(newton.length).toBeGreaterThan(0);
    expect(newton).not.toContain(ALGI_SESSION_ID);
  });

  it("serves the stored session ending on an approval-requested tool part", async () => {
    const data = await run(
      GET_AGENT_MESSAGES,
      { page: 1, limit: 50, sort: { field: "createdAt", direction: "DESC" }, filters: { session: { eq: ALGI_SESSION_ID } } },
      AT,
    );
    const items = (data.agent_messagesPagination as { items: { content: string }[] }).items;
    expect(items).toHaveLength(15);
    // DESC: the first row is the conversation's last message.
    const newest = JSON.parse(items[0].content) as UIMessage;
    expect(newest.role).toBe("assistant");
    const last = newest.parts[newest.parts.length - 1] as {
      type: string; state: string; approval?: { id: string }; output?: unknown;
      input: { subject: string; to: string; body: string };
    };
    expect(last.type).toBe(`tool-${ALGI_APPROVAL_TOOL}`);
    expect(last.state).toBe("approval-requested");
    expect(last.approval?.id).toBe(ALGI_APPROVAL_ID);
    expect(last.output).toBeUndefined();
    expect(last.input.body).toMatch(/^\*\*Subject: RE: Price and delivery time 2658446/);
  });

  it("takes the draft from after the rule, not the acknowledgement before it", () => {
    expect(quoteDraftFrom("Danke.\n\n***\n\n**Subject: x**\n\nDear")).toBe("**Subject: x**\n\nDear");
    expect(quoteDraftFrom("no rule")).toBe("no rule");
  });

  it("is the chapter's last step, after the runs list that announces it", () => {
    const steps = CHAPTERS.find((c) => c.id === "email")!.steps;
    expect(steps.map((s) => s.id)).toEqual(["email-routine", "email-trigger", "email-runs", "email-approval"]);
    expect(steps[3].route).toBe(ALGI_CHAT);
    expect(steps[3].anchor).toBe("chat-tool-approval");
  });
});
