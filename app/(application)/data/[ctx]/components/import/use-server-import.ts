"use client";

import { useApolloClient, type ApolloClient } from "@apollo/client";
import * as React from "react";

import { ConfigContext } from "@/components/shell/config-context";
import {
  CANCEL_IMPORT,
  START_IMPORT,
  importErrorCode,
  type ImportErrorCode,
  type StartImportInput,
} from "@/lib/api/imports";
import { serverImportAvailable } from "@/lib/import/mode";
import type { BatchAccess } from "@/lib/import/types";
import { uploadFileToS3 } from "@/lib/import/upload";

export type ServerImportPhase =
  | "idle"
  | "uploading"
  | "starting"
  | "running"
  | "error";

/**
 * Error identities the run step maps to copy: the backend's own codes plus
 * the one refusal this hook raises itself. `null` with a non-null `error`
 * means "unrecognised" — the raw message is shown instead.
 */
export type ServerImportErrorCode =
  | ImportErrorCode
  | "SERVER_IMPORT_UNAVAILABLE";

export interface ServerImportMapping {
  header: string;
  fieldName: string | null;
}

export interface ServerImportOptions {
  skipEmbeddings?: boolean;
  delimiter?: string;
}

export interface ServerImportStartArgs {
  file: File;
  mapping: ServerImportMapping[];
  access: BatchAccess;
  totalRows: number;
  options?: ServerImportOptions;
}

export interface ServerImportStartFromKeyArgs {
  s3Key: string;
  fileName: string;
  /**
   * Omitted (not an empty array) when no mapping is known — the worker then
   * auto-maps the file's headers, which is what a retry over the error
   * report needs. An empty array would map every column to "ignore" and the
   * job would abort with NO_MAPPABLE_COLUMNS.
   */
  mapping?: ServerImportMapping[];
  access: BatchAccess;
  /** Unknown for a retry — omitted from the input rather than sent as 0. */
  totalRows?: number;
  options?: ServerImportOptions;
}

export interface UseServerImport {
  phase: ServerImportPhase;
  jobResultId: string | null;
  /** Raw failure message (an error code, when the backend threw one). */
  error: string | null;
  errorCode: ServerImportErrorCode | null;
  cancelling: boolean;
  start: (args: ServerImportStartArgs) => Promise<void>;
  startFromKey: (args: ServerImportStartFromKeyArgs) => Promise<void>;
  cancel: () => Promise<void>;
  /** Take over a job that is already running (the wizard was reopened). */
  adopt: (jobResultId: string) => void;
  reset: () => void;
}

export interface UseServerImportDeps {
  /** Injected in tests; defaults to `useApolloClient()`. */
  client?: ApolloClient<object>;
  upload?: (file: File) => Promise<string>;
}

/**
 * Drives a server-side bulk import: upload the CSV, start the backend job,
 * hand back its `jobResultId` (which the run step polls), and cancel on
 * request.
 *
 * Two deliberate non-behaviours:
 *  - nothing is uploaded when the deployment can't run server imports; the
 *    refusal happens before the first byte leaves the browser (Review
 *    Focus 3), because an upload would cost the user a long wait and leave
 *    an orphaned object in storage;
 *  - unmounting does NOT cancel (Review Focus 4). Closing the wizard is not
 *    a cancel — the job runs in the worker and the user can come back to it.
 */
export function useServerImport(
  contextId: string,
  deps?: UseServerImportDeps,
): UseServerImport {
  const defaultClient = useApolloClient();
  const client = deps?.client ?? defaultClient;
  const upload = deps?.upload ?? uploadFileToS3;
  const config = React.useContext(ConfigContext);
  const available = serverImportAvailable(config);

  const [phase, setPhase] = React.useState<ServerImportPhase>("idle");
  const [jobResultId, setJobResultId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [errorCode, setErrorCode] =
    React.useState<ServerImportErrorCode | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  // `cancel` is called from a button rendered next to freshly polled data;
  // the ref keeps it off the hook's returned identity churn.
  const jobRef = React.useRef<string | null>(null);
  jobRef.current = jobResultId;

  const fail = React.useCallback((e: unknown) => {
    const code = importErrorCode(e);
    setErrorCode(code);
    setError(
      code ??
        (e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : String(e)),
    );
    setPhase("error");
  }, []);

  const runStart = React.useCallback(
    async (args: ServerImportStartFromKeyArgs) => {
      setPhase("starting");
      const input: StartImportInput = {
        s3Key: args.s3Key,
        fileName: args.fileName,
        ...(args.mapping
          ? {
              mapping: args.mapping.map((m) => ({
                header: m.header,
                fieldName: m.fieldName,
              })),
            }
          : {}),
        // rights_mode decides whether the worker reads the grant lists at
        // all (private/public carry none), so they go over as given.
        access: {
          rights_mode: args.access.rights_mode,
          users: args.access.users,
          roles: args.access.roles,
          teams: args.access.teams,
        },
        ...(args.options ? { options: args.options } : {}),
        ...(typeof args.totalRows === "number"
          ? { totalRows: args.totalRows }
          : {}),
      };
      const { data } = await client.mutate({
        mutation: START_IMPORT(contextId),
        variables: { input },
      });
      const id = data?.[`${contextId}_itemsStartImport`]?.jobResultId;
      if (!id) throw new Error("The import started without a job id.");
      setJobResultId(id);
      setPhase("running");
    },
    [client, contextId],
  );

  const guard = React.useCallback((): boolean => {
    if (available) return true;
    setErrorCode("SERVER_IMPORT_UNAVAILABLE");
    setError("SERVER_IMPORT_UNAVAILABLE");
    setPhase("error");
    return false;
  }, [available]);

  const begin = React.useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const start = React.useCallback(
    async (args: ServerImportStartArgs) => {
      if (!guard()) return;
      begin();
      setPhase("uploading");
      try {
        const s3Key = await upload(args.file);
        await runStart({
          s3Key,
          fileName: args.file.name,
          mapping: args.mapping,
          access: args.access,
          totalRows: args.totalRows,
          options: args.options,
        });
      } catch (e) {
        fail(e);
      }
    },
    [begin, fail, guard, runStart, upload],
  );

  const startFromKey = React.useCallback(
    async (args: ServerImportStartFromKeyArgs) => {
      if (!guard()) return;
      begin();
      try {
        await runStart(args);
      } catch (e) {
        fail(e);
      }
    },
    [begin, fail, guard, runStart],
  );

  const cancel = React.useCallback(async () => {
    const id = jobRef.current;
    if (!id) return;
    setCancelling(true);
    try {
      await client.mutate({
        mutation: CANCEL_IMPORT(contextId),
        variables: { jobResultId: id },
      });
      // The row's own state (cancelled) is what the run step renders — it
      // arrives with the next poll, so nothing is set optimistically here.
    } catch (e) {
      fail(e);
    } finally {
      setCancelling(false);
    }
  }, [client, contextId, fail]);

  const adopt = React.useCallback((id: string) => {
    setError(null);
    setErrorCode(null);
    setJobResultId(id);
    setPhase("running");
  }, []);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setJobResultId(null);
    setError(null);
    setErrorCode(null);
    setCancelling(false);
  }, []);

  return {
    phase,
    jobResultId,
    error,
    errorCode,
    cancelling,
    start,
    startFromKey,
    cancel,
    adopt,
    reset,
  };
}
