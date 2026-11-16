"use client";

/**
 * SessionFilesContent — the files panel CONTENT (chat.md items 80, 80a,
 * 81–84). Mounted INSIDE the SidePanel primitive by session-screen:
 *
 *   <SidePanel open={…} onOpenChange={…} title={t("chat.files.title")}
 *     resizable storageKey="chat-files" mobileSize="full">
 *     {session && <SessionFilesContent sessionId={session.id} />}
 *   </SidePanel>
 *
 * Route-local relocation + rework of components/session-files/
 * session-files-panel.tsx (the SidePanel now owns header/close/resize):
 * - 5s polling via lib/api/session-files (unchanged transport, item 80);
 * - loading = skeleton rows mirroring file rows, empty = shared EmptyState
 *   with the upload zone as its action, error = message + Retry (item 80a);
 * - delete = shared ConfirmDialog (item 81, kills window.confirm);
 * - privacy note on the panel's title info line (item 84);
 * - toasts stay on sonner (chat standardizes on sonner, fixes U8).
 *
 * In a session that belongs to a project, SessionFilesContent stacks two
 * sections instead (the project's shared folder, then the session's), each a
 * FilesPanelContent in its "section" variant; without a project it renders
 * the single panel unchanged.
 *
 * The panel is intentionally session-scoped — both in the UI and in the
 * auth model (every backend route checks the calling user's session
 * prefix). The same S3 prefix is used by the agent's writeFile and bash
 * artifact mirroring, so user-uploaded files appear alongside
 * agent-produced ones.
 */

import { FolderOpen, Info, MessageSquare, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ProjectFilesAccessError,
    projectFilesApi,
} from "@/lib/api/project-files";
import type { SessionFile } from "@/lib/api/session-files";
import { cn } from "@/lib/utils";

import { FileRow } from "./file-row";
import { PreviewPane } from "./preview-pane";
import { fileScopeAdapter, type FileScope } from "./scope";
import { notifyFilesChanged, subscribeFilesChanged } from "./upload";
import { UploadZone } from "./upload-zone";

const POLL_INTERVAL_MS = 5_000;

type FolderListing = { files: SessionFile[]; canWrite?: boolean };

export interface FilesPanelContentProps {
    scope: FileScope;
    /**
     * "panel" (default): owns the full height and scrolls its own list — the
     * single-folder panel. "section": one of several stacked inside a
     * parent's scroll container, with a `header`, a compact upload zone and
     * previews handed to `onPreview` so the parent can show them full-height.
     */
    variant?: "panel" | "section";
    header?: ReactNode;
    /** Replaces the scope's default privacy note. */
    note?: string;
    /** Every successful listing (initial load and each poll). */
    onListed?: (listing: FolderListing) => void;
    /** The listing answered 403/404: the caller may no longer see this folder. */
    onAccessLost?: () => void;
    /** Shows "Add to project" on each row when given. */
    onPromote?: (file: SessionFile) => void;
    onPreview?: (file: SessionFile) => void;
}

/** The project a session belongs to, as far as its files sidebar needs. */
export interface SessionProject {
    id: string;
    name: string;
    /** From the project listing; decides upload, delete and "Add to project". */
    canWrite: boolean;
}

export interface SessionFilesContentProps {
    sessionId: string;
    /** Absent: the session has no project, or the caller may not see its files. */
    project?: SessionProject;
    onProjectListed?: (listing: {
        canWrite: boolean;
        files: SessionFile[];
    }) => void;
    onProjectAccessLost?: () => void;
}

/** Skeleton rows mirroring the file-row anatomy (philosophy §6 / item 80a). */
function FileRowSkeletons({ count = 5 }: { count?: number }) {
    return (
        <div aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                >
                    <Skeleton className="size-4 rounded" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * The chat's files panel. A session without a project gets exactly the
 * single-folder panel it always had; a project session gets the project's
 * shared folder on top and the session's own below (SessionAndProjectFiles).
 */
export function SessionFilesContent({
    sessionId,
    project,
    onProjectListed,
    onProjectAccessLost,
}: SessionFilesContentProps) {
    // Memoised so the scope keeps its identity across the 5 s poll re-renders.
    const scope = useMemo<FileScope>(
        () => ({ kind: "session", sessionId }),
        [sessionId],
    );
    if (!project) return <FilesPanelContent scope={scope} />;
    return (
        <SessionAndProjectFiles
            sessionScope={scope}
            project={project}
            onProjectListed={onProjectListed}
            onProjectAccessLost={onProjectAccessLost}
        />
    );
}

function SectionHeader({
    icon: Icon,
    title,
    tinted,
}: {
    icon: typeof Users;
    title: string;
    tinted?: boolean;
}) {
    return (
        <div
            className={cn(
                "sticky top-0 z-10 flex items-center gap-2 border-b border-l-2 border-border px-3 py-2",
                tinted
                    ? "border-l-primary bg-muted"
                    : "border-l-transparent bg-background",
            )}
        >
            <Icon
                className={cn(
                    "size-3.5 shrink-0",
                    tinted ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
            />
            <h3 className="truncate text-xs font-semibold">{title}</h3>
        </div>
    );
}

type PreviewTarget = { scope: FileScope; file: SessionFile };

/**
 * Two headed sections in one scroll container. Each section polls its own
 * folder; this component owns what spans both: the full-height preview and
 * "Add to project" (promote) with its clash confirm.
 */
function SessionAndProjectFiles({
    sessionScope,
    project,
    onProjectListed,
    onProjectAccessLost,
}: {
    sessionScope: FileScope;
    project: SessionProject;
    onProjectListed?: SessionFilesContentProps["onProjectListed"];
    onProjectAccessLost?: () => void;
}) {
    const t = useTranslations("chat");
    const sessionId =
        sessionScope.kind === "session" ? sessionScope.sessionId : "";
    const projectScope = useMemo<FileScope>(
        () => ({
            kind: "project",
            projectId: project.id,
            name: project.name,
            canWrite: project.canWrite,
        }),
        [project.id, project.name, project.canWrite],
    );

    // Previews take the whole panel, but the sections stay mounted (hidden)
    // so their polls keep the previewed file's metadata current. Derived at
    // render from the latest lists: a deleted file drops back to the list, a
    // re-uploaded one previews its new version.
    const [previewTarget, setPreview] = useState<PreviewTarget | null>(null);
    const [lists, setLists] = useState<{
        session: SessionFile[] | null;
        project: SessionFile[] | null;
    }>({ session: null, project: null });
    let preview = previewTarget;
    if (preview) {
        const list =
            preview.scope.kind === "project" ? lists.project : lists.session;
        const current = list?.find((f) => f.key === preview?.file.key);
        if (list && !current) preview = null;
        else if (current) preview = { scope: preview.scope, file: current };
    }

    const handleProjectListed = useCallback(
        (listing: FolderListing) => {
            setLists((curr) => ({ ...curr, project: listing.files }));
            onProjectListed?.({
                canWrite: listing.canWrite ?? false,
                files: listing.files,
            });
        },
        [onProjectListed],
    );
    const handleSessionListed = useCallback((listing: FolderListing) => {
        setLists((curr) => ({ ...curr, session: listing.files }));
    }, []);

    // A name clash pauses the promote on a confirm; nothing was copied yet.
    const [clash, setClash] = useState<SessionFile | null>(null);
    // A double click must not send two promotes: the second would see the
    // first's file as a clash and open a spurious "Replace it?" dialog.
    const inFlight = useRef<Set<string>>(new Set());
    const promote = async (file: SessionFile, overwrite = false) => {
        if (inFlight.current.has(file.key)) return;
        inFlight.current.add(file.key);
        const failed = (message: string) =>
            toast.error(t("files.promoteFailed", { name: file.name, message }));
        try {
            const res = await projectFilesApi.promote(project.id, {
                sessionId,
                keys: [file.key],
                ...(overwrite ? { overwrite: true } : {}),
            });
            if (!overwrite && res.clashes?.length) {
                setClash(file);
                return;
            }
            if (res.rejected?.length || !res.promoted?.length) {
                failed(res.rejected?.[0]?.reason ?? t("files.promoteFailedGeneric"));
                return;
            }
            toast.success(t("files.addedToProject"));
            notifyFilesChanged(projectScope);
            notifyFilesChanged(sessionScope);
        } catch (err) {
            failed(err instanceof Error ? err.message : String(err));
        } finally {
            inFlight.current.delete(file.key);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            {preview && (
                <PreviewPane
                    scope={preview.scope}
                    file={preview.file}
                    onBack={() => setPreview(null)}
                />
            )}
            <div
                className={cn(
                    "min-h-0 flex-1 overflow-y-auto",
                    preview && "hidden",
                )}
            >
                <FilesPanelContent
                    variant="section"
                    scope={projectScope}
                    header={
                        <SectionHeader
                            icon={Users}
                            title={t("files.projectSection", {
                                name: project.name,
                            })}
                            tinted
                        />
                    }
                    note={t("files.projectSectionNote")}
                    onListed={handleProjectListed}
                    onAccessLost={onProjectAccessLost}
                    onPreview={(file) =>
                        setPreview({ scope: projectScope, file })
                    }
                />
                <FilesPanelContent
                    variant="section"
                    scope={sessionScope}
                    header={
                        <SectionHeader
                            icon={MessageSquare}
                            title={t("files.sessionSection")}
                        />
                    }
                    onListed={handleSessionListed}
                    onPreview={(file) =>
                        setPreview({ scope: sessionScope, file })
                    }
                    onPromote={
                        project.canWrite
                            ? (file) => void promote(file)
                            : undefined
                    }
                />
            </div>
            <ConfirmDialog
                open={clash !== null}
                onOpenChange={(open) => {
                    if (!open) setClash(null);
                }}
                title={t("files.overwriteTitle")}
                description={
                    clash
                        ? t("files.promoteClashDescription", {
                              name: clash.name,
                          })
                        : undefined
                }
                confirmLabel={t("files.overwriteConfirm")}
                onConfirm={async () => {
                    if (clash) await promote(clash, true);
                }}
            />
        </div>
    );
}

export function FilesPanelContent({
    scope: scopeProp,
    variant = "panel",
    header,
    note,
    onListed,
    onAccessLost,
    onPromote,
    onPreview,
}: FilesPanelContentProps) {
    // Callers may build `scope` inline; key on its primitive fields so an
    // equal-but-new object neither rebuilds the adapter nor restarts the poll.
    const folderId =
        scopeProp.kind === "session"
            ? scopeProp.sessionId
            : scopeProp.projectId;
    const projectName = scopeProp.kind === "project" ? scopeProp.name : "";
    const projectCanWrite = scopeProp.kind === "project" && scopeProp.canWrite;
    const scope = useMemo(
        () => scopeProp,
        // Deliberately keyed on the fields, not the object: see above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [scopeProp.kind, folderId, projectName, projectCanWrite],
    );
    const adapter = useMemo(() => fileScopeAdapter(scope), [scope]);
    const isProject = scope.kind === "project";
    const t = useTranslations("chat");
    const tCommon = useTranslations("common");

    const [files, setFiles] = useState<SessionFile[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<SessionFile | null>(null);
    const [fileToDelete, setFileToDelete] = useState<SessionFile | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const browseInputRef = useRef<HTMLInputElement | null>(null);

    // Callers pass these inline; refs keep `refresh` (and so the poll) stable.
    const onListedRef = useRef(onListed);
    const onAccessLostRef = useRef(onAccessLost);
    useEffect(() => {
        onListedRef.current = onListed;
        onAccessLostRef.current = onAccessLost;
    });

    const refresh = useCallback(async () => {
        try {
            const res = await adapter.list();
            setFiles(res.files);
            setError(null);
            onListedRef.current?.(res);
        } catch (err: any) {
            // Losing access (session detached, rights revoked, project
            // deleted) is not an error to show: the caller drops the section.
            if (err instanceof ProjectFilesAccessError) {
                onAccessLostRef.current?.();
                return;
            }
            setError(err.message);
        }
    }, [adapter]);

    // Initial load + 5s polling while mounted so agent-produced files appear
    // live (item 80 — unchanged cadence). Stops on unmount/panel close
    // (session-screen unmounts the content with the SidePanel).
    useEffect(() => {
        refresh();
        pollIntervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [refresh]);

    // A drop on the conversation (chat-drop-target.tsx) uploads outside this
    // panel; refresh at once rather than on the next poll tick.
    useEffect(
        () =>
            subscribeFilesChanged(scope, () => {
                void refresh();
            }),
        [scope, refresh],
    );

    // Keep the preview file's metadata in sync with the polled list — if it
    // was deleted, drop the preview and bail back to the list.
    useEffect(() => {
        if (!previewFile || !files) return;
        const stillThere = files.find((f) => f.key === previewFile.key);
        if (!stillThere) {
            setPreviewFile(null);
        } else if (stillThere.lastModified !== previewFile.lastModified) {
            // Re-uploaded version: refresh metadata + presigned URL.
            setPreviewFile(stillThere);
        }
    }, [files, previewFile]);

    const handleConfirmDelete = useCallback(async () => {
        if (!fileToDelete) return;
        const file = fileToDelete;
        try {
            await adapter.delete(file.key);
            setFiles((curr) =>
                curr ? curr.filter((f) => f.key !== file.key) : curr,
            );
            if (previewFile?.key === file.key) setPreviewFile(null);
            setFileToDelete(null);
        } catch (err: any) {
            toast.error(t("files.deleteFailed", { message: err.message }));
            // Re-throw so the ConfirmDialog stays open for retry/cancel.
            throw err;
        }
    }, [fileToDelete, previewFile, adapter, t]);

    const showPreview = onPreview ?? setPreviewFile;
    const emptyDescription = t(
        !isProject
            ? "files.emptyDescription"
            : adapter.canWrite
              ? "files.emptyDescriptionProject"
              : "files.emptyDescriptionProjectReadOnly",
    );
    const noteText =
        note ?? t(isProject ? "files.privacyNoteProject" : "files.privacyNote");
    const deleteDialog = (
        <ConfirmDialog
            open={fileToDelete !== null}
            onOpenChange={(open) => {
                if (!open) setFileToDelete(null);
            }}
            title={t("files.deleteTitle")}
            description={
                fileToDelete
                    ? t(
                          isProject
                              ? "files.deleteDescriptionProject"
                              : "files.deleteDescription",
                          { name: fileToDelete.name },
                      )
                    : undefined
            }
            variant="destructive"
            onConfirm={handleConfirmDelete}
        />
    );

    if (variant === "section") {
        return (
            <section className="border-b border-border last:border-b-0">
                {header}
                <div className="flex items-start gap-2 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                    <Info
                        className="mt-0.5 size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    <span>
                        {noteText}
                        {files !== null && (
                            <>
                                {" · "}
                                {t("files.count", { count: files.length })}
                            </>
                        )}
                    </span>
                </div>
                {error ? (
                    <div className="flex items-center gap-2 px-3 pb-2 text-xs text-destructive">
                        <span className="min-w-0 flex-1">
                            {`${t("files.errorTitle")}: ${error}`}
                        </span>
                        <Button size="sm" variant="ghost" onClick={refresh}>
                            {tCommon("retry")}
                        </Button>
                    </div>
                ) : files === null ? (
                    <FileRowSkeletons count={2} />
                ) : files.length === 0 ? (
                    <p className="px-3 pb-2 text-xs text-muted-foreground">
                        {emptyDescription}
                    </p>
                ) : (
                    <div className="border-t border-border">
                        {files.map((file) => (
                            <FileRow
                                key={file.key}
                                scope={scope}
                                file={file}
                                onPreview={showPreview}
                                onDelete={setFileToDelete}
                                onPromote={onPromote}
                            />
                        ))}
                    </div>
                )}
                {adapter.canWrite && (
                    <div className="px-3 pt-1 pb-3">
                        <UploadZone
                            scope={scope}
                            onUploadComplete={refresh}
                            inputRef={browseInputRef}
                            compact
                        />
                    </div>
                )}
                {deleteDialog}
            </section>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            {previewFile ? (
                <PreviewPane
                    scope={scope}
                    file={previewFile}
                    onBack={() => setPreviewFile(null)}
                />
            ) : (
                <>
                    {/* Item 84: session-scope privacy note on the title info line. */}
                    <div className="flex shrink-0 items-start gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                        <Info
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <span>
                            {noteText}
                            {files !== null && (
                                <>
                                    {" · "}
                                    {t("files.count", { count: files.length })}
                                </>
                            )}
                        </span>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {error ? (
                            <EmptyState
                                variant="error"
                                title={t("files.errorTitle")}
                                description={error}
                                action={{
                                    label: tCommon("retry"),
                                    onClick: refresh,
                                }}
                            />
                        ) : files === null ? (
                            <FileRowSkeletons />
                        ) : files.length === 0 ? (
                            <EmptyState
                                variant="quiet"
                                icon={FolderOpen}
                                title={t("files.emptyTitle")}
                                description={emptyDescription}
                                action={
                                    adapter.canWrite
                                        ? {
                                              label: t("files.browse"),
                                              onClick: () =>
                                                  browseInputRef.current?.click(),
                                          }
                                        : undefined
                                }
                            />
                        ) : (
                            files.map((file) => (
                                <FileRow
                                    key={file.key}
                                    scope={scope}
                                    file={file}
                                    onPreview={showPreview}
                                    onDelete={setFileToDelete}
                                    onPromote={onPromote}
                                />
                            ))
                        )}
                    </div>

                    {/* Item 83: upload zone, bottom of the panel, flow unchanged. */}
                    {adapter.canWrite && (
                        <div className="shrink-0 border-t border-border p-3">
                            <UploadZone
                                scope={scope}
                                onUploadComplete={refresh}
                                inputRef={browseInputRef}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Item 81: shared ConfirmDialog replaces window.confirm. */}
            {deleteDialog}
        </div>
    );
}
