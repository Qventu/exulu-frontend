// @vitest-environment jsdom
/**
 * Regression test for the final-branch-review Finding 1 (blocker): a
 * reviewed transcript vanished from /transcriptions because ACTIVE_STATUSES
 * — the server-side status filter `useTranscripts` actually sends over
 * GET_TRANSCRIPTION_JOBS — never learned the new "reviewed" status.
 *
 * types.test.ts already covers mergeTranscriptRows() keeping a reviewed job
 * in the merged list, but it calls that function directly, bypassing the
 * query entirely — which is exactly how the bug shipped unnoticed. This test
 * goes through the real `useTranscripts()` -> `useQuery(GET_TRANSCRIPTION_JOBS)`
 * path instead: the mock below only answers a request whose `status.in`
 * list includes "reviewed", so a future edit that narrows ACTIVE_STATUSES
 * back down makes the request go unmatched and this test fail, rather than
 * shipping silently again.
 */
import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { useTranscripts } from "./hooks";
import { GET_TRANSCRIPTION_JOBS, GET_TRANSCRIPT_ITEMS } from "./queries";
import type { Job } from "./types";

const REVIEWED_JOB: Job = {
  id: "job-reviewed-1",
  audio_s3key: "s3://bucket/audio.mp3",
  title: "Reviewed standup",
  status: "reviewed",
  whisper_job_id: null,
  language: "en",
  duration_seconds: 120,
  speakers: null,
  project_id: null,
  target_rights_mode: null,
  target_rbac_users: null,
  target_rbac_roles: null,
  saved_item_id: null,
  error: null,
  rights_mode: "private",
  created_by: 1,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

// Mirrors what hooks.ts actually asks for: ACTIVE_STATUSES through the
// `status.in` filter, plus the query doc's own declared defaults (`sort`,
// `limit`) that Apollo Client merges in before the request goes out.
const jobsMock: MockedResponse = {
  request: {
    query: GET_TRANSCRIPTION_JOBS,
    variables: {
      filters: [
        {
          status: {
            in: [
              "queued",
              "transcribing",
              "recording",
              "awaiting_review",
              "reviewed",
              "failed",
            ],
          },
        },
      ],
      sort: { field: "createdAt", direction: "DESC" },
      limit: 50,
    },
  },
  result: {
    data: {
      transcription_jobsPagination: {
        pageInfo: { itemCount: 1 },
        items: [REVIEWED_JOB],
      },
    },
  },
};

const itemsMock: MockedResponse = {
  request: {
    query: GET_TRANSCRIPT_ITEMS,
    variables: {
      page: 1,
      limit: 50,
      filters: [{ archived: { eq: false } }],
      sort: { field: "recorded_at", direction: "DESC" },
    },
  },
  result: {
    data: {
      transcriptions_itemsPagination: {
        pageInfo: { itemCount: 0, hasNextPage: false },
        items: [],
      },
    },
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MockedProvider mocks={[jobsMock, itemsMock]} addTypename={false}>
      {children}
    </MockedProvider>
  );
}

describe("useTranscripts — ACTIVE_STATUSES through the real GraphQL query", () => {
  it("fetches a reviewed job and surfaces it as a row with state \"reviewed\"", async () => {
    const { result } = renderHook(() => useTranscripts(""), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.initialLoading).toBe(false));

    // No "no matching mock" network error — the request actually sent by
    // the hook matched a mock whose status filter includes "reviewed".
    expect(result.current.jobsError).toBeUndefined();

    const reviewedRow = result.current.rows.find(
      (row) => row.id === REVIEWED_JOB.id,
    );
    expect(reviewedRow).toBeDefined();
    expect(reviewedRow?.state).toBe("reviewed");
  });
});
