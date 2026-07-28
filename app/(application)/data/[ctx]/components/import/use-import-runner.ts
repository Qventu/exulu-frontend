"use client";

import { useApolloClient } from "@apollo/client";
import * as React from "react";

import { mergeBatchAccess, rowIsValid } from "@/lib/import/rows";
import { runImport } from "@/lib/import/runner";
import type { RunSummary } from "@/lib/import/runner";
import type {
  BatchAccess,
  ImportField,
  ImportRow,
  RowRunState,
} from "@/lib/import/types";
import { uploadFileToS3 } from "@/lib/import/upload";

import { CREATE_ITEM, GET_ITEMS, UPDATE_ITEM } from "../../../queries";

export type ImportPhase = "edit" | "running" | "done";

export function useImportRunner(
  contextId: string,
  fields: ImportField[],
  batchAccess: BatchAccess,
) {
  const client = useApolloClient();
  const [phase, setPhase] = React.useState<ImportPhase>("edit");
  const [rowStates, setRowStates] = React.useState<
    Record<string, { state: RowRunState; error?: string }>
  >({});
  const [summary, setSummary] = React.useState<RunSummary | null>(null);
  // Rows actually queued this run (invalid rows are skipped by the engine) —
  // the progress denominator, so the bar can reach 100%.
  const [runTotal, setRunTotal] = React.useState(0);
  const cancelRef = React.useRef(false);

  const run = React.useCallback(
    async (rows: ImportRow[]) => {
      cancelRef.current = false;
      setPhase("running");
      setSummary(null);
      setRunTotal(
        rows.filter((r) => rowIsValid(r) && r.runState !== "done").length,
      );
      const result = await runImport(
        rows,
        fields,
        {
          uploadFile: uploadFileToS3,
          createItem: async (input) => {
            await client.mutate({
              mutation: CREATE_ITEM(contextId, []),
              variables: { input: mergeBatchAccess(input, batchAccess) },
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
        // Refresh the items table behind the dialog. Targeted at the list
        // document (same gql string the table's useQuery holds) instead of
        // `include: "active"`, which swept every mounted query in the app.
        await client.refetchQueries({ include: [GET_ITEMS(contextId, [])] });
      } catch (e) {
        // List refresh is best-effort; the import itself succeeded.
        console.warn("[import] items list refresh failed", e);
      }
      return result;
    },
    [client, contextId, fields, batchAccess],
  );

  const cancel = React.useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = React.useCallback(() => {
    cancelRef.current = false;
    setPhase("edit");
    setRowStates({});
    setSummary(null);
    setRunTotal(0);
  }, []);

  const doneCount = Object.values(rowStates).filter(
    (s) => s.state === "done" || s.state === "failed",
  ).length;

  return { phase, rowStates, summary, doneCount, runTotal, run, cancel, reset };
}
