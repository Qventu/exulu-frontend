"use client";

/**
 * The session's project folder as the chat sees it: the files sidebar's
 * project section, the header chip's count and the "@" autocomplete all read
 * this one value.
 *
 * `null` means "no project section": the session has no project, the caller
 * may not list its files (403), or the project is gone (404). Other failures
 * keep the last value — the count is decorative and a blip must not make the
 * section flicker away.
 *
 * Refreshed on project change, on the files change bus (uploads, promotes),
 * after each turn (the caller), and from the open panel's own 5 s poll via
 * `syncProjectFiles`, so a session detached while the panel is open loses
 * the section on the next poll.
 */

import { useQuery } from "@apollo/client";
import * as React from "react";

import { subscribeFilesChanged } from "@/components/widgets/files-panel/upload";
import {
  ProjectFilesAccessError,
  projectFilesApi,
} from "@/lib/api/project-files";
import type { SessionFile } from "@/lib/api/session-files";

import { GET_CHAT_PROJECT_NAME } from "./queries";

export interface ChatProjectFiles {
  id: string;
  name: string;
  canWrite: boolean;
  files: SessionFile[];
}

type Listing = { projectId: string; canWrite: boolean; files: SessionFile[] };

export function useChatProjectFiles(projectId: string | null | undefined) {
  const [listing, setListing] = React.useState<Listing | null>(null);
  // Latest project id, so a slow answer for a previous project is dropped.
  const projectIdRef = React.useRef(projectId);
  React.useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const refresh = React.useCallback(async () => {
    if (!projectId) {
      setListing(null);
      return;
    }
    try {
      const res = await projectFilesApi.list(projectId);
      if (projectIdRef.current !== projectId) return;
      setListing({ projectId, canWrite: res.canWrite, files: res.files ?? [] });
    } catch (err) {
      if (projectIdRef.current !== projectId) return;
      if (err instanceof ProjectFilesAccessError) setListing(null);
    }
  }, [projectId]);

  React.useEffect(() => {
    setListing(null);
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!projectId) return;
    return subscribeFilesChanged(
      // Only the id keys the bus; name and canWrite are irrelevant here.
      { kind: "project", projectId, name: "", canWrite: false },
      () => void refresh(),
    );
  }, [projectId, refresh]);

  // Asked only once the listing proved access, so a project the caller may
  // not see never reaches GraphQL (and the demo, which has none, never asks).
  const nameQuery = useQuery(GET_CHAT_PROJECT_NAME, {
    variables: { id: projectId },
    skip: !projectId || !listing,
  });
  const name: string | undefined = nameQuery.data?.projectById?.name;

  const syncProjectFiles = React.useCallback(
    (res: { canWrite: boolean; files: SessionFile[] } | null) => {
      const id = projectIdRef.current;
      if (!id || res === null) {
        setListing(null);
        return;
      }
      setListing({ projectId: id, canWrite: res.canWrite, files: res.files });
    },
    [],
  );

  const projectFiles = React.useMemo<ChatProjectFiles | null>(
    () =>
      listing && projectId && listing.projectId === projectId && name
        ? {
            id: projectId,
            name,
            canWrite: listing.canWrite,
            files: listing.files,
          }
        : null,
    [listing, projectId, name],
  );

  return { projectFiles, refreshProjectFiles: refresh, syncProjectFiles };
}
