/**
 * GraphQL documents for server-side bulk import (spec
 * docs/superpowers/specs/2026-10-21-server-side-bulk-import-design.md).
 *
 * Mutation field names follow the generated-items-table convention already
 * used by `${context}_itemsCreateOne` / `${context}_itemsExecuteSource`
 * (app/(application)/data/queries.ts): the plural `_items` segment, not the
 * singular `_item` — verified against the backend branch.
 */
import { gql } from "@apollo/client";

/** One CSV-column-to-field mapping entry, as sent to StartImportInput.mapping. */
export interface StartImportMappingInput {
  header: string;
  fieldName?: string | null;
}

/**
 * Batch access for created rows. `users`/`roles`/`teams` are typed `JSON` on
 * the backend (arbitrary grant-list shape), not a typed input object.
 */
export interface StartImportAccessInput {
  rights_mode: string;
  users?: unknown;
  roles?: unknown;
  teams?: unknown;
}

export interface StartImportOptionsInput {
  skipEmbeddings?: boolean;
  /** The CSV's detected delimiter (papaparse `meta.delimiter`), passed through so the worker parses the uploaded file the same way the browser did. */
  delimiter?: string;
}

export interface StartImportInput {
  s3Key: string;
  fileName: string;
  /**
   * Optional, matching the SDL (`mapping: [StartImportMappingInput!]`):
   * omitting it tells the worker to auto-map the file's headers, which is
   * what a retry over an error report needs. An EMPTY array is not the same
   * thing — it maps every column to "ignore" (NO_MAPPABLE_COLUMNS).
   */
  mapping?: StartImportMappingInput[];
  access: StartImportAccessInput;
  options?: StartImportOptionsInput;
  totalRows?: number;
}

export interface StartImportPayload {
  jobResultId: string;
}

export interface CancelImportPayload {
  ok: boolean;
}

/** `mutation <context>_itemsStartImport(input: StartImportInput!) → { jobResultId }`. */
export const START_IMPORT = (context: string) => gql`
  mutation StartImport${context}($input: StartImportInput!) {
    ${context}_itemsStartImport(input: $input) {
      jobResultId
    }
  }
`;

/** `mutation <context>_itemsCancelImport(jobResultId: ID!) → { ok }`. */
export const CANCEL_IMPORT = (context: string) => gql`
  mutation CancelImport${context}($jobResultId: ID!) {
    ${context}_itemsCancelImport(jobResultId: $jobResultId) {
      ok
    }
  }
`;

/**
 * Lists import job rows (job_result rows with type "import"). `sort`'s
 * `direction` is an unquoted EnumValue (`DESC`, not `"DESC"`) — SortBy.direction
 * is the enum `SortDirection!`, and a quoted string in a document literal
 * fails GraphQL validation (frontend precedent: workflows/queries.ts,
 * (home)/queries.ts). `field` stays a quoted string — SortBy.field is `String!`.
 */
export const GET_IMPORT_JOBS = gql`
  query ImportJobs($filters: [FilterJob_result], $limit: Int) {
    job_resultsPagination(
      filters: $filters
      sort: { field: "createdAt", direction: DESC }
      limit: $limit
    ) {
      items {
        id
        label
        state
        type
        context
        trigger
        trigger_metadata
        metadata
        result
        error
        createdAt
        updatedAt
      }
    }
  }
`;

/** Filters GET_IMPORT_JOBS down to one context's import jobs. */
export const importJobFilters = (contextId: string) => [
  { context: { eq: contextId } },
  { type: { eq: "import" } },
];

/** Filters GET_IMPORT_JOBS down to a single job by id (polling a running import). */
export const importJobByIdFilters = (id: string) => [{ id: { eq: id } }];

/**
 * Backend error codes a failed import mutation can throw (`new Error(code)`
 * — the thrown message IS the code, no wrapping). The UI maps these to copy
 * in a later task; this module only recognises them.
 */
export type ImportErrorCode =
  | "CONTEXT_NOT_FOUND"
  | "IMPORT_ALREADY_RUNNING"
  | "IMPORT_S3_KEY_OUTSIDE_BUCKET"
  | "IMPORT_S3_KEY_NOT_ALLOWED"
  | "NOT_AUTHORIZED"
  | "IMPORT_NOT_FOUND"
  | "INVALID_RIGHTS_MODE"
  | "QUEUES_NOT_LICENSED";

const IMPORT_ERROR_CODES: readonly ImportErrorCode[] = [
  "CONTEXT_NOT_FOUND",
  "IMPORT_ALREADY_RUNNING",
  "IMPORT_S3_KEY_OUTSIDE_BUCKET",
  "IMPORT_S3_KEY_NOT_ALLOWED",
  "NOT_AUTHORIZED",
  "IMPORT_NOT_FOUND",
  "INVALID_RIGHTS_MODE",
  "QUEUES_NOT_LICENSED",
];

function isImportErrorCode(value: string): value is ImportErrorCode {
  return (IMPORT_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Pulls the bare error message out of whatever shape the caller has on
 * hand: a plain `Error` (message IS the code), an Apollo-style error object
 * (`graphQLErrors[0].message` — checked first, since Apollo's own
 * `.message` is a decorated "GraphQL error: <code>" string), or a raw string.
 */
function extractMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return null;
  const err = error as {
    graphQLErrors?: Array<{ message?: unknown }>;
    message?: unknown;
  };
  const fromGraphQLErrors = err.graphQLErrors?.[0]?.message;
  if (typeof fromGraphQLErrors === "string") return fromGraphQLErrors;
  if (typeof err.message === "string") return err.message;
  return null;
}

/** Extracts a recognised ImportErrorCode from an Apollo/GraphQL error, or null. */
export function importErrorCode(error: unknown): ImportErrorCode | null {
  const message = extractMessage(error)?.trim();
  if (!message) return null;
  return isImportErrorCode(message) ? message : null;
}
