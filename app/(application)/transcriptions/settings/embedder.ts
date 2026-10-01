"use client";

/**
 * Local embedder data for the Sources section — fetches the `transcriptions`
 * Context and its embedder config so `StageEmbedder` (components/widgets,
 * promoted there specifically so this page could reuse it rather than build
 * a second picker) can be rendered here exactly as it is in /data/[ctx]'s
 * Pipeline tab.
 *
 * Deliberately NOT importing `app/(application)/data/hooks` or `data/queries`
 * — the tier-boundary `no-restricted-imports` rule forbids one feature
 * folder reaching into another's (eslint.config.mjs "exulu/feature-*"), the
 * same rule `transcript-document.tsx`'s file header documents hitting for
 * `ItemAccessSection`. These operations are duplicated instead, the same way
 * `workflows/queries.ts` keeps its own `GET_AVAILABLE_QUEUES` rather than
 * importing the data feature's copy (distinct operation names on purpose —
 * see that file's comment — so Apollo never sees two documents with the same
 * name). The embedder info/set-embedder fields are specific to the
 * `transcriptions` context (`transcriptions_itemsEmbedderInfo` /
 * `transcriptions_itemsSetEmbedder`), so there is no context-id factory to
 * share in the first place — these are plain `gql` constants, like
 * Task 6's settings operations.
 */
import { useMutation, useQuery } from "@apollo/client";
import { gql } from "@apollo/client";

import type {
  EmbedderChangeDialogInfo,
  EmbedderModelOption,
  EmbedderQueueOption,
} from "@/components/widgets/stage-embedder";
import type { Context } from "@/types/models/context";

const TRANSCRIPTS_CONTEXT_FIELDS = `
  id
  name
  description
  embedder {
    model
    queue
  }
  slug
  active
  fields
  configuration
  processor {
    name
    description
    queue
    trigger
    timeoutInSeconds
    generateEmbeddings
  }
  sources {
    id
    name
    description
    config {
      params {
        name
        description
        default
      }
      schedule
      queue
      retries
      backoff {
        type
        delay
      }
    }
  }
`;

export const GET_TRANSCRIPTS_CONTEXT = gql`
  query TranscriptsSettingsContext {
    contextById(id: "transcriptions") {
      ${TRANSCRIPTS_CONTEXT_FIELDS}
    }
  }
`;

const EMBEDDER_INFO_FIELDS = `
  effectiveModel
  source
  databaseModel
  codeModel
  databaseQueue
  dimensionality
  chunkCount
`;

export const GET_TRANSCRIPTS_EMBEDDER_INFO = gql`
  query TranscriptsSettingsEmbedderInfo {
    transcriptions_itemsEmbedderInfo {
      ${EMBEDDER_INFO_FIELDS}
    }
  }
`;

export const SET_TRANSCRIPTS_EMBEDDER = gql`
  mutation TranscriptsSettingsSetEmbedder($model: String, $queue: String) {
    transcriptions_itemsSetEmbedder(model: $model, queue: $queue) {
      info {
        ${EMBEDDER_INFO_FIELDS}
      }
      rebuild
      itemsQueued
    }
  }
`;

export const GET_TRANSCRIPTS_EMBEDDING_MODELS = gql`
  query TranscriptsSettingsAvailableEmbeddingModels {
    availableEmbeddingModels {
      model
      dimensionality
      maxChunkSize
      maxBatchSize
    }
  }
`;

export const GET_TRANSCRIPTS_EMBEDDER_QUEUES = gql`
  query TranscriptsSettingsAvailableQueues {
    queues {
      name
    }
  }
`;

/** The `transcriptions` Context object, for `StageEmbedder`'s `context` prop.
 *  `skip` lets the page avoid firing this (and the embedder queries below)
 *  for a viewer who turns out not to be a super admin. */
export function useTranscriptsContext(skip = false): {
  context: Context | null;
  loading: boolean;
  error?: Error;
} {
  const { data, loading, error } = useQuery<{ contextById: Context | null }>(
    GET_TRANSCRIPTS_CONTEXT,
    { fetchPolicy: "cache-and-network", skip },
  );
  return {
    context: data?.contextById ?? null,
    loading: loading && !data,
    error: error as Error | undefined,
  };
}

/** Mirrors `useEmbedderSettings` (app/(application)/data/hooks.ts) scoped to
 *  the `transcriptions` context — see the file header for why this is a
 *  separate copy rather than an import. */
export function useTranscriptsEmbedder(skip = false): {
  info?: EmbedderChangeDialogInfo;
  models: EmbedderModelOption[];
  queues: EmbedderQueueOption[];
  loading: boolean;
  setEmbedder: (
    model: string | null,
    queue: string | null,
  ) => Promise<{ rebuild: string; itemsQueued: number }>;
} {
  const infoQuery = useQuery<{ transcriptions_itemsEmbedderInfo: EmbedderChangeDialogInfo }>(
    GET_TRANSCRIPTS_EMBEDDER_INFO,
    { fetchPolicy: "cache-and-network", skip },
  );
  const modelsQuery = useQuery<{ availableEmbeddingModels: EmbedderModelOption[] }>(
    GET_TRANSCRIPTS_EMBEDDING_MODELS,
    { skip },
  );
  const queuesQuery = useQuery<{ queues: EmbedderQueueOption[] }>(
    GET_TRANSCRIPTS_EMBEDDER_QUEUES,
    { skip },
  );
  const [mutate] = useMutation<{
    transcriptions_itemsSetEmbedder: {
      info: EmbedderChangeDialogInfo;
      rebuild: string;
      itemsQueued: number;
    };
  }>(SET_TRANSCRIPTS_EMBEDDER);

  return {
    info: infoQuery.data?.transcriptions_itemsEmbedderInfo,
    models: modelsQuery.data?.availableEmbeddingModels ?? [],
    queues: queuesQuery.data?.queues ?? [],
    loading: infoQuery.loading && !infoQuery.data,
    setEmbedder: async (model, queue) => {
      const result = await mutate({ variables: { model, queue } });
      // Mirrors useEmbedderSettings: the mutation's `info` omits
      // dimensionality/chunkCount, so refetch to keep those current.
      await infoQuery.refetch();
      const payload = result.data?.transcriptions_itemsSetEmbedder;
      if (!payload) {
        throw new Error("Setting the embedding model did not return a result.");
      }
      return { rebuild: payload.rebuild, itemsQueued: payload.itemsQueued };
    },
  };
}
