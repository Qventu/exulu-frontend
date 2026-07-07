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
  bot_status
  join_at
  post_processing_prompts
  post_processing_outputs
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
