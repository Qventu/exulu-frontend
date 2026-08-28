import type { UIMessage } from "ai";

import type { Routine } from "@/app/(application)/workflows/types";
import type { RoutineRun } from "@/lib/routine-runs/types";
import type { Agent } from "@/types/models/agent";

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
    "Beantwortet Ersatzteilanfragen zu ALGI Hydraulikhebern und erstellt " +
    "Angebote aus dem Ersatzteilkatalog.",
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
 * The allowlist is the load-bearing part for the chapter. `*@algi-hydraulic.de`
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
    allowed_senders: ["*@algi-hydraulic.de"],
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
export const ALGI_RUNS: RoutineRun[] = (
  RAW_RUNS as Array<Record<string, unknown>>
).map((run) => ({
  ...(run as unknown as RoutineRun),
  workflow: ALGI_ROUTINE_ID,
  workflowName: ALGI_ROUTINE.name,
  agent: ALGI_AGENT_ID,
}));

/** The scripted-quote session, redacted. See build-algi-session-fixture.py. */
export const ALGI_SESSION_MESSAGES = RAW_SESSION as unknown as UIMessage[];

export const ALGI_SESSION_ID = "2963f8bc-92e3-4ed9-9e74-80603227f9d8";

/** Runs awaiting a human — what the sidebar's attention badge counts. */
export const ALGI_RUNS_NEEDING_ATTENTION = ALGI_RUNS.filter(
  (run) => run.state === "waiting_approval",
).length;
