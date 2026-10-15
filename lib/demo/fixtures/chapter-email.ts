import type { UIMessage } from "ai";

import type { Routine } from "@/app/(application)/workflows/types";
import type { RoutineRun } from "@/lib/routine-runs/types";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

import { DEMO_USER_ID } from "../user";

import RAW_RUNS from "./algi-runs.json";
import RAW_SESSION from "./algi-session.json";

/**
 * Chapter 6 — the assistant working while nobody watches.
 *
 * This is ALGI, not Newlift: a second deployment of the same platform, which
 * is the point of putting it in the tour. The first five chapters are one
 * customer's technical documentation; this one is a different customer, a
 * different industry problem, and the same product underneath.
 *
 * Everything here is real, read from ALGI's deployment: the routine, its email
 * trigger, twenty-five runs of it, and one complete session from inbound mail
 * to finished quote. What was redacted, and why, is recorded in
 * scripts/build-algi-runs-fixture.py and build-algi-session-fixture.py — the
 * transforms are committed next to their output so the decisions are
 * reviewable rather than asserted.
 *
 * THE SESSION IS THE CHAPTER. It would have been enough to show mail arriving
 * and a quote leaving, but the real trace is better than that: the assistant
 * searches the parts catalogue, drafts a quote, and is then CORRECTED three
 * times by a salesperson — always offer the piston ring with 113139, always
 * include our commission number, that type designation is wrong — and writes
 * each correction to memory as it goes. Chapter 4 argues that correcting the
 * assistant is a first-class operation. This is that argument happening in
 * someone's actual inbox, months before we wrote the chapter.
 */

/** ALFREDO_2, the spare-parts specialist the routine runs as. */
export const ALGI_AGENT_ID = "22d0fac2-1544-4175-aca5-7cd30626740b";

export const ALGI_ROUTINE_ID = "cc20b030-24b1-494a-9f3d-390c075916b7";

/** The run whose session chapter 6 opens: inbound mail through to the quote. */
export const ALGI_SESSION_RUN_ID = "2963f8bc-92e3-4ed9-9e74-80603227f9d8";

export const ALGI_AGENT: Agent = {
  id: ALGI_AGENT_ID,
  type: "agent",
  name: "ALFREDO_2 - Der clevere Ersatzteilspezialist",
  slug: "alfredo-ersatzteile",
  description:
    "Beantwortet Ersatzteilanfragen zu AHT Hydraulikhebern und erstellt " +
    "Angebote aus dem Ersatzteilkatalog.",
  category: "assistant",
  model: "gemini-3.1-pro",
  modelName: "gemini-3.1-pro",
  providerName: "Google",
  welcomemessage: "",
  active: true,
  defaultagent: false,
  feedback: true,
  suggestions_enabled: false,
  sandbox_enabled: false,
  instructions: "",
  rights_mode: "public",
};

export const ALGI_ROUTINE: Routine = {
  id: ALGI_ROUTINE_ID,
  name: "Ersatzteil Angebot",
  description: null,
  agent: ALGI_AGENT_ID,
  agentName: ALGI_AGENT.name,
  // Its own queue, which is the shape of the claim: inbound mail does not
  // compete with interactive chat for workers.
  queue: "mail_processing_queue",
  created_by: 11,
  rights_mode: "public",
  RBAC: { type: "public", users: [], roles: [], teams: [] },
  variables: null,
  steps_json: null,
  createdAt: "2026-06-11T08:14:02.000Z",
  updatedAt: "2026-08-26T09:31:24.529Z",
  lastRun: { state: "completed", createdAt: "2026-08-26T09:31:24.529Z" },
  schedule: null,
};

/**
 * The live trigger configuration, verbatim apart from the secrets, which were
 * never read: workflow_triggers also stores `secret` and `signing_secret`, and
 * those columns were excluded from the export rather than pulled and stripped.
 *
 * The allowlist is the load-bearing part for the chapter. `*@aht-hydraulik.example`
 * is why the two IONOS notifications in the runs below are `filtered` rather
 * than processed — real noise, correctly refused.
 */
export const ALGI_EMAIL_TRIGGER = {
  id: "7244a58b-bd97-4f1c-8857-b7d46fae95e0",
  workflow: ALGI_ROUTINE_ID,
  type: "email",
  enabled: true,
  config: {
    filters: [] as unknown[],
    allowed_senders: ["*@aht-hydraulik.example"],
    rate_limit_per_hour: 60,
    sender_rate_limit_per_hour: 10,
    filtered_run_retention: 200,
  },
  last_fired_at: "2026-08-26T09:31:24.529Z",
  run_as_user: 11,
  has_webhook: true,
  has_signing_secret: true,
  webhook_url: null,
};

/**
 * Twenty-five real runs. The distribution is the reason to use real data:
 * fourteen completed, eight failed, two filtered and one waiting on approval.
 * A fixture written by hand would have been all green, and a prospect who has
 * ever run an inbox integration would not have believed it.
 */
/**
 * Which run is shown waiting. The export has one run in `waiting_approval`
 * (0ffccf21, "WG: DEMANDE DE DEVIS"), and the scripted session below belongs
 * to a different, completed run (f74bb00b, "WG: Price and delivery time
 * 2658446"). Chapter 9 opens the scripted session on a pending approval, so
 * the two rows swap STATE here: the session's run is the one waiting, the
 * French request the one completed. Every other field stays as exported and
 * the distribution the comment above describes is unchanged. Done in the
 * mapping, not in algi-runs.json, so the export stays the export.
 */
const APPROVAL_RUN_ID = "f74bb00b-fd2f-4a7f-8d51-7215a35bc8c2";
const EXPORTED_WAITING_RUN_ID = "0ffccf21-78c0-42fe-9c63-3b613ab96d4a";

const shownState = (run: RoutineRun): string =>
  run.id === APPROVAL_RUN_ID
    ? "waiting_approval"
    : run.id === EXPORTED_WAITING_RUN_ID
      ? "completed"
      : run.state;

export const ALGI_RUNS: RoutineRun[] = (
  RAW_RUNS as Array<Record<string, unknown>>
).map((raw) => {
  const run = raw as unknown as RoutineRun;
  return {
    ...run,
    state: shownState(run),
    workflow: ALGI_ROUTINE_ID,
    workflowName: ALGI_ROUTINE.name,
    agent: ALGI_AGENT_ID,
  };
});

/** The scripted-quote session, redacted. See build-algi-session-fixture.py. */
export const ALGI_SESSION_MESSAGES = RAW_SESSION as unknown as UIMessage[];

export const ALGI_SESSION_ID = "2963f8bc-92e3-4ed9-9e74-80603227f9d8";

/** The scripted session as the chat route's GetAgentSessionById sees it. */
export const ALGI_SESSION: AgentSession = {
  id: ALGI_SESSION_ID,
  agent: ALGI_AGENT_ID,
  project: "demo-project",
  // The inbound mail's subject — the first thing on screen above the thread.
  title: "WG: Price and delivery time 2658446",
  metadata: null,
  // The routine ran as user 11, but the composer goes read-only for anyone
  // but the creator of a private session (lib/check-chat-session-write-access),
  // and a read-only notice above an approval card would contradict the card.
  created_by: DEMO_USER_ID,
  session_items: [],
  rights_mode: "private",
  createdAt: "2026-08-18T07:21:19.544Z",
  updatedAt: "2026-08-18T09:12:40.000Z",
};

/**
 * The part that puts chapter 9 on a pending approval. Shape per the AI SDK's
 * DynamicToolUIPart union (node_modules/ai/dist/index.d.ts, the member with
 * state 'approval-requested'): `input` present, no `output`, `approval.id`
 * set — ToolCallApproval renders nothing without the id. Message 9 of this
 * session carries the same `approval` object in its responded form.
 */
export const ALGI_APPROVAL_TOOL = "Send_Email_Reply";
export const ALGI_APPROVAL_ID = "aitxt-Q7mVd2sK9pLx0wE4rTn1bYcH";

/** The corrected quote: everything after the first rule in the assistant's last message. */
export function quoteDraftFrom(text: string): string {
  const rule = text.indexOf("***");
  return (rule === -1 ? text : text.slice(rule + 3)).trim();
}

const lastMessage = ALGI_SESSION_MESSAGES[ALGI_SESSION_MESSAGES.length - 1];
const lastTextPart = lastMessage.parts.find((part) => part.type === "text");
const lastText = lastTextPart && "text" in lastTextPart ? lastTextPart.text : "";

export const ALGI_APPROVAL_PART = {
  type: `tool-${ALGI_APPROVAL_TOOL}`,
  toolCallId: "call_3104__send_email_reply",
  state: "approval-requested",
  // `subject` first: the card's summary shows the first short string value.
  input: {
    subject:
      "RE: Price and delivery time 2658446 - Cylinder packing seal for HKB 110 (Commission No. G58301)",
    to: "⟨Kundenkontakt⟩",
    body: quoteDraftFrom(lastText),
  },
  approval: { id: ALGI_APPROVAL_ID },
};

/**
 * The session as chapter 9 shows it: the assistant that has just taken the
 * third correction asks to send the corrected quote. The export ends on the
 * acknowledgement; the ask is the one part added to its last message.
 */
export const ALGI_APPROVAL_MESSAGES: UIMessage[] = [
  ...ALGI_SESSION_MESSAGES.slice(0, -1),
  {
    ...lastMessage,
    parts: [...lastMessage.parts, ALGI_APPROVAL_PART as unknown as UIMessage["parts"][number]],
  },
];

/** Runs awaiting a human — what the sidebar's attention badge counts. */
export const ALGI_RUNS_NEEDING_ATTENTION = ALGI_RUNS.filter(
  (run) => run.state === "waiting_approval",
).length;
