import { CONTEXT_SEARCH_TOOL, AGENTIC_RETRIEVAL_TOOL } from "./fixtures/agent-editor";
import {
  ALGI_AGENT,
  ALGI_AGENT_ID,
  ALGI_APPROVAL_MESSAGES,
  ALGI_EMAIL_TRIGGER,
  ALGI_ROUTINE,
  ALGI_RUNS,
  ALGI_RUNS_NEEDING_ATTENTION,
  ALGI_SESSION,
  ALGI_SESSION_ID,
} from "./fixtures/chapter-email";
import {
  ALGI_MEETINGS,
  ALGI_MEETING_ID,
  GENERATED_GUIDE_OUTPUT,
  TRANSCRIPT_EXCERPT,
  type MeetingRecording,
} from "./fixtures/chapter-meetings";
import {
  allocateSpend,
  KOSTEN_MONTHLY_SPEND,
  KOSTEN_TEAMS,
} from "./fixtures/chapter-kosten";
import { MEMORY_CONTEXT_ID, MEMORY_CONTRIBUTORS, MEMORY_SESSION_ID } from "./fixtures/chapter-memory";
import { memoryMapPoints, MEMORY_TOPICS, topicOf } from "./fixtures/memory-examples";
import { demoDateOffsetMs, shiftTimestamp } from "./date-shift";
import { TECHDOC_SESSION_ID } from "./fixtures/chapter-techdoc";
import { CONTEXTS } from "./fixtures/contexts";
import { DEMO_ROLES, ROLE_TECHNIKER_ID } from "./fixtures/roles";
import { scrollbackFor } from "./current-position";
import {
  EVAL_JOB_RESULTS,
  EVAL_RUNS,
  EVAL_SETS,
  TEST_CASES,
} from "./fixtures/evals";
import {
  MEMORY_SCROLLBACK,
  MEMORY_SCROLLBACK_ROWS,
} from "./fixtures/memory-turns";
import { DEMO_USER_ID } from "./user";
import type { DemoWorld } from "./types";

/**
 * The single demo resolver table, shared by BOTH transports:
 *
 *   - createDemoLink            → client-side Apollo
 *   - fetchGraphQLServerSide    → server components
 *
 * Sharing matters. Detail routes (agents/edit/[id], chat/[agent]/*,
 * workflows/[id], prompts/[id], data/[ctx]) fetch on the server, index routes
 * fetch on the client. An earlier attempt gave the demo its own parallel pages
 * for the server-rendered ones, which meant maintaining a second copy of every
 * detail screen — duplication that drifts from the product and undermines the
 * point of rendering the real thing. One table behind both transports means a
 * chapter works on the product's own route regardless of where it fetches.
 *
 * Keys MUST be the operation names in the product's own gql documents.
 * apollo-link.operations.test.ts imports those documents and asserts coverage,
 * so a renamed or reshaped query fails at test time rather than silently
 * emptying a chapter.
 */

export type DemoResolver = (
  world: DemoWorld,
  variables: Record<string, unknown>,
) => Record<string, unknown>;

const KNOWN_CONTEXT_IDS = new Set(CONTEXTS.map((c) => c.id));

/**
 * Mirrors the backend's checkMemoryBase (src/exulu/memory/memory-base.ts): a
 * context can serve as an agent's memory store when it has an `information`
 * text field and a `type` enum with values. Computed from each context's own
 * `fields` array — the same source Task 14's workbench picker reasons from —
 * rather than stored as a separate fixture flag that could drift from it.
 */
const MEMORY_BASE_TEXT_TYPES = new Set(["text", "longText"]);
function checkMemoryBase(context: {
  fields?: { name: string; type: string; enumValues?: string[] | null }[];
}): { ok: boolean; missing: string[] } {
  const fields = context.fields ?? [];
  const missing: string[] = [];
  const information = fields.find((f) => f.name === "information");
  if (!information || !MEMORY_BASE_TEXT_TYPES.has(information.type)) missing.push("information");
  const type = fields.find((f) => f.name === "type");
  if (!type || type.type !== "enum" || !type.enumValues?.length) missing.push("type");
  return { ok: missing.length === 0, missing };
}

/**
 * Each team's slice of KOSTEN_MONTHLY_SPEND, allocated by `share` — the same
 * allocateSpend the REST fixture (rest-fixtures.ts) uses for /analytics'
 * byTag rows, but against a DIFFERENT total: /analytics allocates its
 * chosen window's own sum, while /budgets (no date window) allocates this
 * fixed monthly constant. Computed once at module scope rather than per
 * call: it never varies with variables or world state, and a per-call
 * recompute would risk two call sites' rounding drifting apart even though
 * allocateSpend is deterministic today.
 *
 * This is what /budgets' GetTeamsWithBudgets reads instead of a literal 0 —
 * a literal made every team's projected usage 0%, which silently emptied
 * the budgets-at-risk section and put /budgets and /analytics in direct
 * disagreement about the same three teams' spend.
 */
const KOSTEN_TEAM_SPEND = allocateSpend(
  KOSTEN_MONTHLY_SPEND,
  KOSTEN_TEAMS.map((team) => team.share),
);

type CatalogueOptions = {
  type?: "chat" | "embedding" | "ocr" | "rerank";
  cost?: { input: number | null; output: number | null };
  limits?: { input: number | null; output: number | null };
  tags: string[];
  vision?: boolean;
  pdf?: boolean;
  audio?: boolean;
  tools?: boolean;
};

/**
 * One row of the LiteLLM catalogue, with every field GetLiteLLMCatalog and
 * GetAgentLiteLLMCatalog select (the two documents are identical). All of
 * them, because Apollo does not fail an incomplete cache write — it logs a
 * console.error per missing field and falls back to the raw network result.
 * Costs are per million tokens and EXAMPLE figures — chapter 11 says so on
 * screen; a null cost renders no badge (the router, the self-hosted model,
 * the utilities). `region` is the literal "eu" because ProviderLogo's EU
 * pill keys on that; provider and region are the row's tags.
 */
// `brand` is the logo file's stem (/public/ai/logos/light/<brand>.png — lowercase,
// and the demo host's file system is case-sensitive); null renders the
// Sparkles fallback, which is what the router gets.
const litellmModel = (name: string, upstream: string, brand: string | null, o: CatalogueOptions): Record<string, unknown> => ({
  __typename: "LiteLLMModel",
  model_name: name,
  active: true,
  upstream_model: upstream,
  type: o.type ?? "chat",
  tags: o.tags,
  brand,
  region: "eu",
  max_tokens: o.limits?.output ?? null,
  max_input_tokens: o.limits?.input ?? null,
  max_output_tokens: o.limits?.output ?? null,
  supports_vision: o.vision ?? false,
  supports_function_calling: o.tools ?? false,
  supports_pdf_input: o.pdf ?? false,
  supports_audio_input: o.audio ?? false,
  input_cost_per_million_tokens: o.cost?.input ?? null,
  output_cost_per_million_tokens: o.cost?.output ?? null,
});

const VERTEX = ["vertex", "europe-west3"];
const BEDROCK = ["bedrock", "eu-central-1"];
const AZURE = ["azure", "germanywestcentral"];
const GEMINI = { vision: true, pdf: true, audio: true, tools: true, limits: { input: 1048576, output: 65536 } };
const CLAUDE = { vision: true, pdf: true, tools: true, limits: { input: 1048576, output: 128000 } };

/**
 * What this deployment offers: the breadth marketing asked for (2026-10-15)
 * — chat models from four vendors over three clouds, a self-hosted
 * open-weight model, an auto-router, and the embedding, OCR and rerank
 * utilities an agent's pipeline uses. The agent's own model
 * (gemini-3.1-pro) and the eval judge (claude-sonnet-4-6) stay in it; the
 * agent editor's selector sees the chat rows only.
 */
const LITELLM_CATALOGUE = [
  litellmModel("gemini-3.1-pro", "vertex_ai/gemini-3.1-pro", "google", { ...GEMINI, cost: { input: 2, output: 12 }, tags: VERTEX }),
  litellmModel("gemini-3.1-flash", "vertex_ai/gemini-3.1-flash", "google", { ...GEMINI, cost: { input: 0.3, output: 2.5 }, tags: VERTEX }),
  litellmModel("gemini-3.1-flash-lite", "vertex_ai/gemini-3.1-flash-lite", "google", { ...GEMINI, cost: { input: 0.25, output: 1.5 }, tags: VERTEX }),
  litellmModel("gemini-2.5-pro", "vertex_ai/gemini-2.5-pro", "google", { ...GEMINI, cost: { input: 1.25, output: 10 }, tags: VERTEX }),
  litellmModel("gemini-2.5-flash", "vertex_ai/gemini-2.5-flash", "google", { ...GEMINI, audio: false, cost: { input: 0.3, output: 2.5 }, tags: VERTEX }),
  litellmModel("claude-opus-5", "vertex_ai/claude-opus-5", "anthropic", { ...CLAUDE, cost: { input: 15, output: 75 }, tags: VERTEX }),
  litellmModel("claude-sonnet-5", "vertex_ai/claude-sonnet-5", "anthropic", { ...CLAUDE, cost: { input: 3, output: 15 }, tags: VERTEX }),
  litellmModel("claude-sonnet-4-6", "vertex_ai/claude-sonnet-4-6", "anthropic", { ...CLAUDE, limits: { input: 200000, output: 64000 }, cost: { input: 3, output: 15 }, tags: VERTEX }),
  litellmModel("claude-haiku-4-5", "bedrock/anthropic.claude-haiku-4-5", "anthropic", { ...CLAUDE, limits: { input: 200000, output: 64000 }, cost: { input: 1, output: 5 }, tags: BEDROCK }),
  litellmModel("mistral-medium-3", "vertex_ai/mistral-medium-3", "mistral", { vision: true, pdf: true, tools: true, limits: { input: 131072, output: 8192 }, cost: { input: 0.4, output: 2 }, tags: VERTEX }),
  litellmModel("gpt-5-mini", "azure/gpt-5-mini", "openai", { vision: true, pdf: true, tools: true, limits: { input: 400000, output: 128000 }, cost: { input: 0.25, output: 2 }, tags: AZURE }),
  litellmModel("qwen3-235b", "openai/qwen3-235b", "qwen", { tools: true, limits: { input: 262144, output: 16384 }, tags: ["self-hosted", "vllm"] }),
  litellmModel("auto-router", "auto", null, { vision: true, pdf: true, audio: true, tools: true, tags: ["auto-router"] }),
  litellmModel("gemini-embedding-001", "vertex_ai/gemini-embedding-001", "google", { type: "embedding", limits: { input: 2048, output: null }, cost: { input: 0.15, output: null }, tags: VERTEX }),
  litellmModel("vertex-ocr", "vertex_ai/document-ocr", "google", { type: "ocr", tags: VERTEX }),
  litellmModel("cohere-rerank-v4", "bedrock/cohere.rerank-v4", "cohere", { type: "rerank", limits: { input: 32768, output: 32768 }, tags: BEDROCK }),
];

/**
 * A recording as /transcriptions selects it. The nulls are the fields dropped
 * at export (storage key, join link, bot and whisper ids) — see
 * scripts/build-algi-meetings-fixture.py.
 */
const transcriptionJob = (meeting: MeetingRecording) => ({
  id: meeting.id,
  audio_s3key: null,
  title: meeting.title,
  status: meeting.status,
  whisper_job_id: null,
  language: meeting.language,
  duration_seconds: meeting.duration_seconds,
  speakers: {},
  project_id: null,
  target_rights_mode: "public",
  target_rbac_users: [],
  target_rbac_roles: [],
  saved_item_id: null,
  error: null,
  rights_mode: "public",
  created_by: DEMO_USER_ID,
  createdAt: meeting.createdAt,
  updatedAt: meeting.updatedAt,
  source: meeting.source,
  meeting_url: null,
  recall_bot_id: null,
  // Dropped at export like meeting_url/recall_bot_id (build-algi-meetings-fixture.py)
  // — it's a Recall-side id, not transcript content, and every recording here
  // is long finished, so there's nothing an on-demand video fetch would resolve.
  recall_recording_id: null,
  bot_status: meeting.bot_status,
  // Scheduled join time for a bot that has not dialled in yet. Null for every
  // recording here because all twenty have already run — and omitting it cost one
  // Apollo error per row, twenty on first paint, which is how this was found.
  join_at: null,
  post_processing_prompts: [],
  // Only the meeting chapter 7 opens carries a generated document. The other
  // twenty-seven have none, which is true of ALGI's deployment today — the
  // capability ships, they have not run it. Attaching a guide to all of them
  // would claim they had.
  post_processing_outputs:
    meeting.id === ALGI_MEETING_ID ? [GENERATED_GUIDE_OUTPUT] : null,
  // ALGI does not run with RECALL_STORE_VIDEO_LOCALLY on — every recording
  // here would show the on-demand "Load video" path in a real deployment,
  // and recall_recording_id above already being null (see comment) means
  // even that fetch would return nothing, so no video UI renders at all.
  video_s3key: null,
  // Live recording fields — ALGI meetings are all finished (status: "saved" or
  // earlier terminal states), so these chunk-tracking fields are always null.
  chunk_count: null,
  last_chunk_at: null,
});

/** The routine as the list and detail screens select it. */
const routineItem = () => ({
  id: ALGI_ROUTINE.id,
  agent: ALGI_ROUTINE.agent,
  queue: ALGI_ROUTINE.queue,
  name: ALGI_ROUTINE.name,
  description: ALGI_ROUTINE.description,
  rights_mode: ALGI_ROUTINE.rights_mode,
  created_by: ALGI_ROUTINE.created_by,
  steps_json: ALGI_ROUTINE.steps_json,
  variables: ALGI_ROUTINE.variables,
  createdAt: ALGI_ROUTINE.createdAt,
  updatedAt: ALGI_ROUTINE.updatedAt,
  // ROUTINES_RBAC_TEAMS_SUPPORTED is false, so `teams` is not selected and is
  // deliberately absent — answering it would be harmless, but omitting a
  // field that IS selected is the error this file keeps making.
  RBAC: { type: "public", users: [], roles: [] },
});

/** Every *Pagination selection includes pageInfo; the tables read it. */
const page = (itemCount: number) => ({
  pageCount: 1,
  itemCount,
  currentPage: 1,
  hasPreviousPage: false,
  hasNextPage: false,
});

/**
 * A fixture agent as an /agents index row: every field the index's
 * AGENT_LIST_FIELDS selects, defaulted to null where the fixture is silent.
 */
const agentListRow = (agent: DemoWorld["agents"][number]) => ({
  description: null,
  image: null,
  animation_idle: null,
  animation_responding: null,
  modelName: null,
  providerName: null,
  category: null,
  rights_mode: null,
  updatedAt: null,
  ...agent,
  active: agent.active ?? true,
});

/**
 * Pulls an eval_set_id out of the product's filter argument shape, which is a
 * list of `{ field: { operator: value } }`-ish entries rather than a flat map.
 * Returns null when unfiltered.
 */
function evalSetIdFrom(variables: Record<string, unknown>): string | null {
  const filters = variables?.filters;
  if (!Array.isArray(filters)) return null;
  for (const filter of filters) {
    const candidate = (filter as { eval_set_id?: unknown })?.eval_set_id;
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = Object.values(candidate as Record<string, unknown>).find(
        (v) => typeof v === "string",
      );
      if (typeof nested === "string") return nested;
    }
  }
  return null;
}

/** Reads a `{ field: { eq: value } }`-style filter argument. */
function filterValue(
  variables: Record<string, unknown>,
  field: string,
): string | null {
  const filters = variables?.filters;
  const list = Array.isArray(filters) ? filters : filters ? [filters] : [];
  for (const filter of list) {
    const candidate = (filter as Record<string, unknown>)?.[field];
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = Object.values(candidate as Record<string, unknown>).find(
        (v) => typeof v === "string",
      );
      if (typeof nested === "string") return nested;
    }
  }
  return null;
}

/**
 * The scripted conversation history, as `agent_messages` rows. Only chapter
 * 4's session has scrollback; every other session opens empty and the whole
 * conversation is streamed live by DemoChatTransport.
 */
function scrollbackRows(world: DemoWorld, variables: Record<string, unknown>) {
  // The session in the path decides which conversation this is, so the real
  // chat route needs to know nothing about the tour. Chapter 1 opens on the
  // techdoc session and chapter 5 on the memory one.
  const sessionId = filterValue(variables, "session");

  // Chapter 9's session is not a scripted exchange but a stored one: fifteen
  // messages from another deployment, ending on a pending approval. Served
  // whole, whatever the step.
  if (sessionId === ALGI_SESSION_ID) {
    return ALGI_APPROVAL_MESSAGES.map((message, index) => ({
      id: `${sessionId}-scrollback-${index}`,
      session: sessionId,
      createdAt: new Date(0).toISOString(),
      content: JSON.stringify(message),
    }));
  }

  const chapter =
    sessionId === MEMORY_SESSION_ID
      ? "memory"
      : sessionId === TECHDOC_SESSION_ID || !sessionId
        ? "techdoc"
        : null;
  if (!chapter) return [];

  // Step-scoped, not just chapter-scoped. Chapter 5's correction is the
  // visitor's to send and the transport replays it when they do — but the step
  // that anchors to the memory tool call has to work for someone who only
  // clicks Next, so from that step on the exchange is present whether they
  // typed it or not. Same threshold as the knowledge item in
  // fixtures/chapter-memory.ts. Chapter 1's scrollback does not vary by step.
  const messages = scrollbackFor(chapter, world.position?.step ?? 0);

  return messages.map((message, index) => ({
    // Real ids and timestamps where the export captured them. The memory rows
    // run out once the correction exchange extends past the base scrollback,
    // and chapter 1 has no row export at all — both fall back to a synthesised
    // row. Only `content` is read by the page; the rest must simply be present
    // and distinct, since an absent selected field is an Apollo cache error.
    ...(chapter === "memory" && MEMORY_SCROLLBACK_ROWS[index]
      ? MEMORY_SCROLLBACK_ROWS[index]
      : {
          id: `${sessionId ?? chapter}-scrollback-${index}`,
          session: sessionId ?? TECHDOC_SESSION_ID,
          createdAt: new Date(0).toISOString(),
        }),
    content: JSON.stringify(message),
  }));
}

/**
 * The agent an operation is asking for.
 *
 * Falls back to the first agent when the id is absent or unknown, so a chapter
 * whose fixtures predate the gallery still renders rather than throwing — and
 * a mistyped id in a tour route degrades to a populated screen instead of a
 * blank one.
 */
function agentFor(world: DemoWorld, variables: Record<string, unknown>) {
  return (
    world.agents.find((a) => a.id === variables.id) ??
    // ALFREDO belongs to another deployment's world (chapter 9 opens its chat
    // session): reachable by id only, never listed among Newton's agents.
    (variables.id === ALGI_AGENT_ID ? ALGI_AGENT : world.agents[0])
  );
}

/**
 * One knowledge folder as the product's `context_folders` CRUD returns it —
 * exactly the fields `CONTEXT_FOLDER_FIELDS` selects (data/queries.ts), since
 * the selection set is what Apollo writes to the cache.
 */
type DemoFolder = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  context_ids: string[];
};

/** The demo's folder list — empty until a visitor creates one. See below. */
const demoFolders: DemoFolder[] = [];
let demoFolderSeq = 0;

/** A mutation's `input` coerced to a full row, over `base` where given. */
function demoFolderFrom(
  input: unknown,
  id: string,
  base?: DemoFolder,
): DemoFolder {
  const submitted = (input ?? {}) as Partial<DemoFolder>;
  const pick = <K extends keyof DemoFolder>(
    key: K,
    fallback: DemoFolder[K],
  ): DemoFolder[K] =>
    submitted[key] !== undefined ? (submitted[key] as DemoFolder[K]) : fallback;

  return {
    id,
    name: pick("name", base?.name ?? ""),
    description: pick("description", base?.description ?? null),
    icon: pick("icon", base?.icon ?? null),
    sort_order: Number(pick("sort_order", base?.sort_order ?? 0)),
    context_ids: pick("context_ids", base?.context_ids ?? []),
  };
}

export const DEMO_RESOLVERS: Record<string, DemoResolver> = {
  // --- app shell (every page) ---------------------------------------------
  // The sidebar polls this on every route, so it is shell-wide rather than
  // chapter-specific. Zero is the truth for a tour with no live runs.
  // Real for the whole tour, not just chapter 6: ALGI genuinely has one run
  // sitting in waiting_approval, so the badge shows a 1 and the chapter's
  // "something is waiting for a human" step points at a number the sidebar
  // was already displaying. Derived from the runs rather than written as a
  // literal, so trimming the fixture cannot leave the badge lying.
  RoutineRunsNeedingAttentionCount: () => ({
    routineRunsNeedingAttentionCount: ALGI_RUNS_NEEDING_ATTENTION,
  }),

  // --- /transcriptions (chapter 7: what was said in the room) -------------
  // The selection asks for far more than the list renders — storage keys, the
  // meeting join URL, bot and whisper ids. Those are answered as null rather
  // than omitted: an absent SELECTED field is a console error, which is a
  // different failure from a deliberately empty one. The nulls are also the
  // honest answer, since those columns were dropped at export.
  GetTranscriptionJobs: () => ({
    transcription_jobsPagination: {
      pageInfo: { itemCount: ALGI_MEETINGS.length },
      items: ALGI_MEETINGS.map(transcriptionJob),
    },
  }),

  // The list page reads FINISHED recordings from the Transkripte knowledge
  // base (TranscriptItems), not from the jobs: mergeTranscriptRows drops
  // every saved job and expects its item instead. Unmapped, this answered
  // {} and the fourteen saved meetings were absent from the screen while
  // chapter 10 spoke of twenty. One item per saved job, newest first; the
  // page's `archived` filter is always false here and `name` is the
  // search box.
  TranscriptItems: (_world, variables) => {
    const needle = filterValue(variables, "name");
    const items = ALGI_MEETINGS.filter((m) => m.status === "saved")
      .filter((m) => !needle || m.title.toLowerCase().includes(needle.toLowerCase()))
      .map((m) => ({
        id: `transcript-${m.id}`,
        name: m.title.trim(),
        recording_source: m.source,
        job_id: m.id,
        recorded_at: m.createdAt,
        duration_seconds: m.duration_seconds,
        speaker_count: null,
        project_id: null,
        rights_mode: "public",
        created_by: DEMO_USER_ID,
        post_processing: null,
      }))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
    return {
      transcriptions_itemsPagination: {
        pageInfo: { itemCount: items.length, hasNextPage: false },
        items,
      },
    };
  },

  GetTranscriptionJob: (_world, variables) => {
    const meeting =
      ALGI_MEETINGS.find((m) => m.id === variables.id) ?? ALGI_MEETINGS[0];
    return {
      transcription_jobById: {
        ...transcriptionJob(meeting),
        // Only the opening minutes, and only for the meeting the chapter
        // opens. Everything else returns an empty transcript rather than
        // another meeting's words — a visitor who clicks a different row
        // should find nothing, not somebody else's conversation.
        // start/end are required, not decorative: the review sheet formats a
        // timestamp per segment and rendered "NaN:NaN" on every line when the
        // excerpt carried only speaker and text.
        raw_segments:
          meeting.id === ALGI_MEETING_ID
            ? TRANSCRIPT_EXCERPT.map((line, index) => {
                const [minutes, seconds] = line.at.split(":").map(Number);
                const start = minutes * 60 + seconds;
                const next = TRANSCRIPT_EXCERPT[index + 1];
                const end = next
                  ? next.at.split(":").reduce((m, s) => m * 60 + Number(s), 0)
                  : start + 4;
                return { start, end, speaker: line.speaker, text: line.text };
              })
            : [],
      },
    };
  },

  // Recording is on, with no cap configured — which is what ALGI runs. A
  // percentage bar climbing toward a limit would imply a metered feature the
  // tour does not otherwise mention.
  // The transcripts list asks for the workspace's transcription settings on
  // every visit (transcriptions/hooks.ts); unmapped, it logged an Apollo
  // missing-field error on chapter 10's first screen (sub-project 5 walk,
  // console pass). Code defaults throughout — nothing in the tour edits them,
  // and the settings page that would show them is not part of the tour.
  GetTranscriptsSettings: () => {
    const code = <T,>(value: T) => ({ value, source: "code" });
    return {
      transcriptsSettings: {
        botName: code(null),
        notifyChat: code(null),
        recordersMayOverrideBot: code(null),
        defaultRightsMode: code(null),
        summaryPresets: code([]),
        videoRetentionHours: code("forever"),
        storeVideoLocally: code(null),
        monthlyRecordingLimitMinutes: code("none"),
        videoStorageCostPerHour: code(null),
        stalePresets: [],
      },
    };
  },
  GetMeetingRecordingUsage: () => ({
    meetingRecordingUsage: {
      enabled: true,
      used_seconds: ALGI_MEETINGS.reduce(
        (sum, m) => sum + (m.duration_seconds ?? 0),
        0,
      ),
      limit_seconds: null,
      percent: null,
      exceeded: false,
    },
  }),

  // --- /workflows (chapter 6: the ALGI email routine) ---------------------
  // Named "workflow_template" in the API and "Routine" in the UI; both appear
  // below because the operations keep the old name.
  GetWorkflowTemplates: () => ({
    workflow_templatesPagination: {
      pageInfo: page(1),
      items: [routineItem()],
    },
  }),

  GetWorkflowTemplateById: () => ({
    workflow_templateById: {
      id: ALGI_ROUTINE.id,
      name: ALGI_ROUTINE.name,
      agent: ALGI_ROUTINE.agent,
      queue: ALGI_ROUTINE.queue,
      description: ALGI_ROUTINE.description,
      rights_mode: ALGI_ROUTINE.rights_mode,
      steps_json: ALGI_ROUTINE.steps_json,
      variables: ALGI_ROUTINE.variables,
      createdAt: ALGI_ROUTINE.createdAt,
      updatedAt: ALGI_ROUTINE.updatedAt,
      RBAC: { type: "public", users: [], roles: [] },
    },
  }),

  // The Triggers section. `webhook_url` is null and the two has_* booleans are
  // true: the endpoint exists, and the demo says so without publishing it.
  // Its secrets were never read out of the database in the first place.
  GetWorkflowTriggers: () => ({
    workflowTriggers: [
      {
        id: ALGI_EMAIL_TRIGGER.id,
        workflow: ALGI_EMAIL_TRIGGER.workflow,
        type: ALGI_EMAIL_TRIGGER.type,
        enabled: ALGI_EMAIL_TRIGGER.enabled,
        webhook_url: null,
        has_webhook: true,
        has_signing_secret: true,
        last_fired_at: ALGI_EMAIL_TRIGGER.last_fired_at,
        config: ALGI_EMAIL_TRIGGER.config,
        run_as_user: ALGI_EMAIL_TRIGGER.run_as_user,
        createdAt: ALGI_ROUTINE.createdAt,
        updatedAt: ALGI_EMAIL_TRIGGER.last_fired_at,
      },
    ],
  }),

  // The runs console. Honours the filters the UI actually sends, because the
  // chapter points at the needs-attention lens and at the two filtered rows —
  // a resolver that returned all 25 regardless would make both steps narrate
  // something the screen contradicts.
  RoutineRuns: (_world, variables) => {
    let items = ALGI_RUNS;

    const states = variables.states as string[] | undefined;
    if (Array.isArray(states) && states.length) {
      items = items.filter((run) => states.includes(run.state));
    }
    const triggers = variables.triggers as string[] | undefined;
    if (Array.isArray(triggers) && triggers.length) {
      items = items.filter((run) => triggers.includes(run.trigger ?? ""));
    }
    if (variables.needsAttention === true) {
      items = items.filter((run) => run.state === "waiting_approval");
    }
    const search = (variables.search as string | undefined)?.toLowerCase();
    if (search) {
      items = items.filter((run) =>
        `${run.trigger_metadata?.subject ?? ""} ${run.trigger_metadata?.from ?? ""}`
          .toLowerCase()
          .includes(search),
      );
    }

    return {
      routineRuns: {
        total: items.length,
        items: items.map((run) => ({
          // Spread first, then fill the fields the selection asks for that the
          // export did not carry. Tokens and cost are null rather than
          // invented: the runs are real, and nobody measured these.
          job_id: null,
          error: null,
          updatedAt: run.createdAt ?? null,
          inputTokens: null,
          outputTokens: null,
          costUsd: null,
          ...run,
        })),
      },
    };
  },

  // Null, and that is the truth rather than a gap: this routine has no cron.
  // It is triggered by mail arriving, which is the whole point of the chapter
  // — a scheduled routine would be a weaker claim. Returning null is also what
  // the Schedule tab needs to render its "not scheduled" state instead of
  // hanging.
  GetWorkflowSchedule: () => ({ workflowSchedule: null }),

  RoutinesGetAgentById: () => ({
    agentById: { id: ALGI_AGENT.id, name: ALGI_AGENT.name },
  }),

  RoutinesGetAgentsList: (world) => ({
    agentsPagination: {
      items: [...world.agents, ALGI_AGENT].map(({ id, name }) => ({
        id,
        name,
      })),
    },
  }),

  GetAvailableQueues: () => ({
    queues: [{ name: "mail_processing_queue" }, { name: "default" }],
  }),

  // --- /data (chapter 2: document understanding) --------------------------
  // Note the nesting: GetContexts selects `contexts { items { ... } }`, so a
  // flat array would satisfy TypeScript and render nothing.
  GetContexts: (world) => ({ contexts: { items: world.contexts } }),

  GetContextIcons: () => ({ platform_configurationsPagination: { items: [] } }),

  // Knowledge folders. The demo user is a super admin (user.ts), so the tour
  // shows "Manage folders" and a visitor can create one with a stray click —
  // unmapped, the mutations resolved to `{}` and nothing appeared.
  //
  // Unlike UpdateAgentEditor above (which echoes and forgets), these four
  // share one in-memory list: a folder you create has to still be there when
  // the dialog refetches a moment later, or the feature reads as broken. The
  // list is per module instance, i.e. per browser tab for the client link —
  // the server-side table is a different instance and issues no folder
  // mutation, so nothing a visitor does reaches anyone else's tour. It starts
  // EMPTY so the demo Knowledge page renders exactly as it did before
  // folders existed (the page groups only once a folder exists).
  GetContextFolders: () => ({
    // Mirrors the real query's `sort: { field: "sort_order", direction: "ASC" }`.
    context_foldersPagination: {
      items: [...demoFolders].sort((a, b) => a.sort_order - b.sort_order),
    },
  }),

  CreateContextFolder: (_world, variables) => {
    const folder = demoFolderFrom(
      variables.input,
      `demo-folder-${++demoFolderSeq}`,
    );
    demoFolders.push(folder);
    return { context_foldersCreateOne: { item: folder } };
  },

  UpdateContextFolder: (_world, variables) => {
    const id = String(variables.id ?? "");
    const existing = demoFolders.find((folder) => folder.id === id);
    if (!existing) {
      // Unknown id (a tab that outlived its list): echo the submitted values
      // rather than null, so the dialog leaves its saving state and the next
      // refetch sets it straight.
      return {
        context_foldersUpdateOneById: {
          item: demoFolderFrom(variables.input, id),
        },
      };
    }
    // Merge: the dialog saves every field, the move menu sends context_ids
    // alone, and an untouched field must survive either way.
    Object.assign(existing, demoFolderFrom(variables.input, id, existing));
    return { context_foldersUpdateOneById: { item: existing } };
  },

  DeleteContextFolder: (_world, variables) => {
    const id = String(variables.id ?? "");
    const index = demoFolders.findIndex((folder) => folder.id === id);
    if (index >= 0) demoFolders.splice(index, 1);
    return { context_foldersRemoveOneById: { id } };
  },

  GetUserContextItemFavourites: () => ({
    userById: {
      id: String(DEMO_USER_ID),
      favourite_items: [],
      recently_viewed_items: [],
    },
  }),

  // --- /data/[ctx]/items/[itemId] (chapter 2: ingestion) ------------------
  // The item detail page polls this every 5s to drive the pipeline stepper.
  // Empty is the truth and also what we want on screen: an empty list means no
  // stage is in flight, so the stepper renders all four stages settled rather
  // than showing a spinner that never resolves in a world with no workers.
  GetItemActiveJobs: () => ({
    job_resultsPagination: { items: [] },
  }),

  // The Pipeline tab's imports card (ImportsCard) issues this on every visit,
  // licensed or not. Empty is the truth — nothing imports in a scripted world
  // — and answering it keeps the unmapped-operation warning meaningful
  // instead of firing on a tour-reachable screen every time.
  ImportJobs: () => ({
    job_resultsPagination: { items: [] },
  }),

  // Derived from the fixture rather than hardcoded, so the health panel cannot
  // drift from the documents the list is showing. stuck/stale are zero because
  // nothing is stuck or stale in a scripted world — inventing a non-zero count
  // would put a warning badge on the screen whose point is a healthy pipeline.
  GetContextHealth: (world, variables) => {
    const id = String(variables.id ?? "");
    const items = world.itemsByContext?.[id] ?? world.items;
    return {
      contextById: {
        id,
        item_count: items.length,
        chunk_total: items.reduce(
          (sum, item) => sum + (item.chunks_count ?? 0),
          0,
        ),
        stuck_count: 0,
        stale_count: 0,
      },
    };
  },

  // --- /evals (chapter 5: proving accuracy) -------------------------------
  // All three are *Pagination wrappers; pageInfo is selected, so omitting it
  // leaves the tables unable to render their footers.
  GetEvalSets: () => ({
    eval_setsPagination: {
      pageInfo: page(EVAL_SETS.length),
      items: EVAL_SETS,
    },
  }),

  // The set detail page, which is where chapter 5 spends most of its time.
  // Unmapped this returns {}, and the page has no error state for that — it
  // simply renders loading skeletons forever. No console error either, which
  // is why the list screen looked finished and this one was never noticed.
  GetEvalSetById: (_world, variables) => ({
    eval_setById:
      EVAL_SETS.find((set) => set.id === variables.id) ?? EVAL_SETS[0],
  }),

  GetTestCases: (_world, variables) => {
    // The cases library is filtered by eval set when opened from a set. Honour
    // it: an unfiltered list would show the regulatory case inside the techdoc
    // suite, which is exactly the mistake the suite exists to catch.
    const setId = evalSetIdFrom(variables);
    const items = setId
      ? TEST_CASES.filter((c) => c.eval_set_id === setId)
      : TEST_CASES;
    return {
      test_casesPagination: { pageInfo: page(items.length), items },
    };
  },

  // Reachable only because lib/demo/config.ts reports workers as enabled,
  // which is what removes the "not configured" banner from chapter 5's screen
  // — the same flag un-disables these Run buttons. This maps the consequence
  // rather than leaving an error toast behind an enabled button.
  //
  // Zero queued is the literal truth: there are no workers behind the tour.
  // Simulating a run would mean inventing streamed per-case results, which is
  // a much larger fabrication than the static scores already disclosed in
  // fixtures/evals.ts.
  RunEval: () => ({ runEval: { jobs: [], count: 0 } }),

  // One query per run column, filtered by a label prefix. Honouring that
  // filter is not optional: each column averages EVERY row it is handed, so a
  // resolver that ignored the filter would give both runs the same average —
  // the mean of all six results — while the per-case cells still looked right.
  GetJobResults: (_world, variables) => {
    const needle = filterValue(variables, "label");
    // The routines list asks for the newest job whose label carries the
    // routine id (useLastRunForPage). Answer it from the real runs; the
    // row read "Noch nie ausgeführt" above twenty-five of them.
    if (needle === ALGI_ROUTINE.id) {
      const newest = [...ALGI_RUNS].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
      // RoutineRun.createdAt is nullable in the product type; every ALGI run has one.
      const stamp = newest.createdAt ?? new Date(0).toISOString();
      return {
        job_resultsPagination: {
          pageInfo: page(1),
          items: [
            {
              id: `lastrun-${newest.id}`,
              job_id: newest.id,
              state: newest.state,
              error: null,
              label: `routine:${ALGI_ROUTINE.id}`,
              result: null,
              metadata: null,
              createdAt: stamp,
              updatedAt: stamp,
            },
          ],
        },
      };
    }
    const items = needle
      ? EVAL_JOB_RESULTS.filter((row) => row.label.includes(needle))
      : EVAL_JOB_RESULTS;
    return { job_resultsPagination: { pageInfo: page(items.length), items } };
  },

  GetEvalRuns: (_world, variables) => {
    const setId = evalSetIdFrom(variables);
    const items = setId
      ? EVAL_RUNS.filter((r) => r.eval_set_id === setId)
      : EVAL_RUNS;
    return {
      eval_runsPagination: { pageInfo: page(items.length), items },
    };
  },

  // --- server-rendered detail routes --------------------------------------
  // These reach fetchGraphQLServerSide rather than Apollo. They were found by
  // the unmapped-operation warning firing on the server, which is exactly what
  // that warning is for.
  // Keyed by the requested id, not `agents[0]`.
  //
  // A single-agent world made the shortcut invisible, but the demo is about to
  // show a gallery of them: every agent in the list would have opened Newton.
  // The fallback keeps the old behaviour for the fixtures that pass no id.
  GetAgentById: (world, variables) => ({
    agentById: agentFor(world, variables),
  }),

  GetAgents: (world) => ({
    agentsPagination: {
      pageInfo: { pageCount: 1, itemCount: world.agents.length },
      items: world.agents,
    },
  }),

  // --- /agents index: Active / Inactive sections + favourites ---------------
  // The index issues AgentsIndex once per section with an `{ active: { eq } }`
  // filter entry (plus `{ name: { contains } }` while searching) and renders
  // starred agents from AgentsFavouritesByIds. Every AGENT_LIST_FIELDS field
  // is present on each row (an absent one is an Apollo cache miss that empties
  // the section without an error); a fixture agent with no explicit `active`
  // counts as active, which is the column's real default.
  AgentsIndex: (world, variables) => {
    const filters =
      (variables.filters as
        | Array<Record<string, { eq?: unknown; contains?: unknown }>>
        | undefined) ?? [];
    let items = world.agents;
    for (const entry of filters) {
      const active = entry.active?.eq;
      if (typeof active === "boolean") {
        items = items.filter((a) => (a.active ?? true) === active);
      }
      const needle = entry.name?.contains;
      if (typeof needle === "string" && needle.length > 0) {
        const lower = needle.toLowerCase();
        items = items.filter((a) => a.name.toLowerCase().includes(lower));
      }
    }
    return {
      agentsPagination: {
        pageInfo: page(items.length),
        items: items.map(agentListRow),
      },
    };
  },
  GetUserFavouriteAgents: () => ({
    userById: { id: String(DEMO_USER_ID), favourite_agents: [] },
  }),
  UpdateUserFavouriteAgents: (_world, variables) => ({
    usersUpdateOne: {
      item: {
        id: String(DEMO_USER_ID),
        favourite_agents: Array.isArray(variables.favourite_agents)
          ? variables.favourite_agents
          : [],
      },
    },
  }),
  AgentsFavouritesByIds: (world, variables) => {
    const ids = (variables.ids as string[] | undefined) ?? [];
    return {
      agentByIds: world.agents
        .filter((a) => ids.includes(a.id))
        .map(agentListRow),
    };
  },

  GetContextById: (world, variables) => ({
    contextById:
      world.contexts.find((c) => c.id === variables.id) ?? world.contexts[0],
  }),

  // --- /memory (memory area) ------------------------------------------------
  // The base the correction was written to, as one row with live counts:
  // chapter 6's last step opens this overview. The counts come from the
  // world, so the row shows three memories before the correction and four
  // after — the same threshold the knowledge page honours. Every field the
  // document selects is present (an absent one is an Apollo cache error).
  // The per-base pages are never reached from it.
  MemoryBases: (world) => {
    const items = world.itemsByContext?.[MEMORY_CONTEXT_ID] ?? [];
    const context = CONTEXTS.find((c) => c.id === MEMORY_CONTEXT_ID);
    const stamps = items.map((item) => item.createdAt ?? "").filter(Boolean).sort();
    const lastSavedAt = stamps.length ? stamps[stamps.length - 1] : null;
    return {
      memoryBases: [
        {
          id: MEMORY_CONTEXT_ID,
          name: context?.name ?? "Assistenten-Gedächtnis",
          description: context?.description ?? null,
          valid: true,
          missing: [],
          missingFromCode: false,
          agents: world.agents.map((a) => ({ id: a.id, name: a.name })),
          stats: {
            total: items.length,
            public: items.length,
            private: 0,
            contributors: items.length ? MEMORY_CONTRIBUTORS.length : 0,
            visible: items.length,
            lastSavedAt,
            lastSavedBy: lastSavedAt ? { id: DEMO_USER_ID, name: "Demo" } : null,
          },
        },
      ],
    };
  },
  MemoryAgentCount: (world) => ({ memoryAgentCount: world.agents.length }),
  MemoryBaseContributors: () => ({ memoryBaseContributors: MEMORY_CONTRIBUTORS }),
  // --- /memory/[ctx]: the base page and its map (chapter 6, last step) -----
  MemoryBaseById: (_world, variables) => {
    const context =
      CONTEXTS.find((c) => c.id === variables.id) ?? CONTEXTS.find((c) => c.id === MEMORY_CONTEXT_ID)!;
    const fields = context.fields ?? [];
    return {
      contextById: {
        id: context.id,
        name: context.name,
        description: context.description ?? null,
        fields,
        configuration: context.configuration ?? null,
        memoryBase: checkMemoryBase({ fields }),
      },
    };
  },
  MemorySourceSession: (world, variables) => ({
    agent_sessionById: world.sessions.find((s) => s.id === variables.id) ?? world.sessions[0],
  }),
  MemorySourceMessages: () => ({ agent_messagesPagination: { items: [] } }),
  // The map: positions are fixture data (fixtures/memory-examples.ts), one
  // point per memory, clustered around four topic centres; fitted, so the
  // card draws instead of showing "not mapped".
  ContextProjectionStatus: (world, variables) => {
    const items = world.itemsByContext?.[String(variables.contextId)] ?? [];
    return {
      contextProjectionStatus: {
        fitted: true,
        fittedAt: "2026-08-27T06:00:00.000Z",
        residual: 0.12,
        mappedChunks: items.length,
        totalChunks: items.length,
      },
    };
  },
  ContextMapTopics: (world, variables) => {
    const items = world.itemsByContext?.[String(variables.contextId)] ?? [];
    return {
      contextMapTopics: MEMORY_TOPICS.map((t) => ({
        ...t,
        count: items.filter((i) => topicOf(i).id === t.id).length,
      })),
    };
  },
  ContextMapPoints: (world, variables) => {
    const items = world.itemsByContext?.[String(variables.contextId)] ?? [];
    // The link shifts STRING timestamps into the demo's window; createdAtMs
    // is a number, so shift at the source or the slider spans the fixture's
    // real dates up to today (review, 2026-10-15).
    const offset = demoDateOffsetMs();
    const points = memoryMapPoints(
      items.map((item) => (item.createdAt ? { ...item, createdAt: shiftTimestamp(item.createdAt, offset) } : item)),
    );
    return { contextMapPoints: { points, total: points.length, sampled: false } };
  },
  ContextMapEdges: () => ({ contextMapEdges: [] }),
  ContextMapItem: (world, variables) => {
    const item = (world.itemsByContext?.[String(variables.contextId)] ?? []).find((i) => i.id === variables.itemId);
    return {
      contextMapItem: item
        ? {
            id: item.id,
            name: item.name,
            chunks: 1,
            textLength: ((item as { information?: string }).information ?? "").length,
            source: null,
            createdAt: item.createdAt ?? null,
            updatedAt: item.updatedAt ?? item.createdAt ?? null,
          }
        : null,
    };
  },
  MemoryUsageByIds: () => ({ memoryUsageByIds: [] }),
  MemoryUsage: () => ({ memoryUsage: { count: 0, lastUsedAt: null, recent: [] } }),
  MemoryBaseUsage: () => ({ memoryBaseUsage: { used: 0, neverUsed: 0, stale: 0, mostUsed: [], newPerWeek: [] } }),
  MemoryBaseUnusedIds: () => ({ memoryBaseUnusedIds: [] }),

  // --- /memory/[ctx]/conflicts (sub-project 3b) -----------------------------
  // No fabricated conflicts: the page renders its empty/unscanned state.
  // MemoryConflictsScan, MemoryConflictResolve and MemoryConflictSuggestMerge
  // are deliberately NOT mapped — demo mode never scans or resolves.
  MemoryConflicts: () => ({ memoryConflicts: [] }),
  MemoryConflictCounts: () => ({ memoryConflictCounts: { open: 0, memoriesInvolved: 0, lastScanAt: null } }),
  MemoryConflictsForMemory: () => ({ memoryConflictsForMemory: { open: [], mergedFrom: [] } }),
  WorkbenchMemoryConflictCounts: () => ({ memoryConflictCounts: { open: 0, memoriesInvolved: 0, lastScanAt: null } }),

  // --- /agents/edit/[id] (chapter 3: agent configuration) -----------------
  AgentEditorById: (world, variables) => ({
    agentById: {
      ...agentFor(world, variables),
      // null = defaults (agents.memory_config; memory-section-data.ts). Not on
      // the fixture object itself — same "not authored, defaults apply" story
      // as the wizard's own agentic-retrieval config below.
      memory_config: null,
      tools: [CONTEXT_SEARCH_TOOL],
      skills: [],
      capabilities: {
        text: true,
        images: true,
        files: true,
        audio: false,
        video: false,
      },
      // One role, read — what chapter 4's access step points at. The roster
      // the control resolves the id against is GetUserRoles below.
      RBAC: { type: "agent", users: [], roles: [{ id: ROLE_TECHNIKER_ID, rights: "read" }] },
    },
  }),

  EditorContexts: (world) => ({
    contexts: {
      items: world.contexts.map(({ id, name, description, fields }) => ({
        id,
        name,
        description,
        fields,
        memoryBase: checkMemoryBase({ fields }),
      })),
    },
  }),

  // GET_MEMORY_BASE_STATS / GET_AGENTS_USING_MEMORY (Task 14, memory-section.tsx)
  // are deliberately NOT mapped here: no chapter script drives the workbench's
  // memory card yet, so there is no scripted stats/usage data to answer with
  // that would not be invented. Unmapped resolves to `{data:{}}` (see the
  // module doc comment above) — the card's stats grid and "used by" hints
  // simply do not render, same as any other not-yet-scripted screen.

  // GET_MEMORY_BASE_USAGE (Task 8, Insights block) IS mapped, unlike its
  // siblings above: an all-zero answer is not an invented number, it is the
  // real empty state (the "no answers have used memories yet" copy), so it
  // is safe to answer unconditionally rather than leave unmapped.
  WorkbenchMemoryBaseUsage: () => ({ memoryBaseUsage: { used: 0, neverUsed: 0, stale: 0, mostUsed: [], newPerWeek: [] } }),

  // The Agentic retrieval card renders only when a tool with the id
  // `agentic_context_search` exists on the DEPLOYMENT, not merely on the agent
  // (sections/knowledge.tsx:44). Returning an empty catalogue here is what hid
  // the wizard — the chapter's entire subject — while the page itself looked
  // fine.
  // total/page/limit are selected alongside items. Omitting them is not
  // cosmetic here: an incomplete cache diff can leave useQuery with undefined
  // data, and undefined data hides the card that IS chapter 3.
  EditorTools: () => ({
    tools: {
      items: [AGENTIC_RETRIEVAL_TOOL],
      total: 1,
      page: 1,
      limit: 20,
    },
  }),

  EditorToolCategories: () => ({ toolCategories: ["knowledge"] }),

  // Save. The editor is a real, editable screen and the tour walks a visitor
  // right through it, so the Save button is one stray click away at all times
  // — and unmapped it produced an error toast on the chapter arguing the
  // product is configurable without an engineer.
  //
  // Echoes the submitted values back over the fixture, which is what the
  // editor needs to leave its dirty state and show a success toast. Nothing
  // persists: the next read comes from the fixture again. That is a fair
  // trade for a scripted tour — the alternative is either a failure the
  // visitor caused by accident, or a mutable demo world that would let one
  // visitor's edits leak into the next one's tour.
  //
  // Every field the mutation SELECTS is listed, not every field it accepts:
  // the selection set is what Apollo writes to the cache, and a missing one
  // is a console error on the same screen. AGENT_FIREWALL_SUPPORTED and
  // AGENT_RBAC_TEAMS_SUPPORTED are false, so `firewall` and `RBAC.teams` are
  // not selected and are deliberately absent here; `image` is, and is not.
  UpdateAgentEditor: (world, variables) => {
    // Typed, not cast to a bare record: the fallbacks below are the agent's
    // real fields, and losing that typing is how a renamed one would slip
    // through as undefined — which reads to Apollo as a missing field.
    const agent = world.agents[0];
    const submitted = (name: string, fallback: unknown) =>
      variables[name] !== undefined ? variables[name] : fallback;

    return {
      agentsUpdateOneById: {
        item: {
          id: agent.id,
          name: submitted("name", agent.name),
          description: submitted("description", agent.description),
          feedback: submitted("feedback", agent.feedback ?? true),
          suggestions_enabled: submitted(
            "suggestions_enabled",
            agent.suggestions_enabled ?? true,
          ),
          sandbox_enabled: submitted(
            "sandbox_enabled",
            agent.sandbox_enabled ?? false,
          ),
          max_tool_steps: submitted("max_tool_steps", 20),
          welcomemessage: submitted("welcomemessage", agent.welcomemessage),
          defaultagent: submitted("defaultagent", agent.defaultagent ?? true),
          instructions: submitted("instructions", agent.instructions),
          memory: submitted("memory", null),
          memory_config: submitted("memory_config", null),
          category: submitted("category", null),
          animation_idle: submitted("animation_idle", null),
          animation_responding: submitted("animation_responding", null),
          rights_mode: submitted("rights_mode", agent.rights_mode ?? "public"),
          active: submitted("active", agent.active ?? true),
          model: submitted("model", null),
          image: submitted("image", null),
          guest_access: submitted("guest_access", false),
          guest_auth_mode: submitted("guest_auth_mode", null),
          // Note the name: the mutation returns guest_HAS_password, never the
          // password itself. Echoing `guest_password` here would answer a
          // field nothing selected and miss the one that is.
          guest_has_password: false,
          guest_cover_image: submitted("guest_cover_image", null),
          RBAC: variables.RBAC ?? {
            type: "agent",
            users: [],
            roles: [],
          },
        },
      },
    };
  },

  // The editor mounts a model selector and an Access section alongside the
  // Knowledge section the chapter is about. All three were unmapped and logged
  // an Apollo error apiece on chapter 3's screen — found in the browser, not by
  // demo-editor.test.ts, which only asserted the operations the agentic
  // retrieval card needs.
  //
  // Two documents select the same `litellmCatalog` root under two operation
  // names — the chat surface's and the agent editor's — and the resolver
  // table is keyed by OPERATION, so both must be mapped. Same list for both.
  GetLiteLLMCatalog: () => ({ litellmCatalog: LITELLM_CATALOGUE }),
  // The selector offers chat models; an embedding, OCR or rerank row there
  // would be a model an agent cannot talk to.
  GetAgentLiteLLMCatalog: () => ({ litellmCatalog: LITELLM_CATALOGUE.filter((m) => m.type === "chat") }),
  // Five operations the reviewer's console pass surfaced as unmapped noise.
  // GetQueue POLLS — the routine page asks every few seconds, so unmapped it
  // warned continuously. Values are an idle queue, which is the truth of a
  // demo where nothing executes.
  GetQueue: (_w, variables) => ({
    queue: {
      __typename: "Queue",
      name: variables.queue,
      concurrency: { worker: 4, queue: 8 },
      timeoutInSeconds: 600,
      ratelimit: null,
      isMaxed: false,
      isPaused: false,
      jobs: { paused: 0, completed: 25, failed: 8, waiting: 0, active: 0, delayed: 0 },
    },
  }),
  GetEvals: () => ({ evals: { items: [] } }),
  GetUniquePromptTags: () => ({ getUniquePromptTags: [] }),
  GetVariablesLite: () => ({
    variablesPagination: { pageInfo: page(0), items: [] },
  }),
  GetAgentsByIds: (world, variables) => ({
    agentByIds: world.agents.filter((a) =>
      (variables.ids as string[] | undefined)?.includes(a.id),
    ),
  }),

  // --- /budgets (chapter 11: what it costs and who controls it) -----------
  //
  // Root field names verified against the real gql documents in
  // queries/queries.ts, re-exported by app/(application)/budgets/queries.ts —
  // NOT the plan's guessed names. GetWorkflowTemplatesWithBudgets disagreed:
  // the document selects `workflow_templatesPagination`, matching the
  // underscored name every other workflow_template operation in this file
  // already uses, not the camelCase `workflowTemplatesPagination` the brief
  // proposed.
  //
  // The teams come from fixtures/chapter-kosten.ts, the same source the
  // analytics REST fixture attributes spend to — so the two halves of the
  // chapter cannot disagree about who spent what while a prospect looks at
  // them side by side. Every other roster is empty: no fabricated users,
  // roles, projects, agents, or routines have a budget in this tour.
  //
  // spend comes from KOSTEN_TEAM_SPEND, not a literal 0: KOSTEN_TEAMS.share
  // is the SAME field the REST fixture allocates /analytics' byTag spend
  // by, so a literal 0 here made /budgets show every team as unspent while
  // /analytics showed real figures for the identical three teams.
  GetTeamsWithBudgets: () => ({
    teamsPagination: {
      pageInfo: page(KOSTEN_TEAMS.length),
      items: KOSTEN_TEAMS.map((team, i) => ({
        id: team.id,
        name: team.name,
        budget: {
          max_budget: team.budget,
          spend: KOSTEN_TEAM_SPEND[i],
          budget_duration: "30d",
        },
      })),
    },
  }),
  GetUsersWithBudgets: () => ({ usersPagination: { pageInfo: page(0), items: [] } }),
  GetRolesWithBudgets: () => ({ rolesPagination: { pageInfo: page(0), items: [] } }),
  GetProjectsWithBudgets: () => ({ projectsPagination: { pageInfo: page(0), items: [] } }),
  GetAgentsWithBudgets: () => ({ agentsPagination: { pageInfo: page(0), items: [] } }),
  GetWorkflowTemplatesWithBudgets: () => ({
    workflow_templatesPagination: { pageInfo: page(0), items: [] },
  }),

  // --- id → name hydration for /analytics' breakdown card -----------------
  //
  // byTag rows carry ids; the breakdown card hydrates names via GraphQL.
  // Root fields and shapes verified against queries/queries.ts (re-exported
  // by app/(application)/analytics/queries.ts) and confirmed against how
  // breakdown-chart-card.tsx actually reads each hydration result — several
  // disagreed with the plan's guessed `{ <plural>: { items } }` shape:
  //
  //   - GetUsersByIds    → `userByIds`     (flat array, no pageInfo/items)
  //   - GetProjectsByIds → `projectByIds`  (flat array, no pageInfo/items)
  //   - GetTeamsByIds    → `teamsPagination.items` (no pageInfo selected)
  //   - GetRolesByIds    → `rolesPagination.items` (no pageInfo selected;
  //     no $ids variable either — the document fetches up to 200 and the
  //     component matches client-side, since FilterRole has no `id` field)
  //   - GetRoutinesByIds → `workflow_templatesPagination.items` (no pageInfo)
  //
  // GetAgentsByIds (agentByIds) is already mapped above.
  //
  // Teams and roles are the rosters with entities: teams match KOSTEN_ROSTERS
  // in fixtures/chapter-kosten.ts, roles are fixtures/roles.ts (chapter 4).
  GetTeamsByIds: () => ({
    teamsPagination: { items: KOSTEN_TEAMS.map((t) => ({ id: t.id, name: t.name })) },
  }),
  GetUsersByIds: () => ({ userByIds: [] }),
  GetProjectsByIds: () => ({ projectByIds: [] }),
  // The review page's TranscriptDocument offers a project picker on load. No
  // projects exist in the tour, and an unmapped operation renders the page
  // blank rather than empty.
  GetProjects: () => ({
    projectsPagination: { pageInfo: page(0), items: [] },
  }),
  GetRolesByIds: () => ({ rolesPagination: { items: [] } }),
  GetRoutinesByIds: () => ({ workflow_templatesPagination: { items: [] } }),

  GetUserRoles: () => ({
    rolesPagination: { pageInfo: page(DEMO_ROLES.length), items: DEMO_ROLES },
  }),
  GetTeams: () => ({ teamsPagination: { pageInfo: page(0), items: [] } }),
  // The composer's prompt-library picker fires this on every chat render, so
  // it was the one unmapped operation left warning on every page of the tour.
  // Empty is honest: the tour never opens the prompt library, and inventing
  // saved prompts would put fabricated content one click off the path.
  GetPrompts: () => ({
    prompt_libraryPagination: { pageInfo: page(0), items: [] },
  }),

  // The reranker the agent is actually configured with
  // (fixtures/agent-editor.ts). Unmapped, the selector on the wizard's Behavior
  // step had nothing to resolve the stored value against and rendered EMPTY —
  // one panel away from a summary card reading "reranker: cohere/rerank-v4.0-pro".
  //
  // This one never reached the unmapped-operation warning during console
  // checks, because the Behavior step only mounts once a visitor opens it.
  // Walking the chapter is what surfaced it.
  GetRerankers: () => ({
    rerankers: {
      items: [
        {
          __typename: "Reranker",
          id: "cohere/rerank-v4.0-pro",
          name: "cohere/rerank-v4.0-pro",
          description:
            "Re-scores retrieved passages against the question before the assistant sees them.",
        },
      ],
    },
  }),

  // Empty lists still need their pageInfo: it is in the selection set, and a
  // *Pagination wrapper without it writes an incomplete result to the cache.
  EditorSkills: () => ({ skillsPagination: { pageInfo: page(0), items: [] } }),
  EditorVariables: () => ({
    variablesPagination: { pageInfo: page(0), items: [] },
  }),

  // --- /chat/[agent]/[session] (chapters 1 and 4) -------------------------
  // Both are server-rendered by the real chat route.
  GetAgentSessionById: (world, variables) => ({
    agent_sessionById:
      world.sessions.find((s) => s.id === variables.id) ??
      (variables.id === ALGI_SESSION_ID ? ALGI_SESSION : world.sessions[0]),
  }),

  // The chat sidebar's Recents list. Unmapped it returned nothing, so the panel
  // said "No conversations yet" beside an open conversation — on the chapter
  // whose whole claim is that this is a real deployment.
  //
  // Every field the list selects is returned, RBAC included: an absent selected
  // field is an Apollo cache error rather than an empty state.
  GetAgentSessions: (world, variables) => {
    // The chat surface asks for the CURRENT agent's sessions (filters.agent.eq);
    // ALFREDO's page must not list Newton's. It lists its own open session
    // instead: the product would hide a run's session from the rail
    // (run: { eq: null }), but "Noch keine Unterhaltungen" beside a
    // fifteen-message conversation reads as broken, not as faithful.
    const agent = filterValue(variables, "agent");
    const own = agent === ALGI_AGENT_ID
      ? [ALGI_SESSION]
      : world.sessions.filter((session) => !agent || session.agent === agent);
    const items = own
      .map((session) => ({
        ...session,
        user: session.created_by,
        RBAC: { type: session.rights_mode ?? "private", users: [], roles: [] },
      }));
    return {
      agent_sessionsPagination: { pageInfo: page(items.length), items },
    };
  },

  // `content` is a JSON STRING: the page does JSON.parse(item.content) to get
  // back a UIMessage. Returning an object here throws inside the page.
  //
  // The page requests DESC and then reverses, so honour the sort direction
  // rather than assuming — feedback-detail-panel.tsx asks for the same
  // operation and would otherwise render the conversation backwards.
  GetAgentSessionMessages: (world, variables) => {
    const rows = scrollbackRows(world, variables);
    const direction = (
      (variables?.sort as { direction?: string })?.direction ?? "ASC"
    ).toUpperCase();
    const items = direction === "DESC" ? [...rows].reverse() : rows;
    return {
      agent_messagesPagination: { pageInfo: page(items.length), items },
    };
  },
};

/**
 * Per-context item operations are GENERATED, not written by hand: /data/[ctx]
 * builds `query <ctx>Pagination` and `query <ctx>ById` from the context id at
 * runtime (data/queries.ts GET_ITEMS / GET_ITEM_BY_ID). There is no fixed set
 * of names to enumerate, so these are matched by shape instead — which means
 * every knowledge base in the tour gets a working detail page, not just the
 * ones somebody remembered to add.
 *
 * Note the response field is `<ctx>_itemsPagination` while the OPERATION is
 * `<ctx>Pagination`. They differ, and returning the operation name as the field
 * yields a page that renders its empty state.
 */
function dynamicResolver(operationName: string): DemoResolver | undefined {
  // Gated on the real context ids rather than matching any `<x>Pagination`.
  // A loose pattern would quietly answer operations nobody has mapped, and the
  // unmapped-operation warning is the diagnostic that has caught every missing
  // resolver so far (GetAgentById, GetAgents, RoutineRunsNeedingAttentionCount).
  // Silencing it to save a few lines would be a bad trade.
  const isContext = (id: string) => KNOWN_CONTEXT_IDS.has(id);

  // The memory workbench's list: `<ctx>MemoriesPagination` → `<ctx>_itemsPagination`,
  // paged, newest first (the document's default sort).
  const memoriesMatch = /^([a-z0-9_]+)MemoriesPagination$/.exec(operationName);
  if (memoriesMatch && isContext(memoriesMatch[1])) {
    const ctx = memoriesMatch[1];
    return (world, variables) => {
      const all = [...(world.itemsByContext?.[ctx] ?? [])].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
      const pageNo = Number(variables.page ?? 1);
      const limit = Number(variables.limit ?? 20);
      const items = all.slice((pageNo - 1) * limit, pageNo * limit).map((item) => ({
        rights_mode: "public",
        created_by: 0,
        description: null,
        source_session: null,
        updatedAt: item.createdAt ?? null,
        ...item,
      }));
      const pageCount = Math.max(1, Math.ceil(all.length / limit));
      return {
        [`${ctx}_itemsPagination`]: {
          pageInfo: { ...page(all.length), currentPage: pageNo, pageCount, hasPreviousPage: pageNo > 1, hasNextPage: pageNo < pageCount },
          items,
        },
      };
    };
  }

  const paginationMatch = /^([a-z0-9_]+)Pagination$/.exec(operationName);
  if (paginationMatch && isContext(paginationMatch[1])) {
    const ctx = paginationMatch[1];
    return (world) => {
      const items = world.itemsByContext?.[ctx] ?? world.items;
      return {
        [`${ctx}_itemsPagination`]: { pageInfo: page(items.length), items },
      };
    };
  }

  // The item detail page renders an Entities section for every context with an
  // embedder, so this fires on chapter 2's payoff screen. Note the shape: the
  // OPERATION is `EntitiesForItem<ctx>` — context suffixed, not prefixed —
  // which is why the two patterns below do not match it and it reached the
  // unmapped fallback, logging an Apollo error on the screen the chapter ends
  // on. Found by reading the browser console, not by any test.
  //
  // Empty is the truth rather than a convenience: the real deployment has zero
  // rows in this context's entities and chunk_entities tables, so the section
  // renders its empty state exactly as it does in production.
  const entitiesMatch = /^EntitiesForItem([a-z0-9_]+)$/.exec(operationName);
  if (entitiesMatch && isContext(entitiesMatch[1])) {
    const ctx = entitiesMatch[1];
    return () => ({ [`${ctx}_itemsEntitiesForItem`]: [] });
  }

  // Opening a citation. The operation is `GetChunkById<ctx>` — context
  // SUFFIXED and not underscore-separated (queries.ts:376), which is why none
  // of the patterns around it matched and why this reached the unmapped
  // fallback. The visitor saw "Chunk <guid> not found in context <ctx>" on the
  // one step that says "Open one to check it".
  //
  // Every field the query selects is returned even when the chunk is missing,
  // because Apollo does not fail an incomplete cache write — it logs a
  // console.error per absent field and silently falls back to the raw network
  // result, so a partial shape here is a defect that only shows up as console
  // noise.
  const chunkByIdMatch = /^GetChunkById([a-z0-9_]+)$/.exec(operationName);
  if (chunkByIdMatch && isContext(chunkByIdMatch[1])) {
    const ctx = chunkByIdMatch[1];
    return (world, variables) => {
      const items = world.itemsByContext?.[ctx] ?? world.items;
      for (const item of items) {
        const chunk = item.chunks?.find((c) => c.chunk_id === variables.id);
        if (!chunk) continue;
        return {
          [`${ctx}_itemsChunkById`]: {
            __typename: `${ctx}_itemsChunk`,
            chunk_id: chunk.chunk_id,
            chunk_content: chunk.chunk_content,
            chunk_index: chunk.chunk_index,
            chunk_source: chunk.chunk_source,
            chunk_metadata: chunk.chunk_metadata ?? {},
            chunk_created_at: chunk.chunk_created_at,
            chunk_updated_at: chunk.chunk_updated_at,
            item_id: item.id,
            item_name: item.name,
            item_external_id: item.external_id,
            item_created_at: item.createdAt,
            item_updated_at: item.updatedAt ?? item.createdAt,
          },
        };
      }
      // Null is the honest answer: the tour cites two chunks and only the
      // software-documentation one was exported with its content. Returning a
      // stand-in would put invented text behind a citation, which is the exact
      // claim this chapter asks the visitor to test.
      return { [`${ctx}_itemsChunkById`]: null };
    };
  }

  const byIdMatch = /^([a-z0-9_]+)ById$/.exec(operationName);
  if (byIdMatch && isContext(byIdMatch[1])) {
    const ctx = byIdMatch[1];
    return (world, variables) => {
      const items = world.itemsByContext?.[ctx] ?? world.items;
      return {
        [`${ctx}_itemsById`]:
          items.find((i) => i.id === variables.id) ?? items[0] ?? null,
      };
    };
  }

  return undefined;
}

/**
 * The single lookup both transports use: explicit table first, generated
 * operations second. Returns undefined when nothing matches, which the callers
 * turn into a warning plus an empty result.
 */
export function resolverFor(
  operationName: string | null,
): DemoResolver | undefined {
  if (!operationName) return undefined;
  return DEMO_RESOLVERS[operationName] ?? dynamicResolver(operationName);
}

/**
 * Reads the operation name from either a gql DocumentNode or a raw query
 * string. fetchGraphQLServerSide is typed `query: string` but callers pass
 * DocumentNodes, so both shapes reach us.
 */
export function operationNameOf(query: unknown): string | null {
  if (typeof query === "string") {
    return /(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(query)?.[1] ?? null;
  }
  const definitions = (query as { definitions?: unknown[] })?.definitions;
  if (!Array.isArray(definitions)) return null;
  for (const def of definitions) {
    const name = (def as { name?: { value?: string } })?.name?.value;
    if (name) return name;
  }
  return null;
}
