"use client";

import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { artifactType, displayFilename, type ArtifactType } from "@/lib/artifacts/artifact-type";

import {
  GET_SHARED_ARTIFACTS,
  GET_USER_FAVOURITE_ARTIFACTS,
  UPDATE_USER_FAVOURITE_ARTIFACTS,
} from "./queries";

export type SharedArtifactRow = {
  id: string;
  name: string;
  s3key: string;
  auth_mode: "public" | "password" | "regular";
  expires_at: string | null;
  content_type: string | null;
  rights_mode: string | null;
  created_by: number | null;
  createdAt: string;
  updatedAt: string;
};

export interface ArtifactListItem {
  id: string;
  name: string;
  filename: string;
  type: ArtifactType;
  authMode: SharedArtifactRow["auth_mode"];
  expiresAt: string | null;
  expired: boolean;
  mine: boolean;
  createdAt: string;
  /** The in-shell viewer. */
  href: string;
  /** The published share link (own origin). */
  shareUrl: string;
}

const LIST_LIMIT = 500;

function toItem(row: SharedArtifactRow, userId: number | undefined, now: Date): ArtifactListItem {
  const filename = displayFilename(row.s3key);
  const expired = !!row.expires_at && new Date(row.expires_at).getTime() <= now.getTime();
  return {
    id: row.id,
    name: row.name,
    filename,
    type: artifactType(filename, row.content_type),
    authMode: row.auth_mode,
    expiresAt: row.expires_at,
    expired,
    mine: userId !== undefined && row.created_by === userId,
    createdAt: row.createdAt,
    href: `/artifacts/open/${encodeURIComponent(row.name)}`,
    shareUrl: `/artifacts/${encodeURIComponent(row.name)}`,
  };
}

/** Every shared artifact the viewer may read, newest first; expired ones are kept but marked. */
export function useSharedArtifacts() {
  const { user } = React.useContext(UserContext);
  const userId: number | undefined = typeof user?.id === "number" ? user.id : undefined;
  const { data, loading, error, refetch } = useQuery(GET_SHARED_ARTIFACTS, {
    fetchPolicy: "cache-and-network",
    variables: { limit: LIST_LIMIT },
  });
  const items = React.useMemo<ArtifactListItem[]>(() => {
    const rows: SharedArtifactRow[] = data?.shared_artifactsPagination?.items ?? [];
    const now = new Date();
    return rows.map((row) => toItem(row, userId, now));
  }, [data, userId]);
  return { items, loading: loading && !data, error, refetch };
}

// A module-level store, as the projects favourites keep: every mount of the
// hook sees the same array, an optimistic toggle is never clobbered by a
// slower response, and a failed write reverts only the one name it toggled.
let favoriteStore: string[] | undefined;
const listeners = new Set<() => void>();
let togglesInFlight = 0;

function readStore(): string[] | undefined {
  return favoriteStore;
}
function writeStore(next: string[]): void {
  favoriteStore = next;
  for (const l of listeners) l();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFavoriteArtifacts() {
  const { user } = React.useContext(UserContext);
  const userId: number | undefined = typeof user?.id === "number" ? user.id : undefined;
  const seed: string[] | undefined = Array.isArray(user?.favourite_artifacts) ? user.favourite_artifacts : undefined;
  const storeIds = React.useSyncExternalStore(subscribe, readStore, readStore);
  const favoriteNames = React.useMemo(() => storeIds ?? seed ?? [], [storeIds, seed]);

  useQuery(GET_USER_FAVOURITE_ARTIFACTS, {
    fetchPolicy: "network-only",
    variables: { id: userId },
    skip: !userId,
    onCompleted: (result) => {
      const server = result?.userById?.favourite_artifacts;
      if (Array.isArray(server) && togglesInFlight === 0) writeStore(server.filter((n: unknown): n is string => typeof n === "string"));
    },
  });

  const [update] = useMutation(UPDATE_USER_FAVOURITE_ARTIFACTS);

  const toggle = React.useCallback(
    async (name: string) => {
      if (!userId) return;
      const base = readStore() ?? seed ?? [];
      const removing = base.includes(name);
      const next = removing ? base.filter((n) => n !== name) : [...base, name];
      writeStore(next);
      togglesInFlight++;
      try {
        const { data: result } = await update({ variables: { id: userId, favourite_artifacts: next } });
        const confirmed = result?.usersUpdateOne?.item?.favourite_artifacts;
        if (Array.isArray(confirmed) && togglesInFlight === 1) writeStore(confirmed);
      } catch {
        const current = readStore() ?? [];
        writeStore(removing ? (current.includes(name) ? current : [...current, name]) : current.filter((n) => n !== name));
      } finally {
        togglesInFlight--;
      }
    },
    [userId, seed, update],
  );

  const isFavorite = React.useCallback((name: string) => favoriteNames.includes(name), [favoriteNames]);
  return { favoriteNames, isFavorite, toggle, canFavorite: !!userId };
}
