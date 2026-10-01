/**
 * GraphQL operations for /transcriptions, copied verbatim from
 * queries/queries.ts (codebase-structure §4 Wave 2: the feature stops
 * importing the monolith; the monolith itself shrinks in the Tail phase).
 *
 * Backend contract is untouched: same operations, same variables, same
 * selection sets as the monolith copies.
 */
import { gql } from "@apollo/client";

const TRANSCRIPTION_JOB_FIELDS = `
  id
  audio_s3key
  title
  status
  whisper_job_id
  language
  duration_seconds
  speakers
  project_id
  target_rights_mode
  target_rbac_users
  target_rbac_roles
  saved_item_id
  error
  rights_mode
  created_by
  createdAt
  updatedAt
  source
  meeting_url
  recall_bot_id
  recall_recording_id
  bot_status
  join_at
  post_processing_prompts
  post_processing_outputs
  video_s3key
  chunk_count
  last_chunk_at
`;

export const GET_TRANSCRIPTION_JOBS = gql`
  query GetTranscriptionJobs($filters: [FilterTranscription_job], $sort: SortBy = { field: "createdAt", direction: DESC }, $limit: Int = 50) {
    transcription_jobsPagination(page: 1, limit: $limit, sort: $sort, filters: $filters) {
      pageInfo {
        itemCount
      }
      items {
        ${TRANSCRIPTION_JOB_FIELDS}
      }
    }
  }
`;

export const GET_TRANSCRIPTION_JOB = gql`
  query GetTranscriptionJob($id: ID!) {
    transcription_jobById(id: $id) {
      ${TRANSCRIPTION_JOB_FIELDS}
      raw_segments
    }
  }
`;

export const START_TRANSCRIPTION_JOB = gql`
  mutation StartTranscriptionJob($input: TranscriptionJobStartInput!) {
    transcriptionJobStart(input: $input) {
      ${TRANSCRIPTION_JOB_FIELDS}
    }
  }
`;

export const FINALIZE_TRANSCRIPTION_JOB = gql`
  mutation FinalizeTranscriptionJob($id: ID!, $input: TranscriptionJobFinalizeInput!) {
    transcriptionJobFinalize(id: $id, input: $input) {
      job {
        ${TRANSCRIPTION_JOB_FIELDS}
      }
      item_id
    }
  }
`;

export const CANCEL_TRANSCRIPTION_JOB = gql`
  mutation CancelTranscriptionJob($id: ID!) {
    transcriptionJobCancel(id: $id) {
      ${TRANSCRIPTION_JOB_FIELDS}
    }
  }
`;

export const REMOVE_TRANSCRIPTION_JOB = gql`
  mutation RemoveTranscriptionJob($id: ID!) {
    transcription_jobsRemoveOneById(id: $id) {
      id
    }
  }
`;

/**
 * Deletes the knowledge item a saved job produced (the cascade checkbox in
 * the delete confirm). Transcripts live in the context named "transcriptions"
 * — the same hardcoded home the saved-row "Open in library" link points at.
 */
export const REMOVE_SAVED_TRANSCRIPT_ITEM = gql`
  mutation RemoveSavedTranscriptItem($id: ID!) {
    transcriptions_itemsRemoveOneById(id: $id) {
      id
    }
  }
`;

/* ----------------------- Recall meeting-bot operations ----------------------- */

/** Send a Recall bot to a meeting URL and create a recall transcription job. */
export const MEETING_BOT_START = gql`
  mutation MeetingBotStart($input: MeetingBotStartInput!) {
    meetingBotStart(input: $input) {
      ${TRANSCRIPTION_JOB_FIELDS}
    }
  }
`;

/** Manually (re-)run a single {prompt, agent} post-processing pair. */
export const RUN_TRANSCRIPT_POST_PROCESSING = gql`
  mutation RunTranscriptPostProcessing($id: ID!, $prompt_id: ID!, $agent_id: ID!) {
    runTranscriptPostProcessing(id: $id, prompt_id: $prompt_id, agent_id: $agent_id) {
      ${TRANSCRIPTION_JOB_FIELDS}
    }
  }
`;

/* ----------------------- Live (browser) recording operations ----------------------- */

/** Open a live recording row (source 'live', status 'recording'); chunks then go to POST /transcription-jobs/:id/chunks. */
export const LIVE_RECORDING_START = gql`
  mutation LiveRecordingStart($input: LiveRecordingStartInput!) {
    liveRecordingStart(input: $input) {
      ${TRANSCRIPTION_JOB_FIELDS}
    }
  }
`;

/** Close a live recording: 'recording' → 'awaiting_review' (+ optional audio key / total duration). */
export const LIVE_RECORDING_STOP = gql`
  mutation LiveRecordingStop($id: ID!, $input: LiveRecordingStopInput) {
    liveRecordingStop(id: $id, input: $input) {
      ${TRANSCRIPTION_JOB_FIELDS}
    }
  }
`;

/**
 * On-demand fallback for a meeting job with no permanent local video copy —
 * resolves a fresh signed URL straight from Recall. Expires in ~6h; never
 * cache/store the result, re-fetch each time the video is opened.
 */
export const GET_RECORDING_VIDEO_URL = gql`
  query GetRecordingVideoUrl($job_id: ID!) {
    recordingVideoUrl(job_id: $job_id)
  }
`;

/** Current month's meeting-recording usage against the optional monthly cap. */
export const GET_MEETING_RECORDING_USAGE = gql`
  query GetMeetingRecordingUsage {
    meetingRecordingUsage {
      enabled
      used_seconds
      limit_seconds
      percent
      exceeded
    }
  }
`;

/** Prompt library entries for the post-processing picker. */
export const GET_PROMPT_LIBRARY = gql`
  query GetPromptLibraryForTranscriptions(
    $page: Int = 1
    $limit: Int = 100
    $filters: [FilterPrompt_library_item]
    $sort: SortBy = { field: "name", direction: ASC }
  ) {
    prompt_libraryPagination(page: $page, limit: $limit, sort: $sort, filters: $filters) {
      pageInfo {
        itemCount
      }
      items {
        id
        name
        description
      }
    }
  }
`;

/** Agents for the post-processing picker. */
export const GET_PICKER_AGENTS = gql`
  query GetAgentsForTranscriptions(
    $page: Int = 1
    $limit: Int = 200
    $filters: [FilterAgent]
    $sort: SortBy = { field: "name", direction: ASC }
  ) {
    agentsPagination(page: $page, limit: $limit, sort: $sort, filters: $filters) {
      pageInfo {
        itemCount
      }
      items {
        id
        name
      }
    }
  }
`;

/**
 * Agents for the ask-box picker (task-10 brief, Step 7). `tools` is the bare
 * JSON scalar (same field the agent editor's detail query selects — no
 * subfields), parsed client-side to find the `agentic_context_search` tool's
 * `knowledge_bases` entry and test whether it includes "transcriptions".
 * Kept separate from `GET_PICKER_AGENTS` above (post-processing picker,
 * `id name` only) so widening this selection can't affect that consumer.
 */
export const GET_TRANSCRIPT_ASK_AGENTS = gql`
  query GetTranscriptAskAgents(
    $page: Int = 1
    $limit: Int = 200
    $filters: [FilterAgent]
    $sort: SortBy = { field: "name", direction: ASC }
  ) {
    agentsPagination(page: $page, limit: $limit, sort: $sort, filters: $filters) {
      items {
        id
        name
        tools
      }
    }
  }
`;

const PROJECT_FIELDS = `
  id
  name
  description
  image
  custom_instructions
  rights_mode
  created_by
  createdAt
  updatedAt
  project_items
  RBAC {
    type
    users {
      id
      rights
    }
    roles {
      id
      rights
    }
  }
`;

/**
 * Verbatim copy of the monolith's GET_PROJECTS (this page assigns transcripts
 * to projects). When projects ops graduate to lib/graphql/operations/, this
 * import swaps to that home.
 */
export const GET_PROJECTS = gql`
  query GetProjects(
    $page: Int!
    $limit: Int!
    $filters: [FilterProject]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    projectsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

/**
 * Saved transcripts, through the generic per-context pagination. Items carry
 * the RBAC the home's Shared-with-me tab, search and filters all rely on, so
 * this needs no bespoke resolver (spec §1.1).
 */
export const GET_TRANSCRIPT_ITEMS = gql`
  query TranscriptItems(
    $page: Int!
    $limit: Int!
    $filters: [FilterTranscriptions_items]
    $sort: SortBy = { field: "recorded_at", direction: DESC }
  ) {
    transcriptions_itemsPagination(page: $page, limit: $limit, filters: $filters, sort: $sort) {
      pageInfo {
        itemCount
        hasNextPage
      }
      items {
        id
        name
        recording_source
        job_id
        recorded_at
        duration_seconds
        speaker_count
        project_id
        rights_mode
        created_by
        post_processing
      }
    }
  }
`;

/**
 * Single saved transcript for the reading view (task-10 brief, Step 5):
 * `GET_TRANSCRIPT_ITEMS`' field list plus the content/media/RBAC fields the
 * document needs. `corrected_segments` and `updatedAt` were added by task-12
 * (edit mode + its conflict guard) — see the `TranscriptItemDetail` doc
 * comment in types.ts.
 */
export const GET_TRANSCRIPT_ITEM = gql`
  query GetTranscriptItem($id: String!) {
    transcriptions_itemsPagination(page: 1, limit: 1, filters: [{ id: { eq: $id } }]) {
      items {
        id
        name
        recording_source
        job_id
        recorded_at
        duration_seconds
        speaker_count
        project_id
        rights_mode
        created_by
        post_processing
        transcript_text
        raw_segments
        corrected_segments
        speakers
        language
        audio_s3key
        video_s3key
        recall_recording_id
        updatedAt
        RBAC {
          type
          users {
            id
            rights
          }
          roles {
            id
            rights
          }
        }
      }
    }
  }
`;

/**
 * Bulk archive for the home page's selection bar. Same shape
 * `app/(application)/data/queries.ts`'s generic `UPDATE_ITEM("transcriptions")`
 * would produce — colocated here instead of importing that factory, which
 * would cross the `transcriptions` → `data` feature boundary the tier-boundary
 * eslint rule forbids (codebase-structure §1.2: "Promote shared code to
 * components/widgets or lib/", not reach across features for a data op this
 * feature can hold itself). Bulk delete reuses the existing
 * REMOVE_SAVED_TRANSCRIPT_ITEM above; there is no bulk-archive equivalent yet.
 */
export const UPDATE_TRANSCRIPT_ITEM = gql`
  mutation UpdateOneByIdTranscriptions($id: ID!, $input: transcriptions_itemsInput!) {
    transcriptions_itemsUpdateOneById(id: $id, input: $input) {
      item {
        id
      }
      job
    }
  }
`;

/**
 * Bulk share for the home page's selection bar — the mutation document
 * `BulkAccessDialog` (now `components/widgets/bulk-access-dialog.tsx`) needs
 * passed in via its `mutation` prop, since the widgets tier may not import
 * `@/app/*` to build `BULK_UPDATE_ITEM_RBAC("transcriptions")` itself. Same
 * shape that factory produces for this context, colocated here for the same
 * reason as `UPDATE_TRANSCRIPT_ITEM` above.
 */
export const BULK_UPDATE_TRANSCRIPT_ITEMS_RBAC = gql`
  mutation BulkUpdateRBACtranscriptions(
    $ids: [ID!]!
    $rights_mode: String!
    $rbac: RBACInput
  ) {
    transcriptions_itemsBulkUpdateRBAC(ids: $ids, rights_mode: $rights_mode, RBAC: $rbac) {
      message
      itemCount
    }
  }
`;

/* ----------------------- Transcripts settings (admin) ----------------------- */

/**
 * One workspace-level settings object (settings design doc §1) — not
 * per-context, so a plain `gql` constant rather than a context-id factory
 * like GET_EMBEDDER_INFO elsewhere in this codebase. Each field resolves
 * database -> env -> code; `source` tells the settings page which one won.
 *
 * `videoRetentionHours` and `monthlyRecordingLimitMinutes` are really
 * `number | sentinel` ("forever" / "none"), but the SDL types both as String
 * so the sentinel crosses the wire verbatim — the backend sends
 * `String(value)` (src/graphql/mutations/index.ts's buildTranscriptsSettingsInfo)
 * and hooks.ts parses the string back with the same rule, in reverse.
 */
const TRANSCRIPTS_SETTINGS_FIELDS = `
  botName { value source }
  notifyChat { value source }
  recordersMayOverrideBot { value source }
  defaultRightsMode { value source }
  summaryPresets { value { prompt_id agent_id } source }
  videoRetentionHours { value source }
  storeVideoLocally { value source }
  monthlyRecordingLimitMinutes { value source }
  videoStorageCostPerHour { value source }
  stalePresets { prompt_id agent_id }
`;

export const GET_TRANSCRIPTS_SETTINGS = gql`
  query GetTranscriptsSettings {
    transcriptsSettings {
      ${TRANSCRIPTS_SETTINGS_FIELDS}
    }
  }
`;

/**
 * Returns the same shape as GET_TRANSCRIPTS_SETTINGS so a save and the
 * page's own refetch stay in sync. `input` must carry only the fields the
 * saving section owns — an omitted key means "leave alone", an explicit
 * `null` means "clear back to the env/code default" (hooks.ts's
 * buildSettingsInput enforces this).
 */
export const SET_TRANSCRIPTS_SETTINGS = gql`
  mutation SetTranscriptsSettings($input: TranscriptsSettingsInput!) {
    setTranscriptsSettings(input: $input) {
      ${TRANSCRIPTS_SETTINGS_FIELDS}
    }
  }
`;
