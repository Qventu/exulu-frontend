"use client";

import { useApolloClient } from "@apollo/client";
import * as React from "react";

import { runImport } from "@/lib/import/runner";
import type { RunSummary } from "@/lib/import/runner";
import type { ImportField, ImportRow, RowRunState } from "@/lib/import/types";
import { uploadFileToS3 } from "@/lib/import/upload";

import { CREATE_ITEM, UPDATE_ITEM } from "../../../queries";

export type ImportPhase = "edit" | "running" | "done";

export function useImportRunner(contextId: string, fields: ImportField[]) {
  const client = useApolloClient();
  const [phase, setPhase] = React.useState<ImportPhase>("edit");
  const [rowStates, setRowStates] = React.useState<
    Record<string, { state: RowRunState; error?: string }>
  >({});
  const [summary, setSummary] = React.useState<RunSummary | null>(null);
  const cancelRef = React.useRef(false);

  const run = React.useCallback(
    async (rows: ImportRow[]) => {
      cancelRef.current = false;
      setPhase("running");
      setSummary(null);
      const result = await runImport(
        rows,
        fields,
        {
          uploadFile: uploadFileToS3,
          createItem: async (input) => {
            await client.mutate({
              mutation: CREATE_ITEM(contextId, []),
              variables: { input },
            });
          },
          updateItem: async (id, input) => {
            await client.mutate({
              mutation: UPDATE_ITEM(contextId),
              variables: { id, input },
            });
          },
        },
        {
          concurrency: 4,
          isCancelled: () => cancelRef.current,
          onRowState: (key, state, error) =>
            setRowStates((prev) => ({ ...prev, [key]: { state, error } })),
        },
      );
      setSummary(result);
      setPhase("done");
      try {
        // Refresh the (dynamic per-context) items list queries.
        await client.refetchQueries({ include: "active" });
      } catch {
        // List refresh is best-effort; the import itself succeeded.
      }
    },
    [client, contextId, fields],
  );

  const cancel = React.useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = React.useCallback(() => {
    cancelRef.current = false;
    setPhase("edit");
    setRowStates({});
    setSummary(null);
  }, []);

  const doneCount = Object.values(rowStates).filter(
    (s) => s.state === "done" || s.state === "failed",
  ).length;

  return { phase, rowStates, summary, doneCount, run, cancel, reset };
}
