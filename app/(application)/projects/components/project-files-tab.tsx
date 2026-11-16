"use client";

/**
 * Files tab: the project's shared folder, managed outside a chat. The same
 * FilesPanelContent the chat sidebar uses, in a bounded card so it reads as
 * a page section rather than a narrow side panel. `canWrite` rides on the
 * folder listing, so the tab lists once up front (skeleton meanwhile) and
 * only then mounts the panel with the right scope; later polls inside the
 * panel keep it current (rights can change while the page is open).
 */

import { FolderLock } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FilesPanelContent } from "@/components/widgets/files-panel/panel-content";
import {
  ProjectFilesAccessError,
  projectFilesApi,
} from "@/lib/api/project-files";

type State =
  | { status: "loading" }
  | { status: "no-access" }
  | { status: "error"; message: string }
  | { status: "ready"; canWrite: boolean };

export function ProjectFilesTab({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    projectFilesApi
      .list(projectId)
      .then((res) => {
        if (!cancelled) setState({ status: "ready", canWrite: res.canWrite });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof ProjectFilesAccessError
            ? { status: "no-access" }
            : {
                status: "error",
                message: err instanceof Error ? err.message : String(err),
              },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, attempt]);

  const canWrite = state.status === "ready" ? state.canWrite : false;
  const scope = React.useMemo(
    () => ({
      kind: "project" as const,
      projectId,
      name: projectName,
      canWrite,
    }),
    [projectId, projectName, canWrite],
  );

  if (state.status === "loading") {
    return (
      <div aria-hidden="true" className="max-w-2xl space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (state.status === "no-access") {
    return (
      <EmptyState icon={FolderLock} title={t("projectFiles.noAccess")} />
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        variant="error"
        title={t("detail.errorTitle")}
        description={state.message}
        action={{
          label: tCommon("retry"),
          onClick: () => setAttempt((n) => n + 1),
        }}
      />
    );
  }

  return (
    // Fixed height: the panel variant fills its parent and scrolls its own list.
    <div className="h-[32rem] max-h-[70vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border">
      <FilesPanelContent
        scope={scope}
        note={t("projectFiles.note")}
        onAccessLost={() => setState({ status: "no-access" })}
        onListed={(listing) => {
          const next = listing.canWrite ?? false;
          setState((curr) =>
            curr.status === "ready" && curr.canWrite !== next
              ? { status: "ready", canWrite: next }
              : curr,
          );
        }}
      />
    </div>
  );
}
