"use client";

/**
 * Route-local file gallery + upload surface (inventory items 18–27).
 *
 * LOCAL STUB of the FilePicker widget (codebase-structure §2.4): the canonical
 * promotion of components/uppy-dashboard.tsx belongs to the knowledge redesign
 * (its 11-consumer list is the acceptance contract), so transcriptions — per
 * the parallel-track rule — carries a route-local fork that keeps the
 * FileGalleryAndUpload prop API (id, allowedFileTypes, selectionLimit,
 * dependencies, global?, onConfirm) and swaps to the widget when it lands.
 *
 * Page-doc fixes vs. the shared component (transcriptions.md ladder rows
 * 23–26, responsive.md hard rules 4–5):
 * - file-card actions (view/download, delete) are ALWAYS visible — no
 *   hover-gating; ≥44px touch targets below `md` (item 23/24);
 * - delete confirms via the shared ConfirmDialog, as the ladder mandates
 *   (item 23: "Always-visible icon button on file card + shared ConfirmDialog");
 * - disabled non-audio cards carry the "Not an audio file" Tooltip plus an
 *   inline caption so the datum is also reachable on touch (item 25, T7);
 * - empty state uses the shared EmptyState; skeletons mirror the card grid
 *   (item 26);
 * - below `md` the upload section renders FIRST (the phone job is "upload
 *   what I just recorded" — page-doc mobile behavior, responsive.md S6);
 * - the confirm action sits in a sticky footer (T5), all copy is i18n'd, and
 *   colors are token-only (no raw palette).
 */
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

import { Dashboard } from "@uppy/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeft,
  Download,
  FileAudio,
  FileText,
  File as FileIcon,
  Files,
  ImageIcon,
  Loader2,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPresignedUrl } from "@/components/primitives/file-picker";
import useUppy from "@/hooks/use-uppy";
import { filesApi, type S3FileListOutput } from "@/lib/api/files";
import { cn } from "@/lib/utils";

import { decodeFilename } from "../types";

type S3Item = S3FileListOutput["Contents"][0];

export interface FileGalleryProps {
  id: string;
  allowedFileTypes?: string[];
  selectionLimit: number;
  dependencies?: unknown[];
  global?: boolean;
  onConfirm: (keys: string[]) => void;
}

export function FileGallery({
  id,
  allowedFileTypes,
  selectionLimit,
  dependencies = [],
  global,
  onConfirm,
}: FileGalleryProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const { theme } = useTheme();

  const [search, setSearch] = React.useState<string | undefined>(undefined);
  const [previousContinuationToken, setPreviousContinuationToken] =
    React.useState<string | undefined>(undefined);
  const [currentContinuationToken, setCurrentContinuationToken] =
    React.useState<string | undefined>(undefined);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [newlyUploadedFiles, setNewlyUploadedFiles] = React.useState<S3Item[]>(
    [],
  );
  /** S3 key awaiting delete confirmation (shared ConfirmDialog, item 23). */
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const [data, setData] = React.useState<S3FileListOutput | undefined>(
    undefined,
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshCounter, setRefreshCounter] = React.useState(0);
  const lastQueryKeyRef = React.useRef<string | null>(null);

  // Stable identity so the uppy uploadSuccess callback never holds a stale closure.
  const refetch = React.useCallback(() => setRefreshCounter((c) => c + 1), []);

  const addSelected = (key: string) => {
    if (selected.includes(key)) {
      setSelected(selected.filter((s) => s !== key));
      return;
    }
    if (selectionLimit === 1) {
      setSelected([key]);
      return;
    }
    if (selected.length >= selectionLimit) {
      return;
    }
    setSelected([...selected, key]);
  };

  React.useEffect(() => {
    const queryKey = JSON.stringify([search, currentContinuationToken]);
    // New search / page: drop the stale list and show the loading skeletons.
    // Plain refetches (after upload/delete) keep the current list on screen.
    if (lastQueryKeyRef.current !== queryKey) {
      lastQueryKeyRef.current = queryKey;
      setData(undefined);
      setLoading(true);
    }
    let cancelled = false;
    filesApi
      .list({
        search,
        continuationToken: currentContinuationToken,
        global,
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        console.error("Failed to list files", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, currentContinuationToken, global, refreshCounter]);

  const uppy = useUppy(
    {
      backend: "",
      global,
      uppyOptions: {
        id,
        allowedFileTypes: allowedFileTypes ?? [],
      },
      callbacks: {
        uploadSuccess: (uploaded) => {
          const fullKey = uploaded.s3Key || uploaded.key;

          // Auto-list the newly uploaded file (inventory 22).
          const newFileItem: S3Item = {
            Key: fullKey,
            LastModified: new Date().toISOString(),
            ETag: "",
            Size: uploaded.file?.size || 0,
          };
          setNewlyUploadedFiles((prev) => [newFileItem, ...prev]);

          // Auto-select, respecting the selection limit.
          if (selectionLimit === 1) {
            setSelected([fullKey]);
          } else {
            setSelected((prev) => {
              if (prev.includes(fullKey)) return prev;
              if (prev.length >= selectionLimit) return prev;
              return [...prev, fullKey];
            });
          }

          refetch();
        },
      },
      maxNumberOfFiles: 10,
    },
    dependencies,
  );

  const filteredNewlyUploaded = newlyUploadedFiles.filter((item) => {
    if (!search) return true;
    return decodeFilename(item.Key).toLowerCase().includes(search.toLowerCase());
  });

  const displayContents: S3Item[] = [
    ...filteredNewlyUploaded,
    ...(data?.Contents || []).filter(
      (item) => !newlyUploadedFiles.some((newFile) => newFile.Key === item.Key),
    ),
  ];

  const onView = (key: string) => {
    getPresignedUrl(key)
      .then((url) => {
        window.open(url, "_blank");
      })
      .catch(() => {
        toast.error(t("gallery.viewFailed"));
      });
  };

  const onConfirmDelete = async () => {
    const key = pendingDelete;
    if (!key) return;
    try {
      await filesApi.delete(key);
    } catch (err: unknown) {
      toast.error(t("gallery.deleteFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // keep the ConfirmDialog open
    }
    setNewlyUploadedFiles((prev) => prev.filter((f) => f.Key !== key));
    setSelected((prev) => prev.filter((s) => s !== key));
    refetch();
  };

  // Token fetch still pending — parity with the shared component.
  if (!uppy) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
        <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
          {/* Upload — FIRST in DOM so phones lead with the mobile job
              ("upload what I just recorded"); gallery left / upload right
              from md up via order (page-doc mobile behavior, S6). */}
          <section className="rounded-lg border p-4 md:order-2">
            <h3 className="mb-3 text-sm font-medium">
              {t("gallery.uploadTitle")}
            </h3>
            <Dashboard
              uppy={uppy}
              theme={theme === "dark" ? "dark" : "light"}
            />
          </section>

          {/* Gallery of previously uploaded files (inventory 18–20, 25–26). */}
          <section className="rounded-lg border p-4 md:order-1">
            <h3 className="mb-3 text-sm font-medium">
              {t("gallery.browseTitle")}
            </h3>

            <Input
              placeholder={t("gallery.searchPlaceholder")}
              value={search ?? ""}
              onChange={(event) => setSearch(event.target.value)}
              className="mb-3 text-base md:text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-2 text-xs text-muted-foreground">
              <span>
                {t("gallery.selectedCount", {
                  selected: selected.length,
                  limit: selectionLimit,
                })}
              </span>
              {allowedFileTypes && allowedFileTypes.length > 0 && (
                <span>
                  {t("gallery.allowedTypes", {
                    types: allowedFileTypes.join(", "),
                  })}
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-2">
                    <Skeleton className="aspect-square w-full rounded-md" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-7 w-full" />
                  </div>
                ))}
              </div>
            ) : displayContents.length === 0 ? (
              <EmptyState
                variant="quiet"
                icon={Files}
                title={t("gallery.empty.title")}
                description={t("gallery.empty.description")}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {displayContents.map((item) => (
                  <GalleryFileCard
                    key={item.Key}
                    s3Key={item.Key}
                    active={selected.includes(item.Key)}
                    disabled={
                      allowedFileTypes && allowedFileTypes.length > 0
                        ? !allowedFileTypes.some((type) =>
                            item.Key.toLowerCase().endsWith(type.toLowerCase()),
                          )
                        : false
                    }
                    onSelect={() => addSelected(item.Key)}
                    onView={() => onView(item.Key)}
                    onDelete={() => setPendingDelete(item.Key)}
                  />
                ))}
              </div>
            )}

            {/* S3 continuation-token pagination (inventory 20); first-page
                shortcut returns at lg (responsive.md T1). */}
            <div className="flex items-center gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                className="hidden size-11 p-0 md:size-8 lg:flex"
                onClick={() => {
                  setCurrentContinuationToken(undefined);
                }}
                disabled={!currentContinuationToken || loading}
              >
                <span className="sr-only">{tCommon("goToFirstPage")}</span>
                <ChevronsLeft aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="size-11 p-0 md:size-8"
                onClick={() => {
                  setCurrentContinuationToken(previousContinuationToken);
                }}
                disabled={!currentContinuationToken || loading}
              >
                <span className="sr-only">{tCommon("goToPreviousPage")}</span>
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="size-11 p-0 md:size-8"
                onClick={() => {
                  setPreviousContinuationToken(currentContinuationToken);
                  setCurrentContinuationToken(data?.NextContinuationToken);
                }}
                disabled={!data?.NextContinuationToken || loading}
              >
                <span className="sr-only">{tCommon("goToNextPage")}</span>
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky confirm footer (T5: the confirm action can never scroll
          off-screen — inventory 27). */}
      <div className="mt-3 flex shrink-0 items-center justify-end border-t pt-3">
        <Button
          type="button"
          variant="outline"
          className="max-md:h-11"
          onClick={() => {
            onConfirm(selected);
            setSelected([]);
          }}
        >
          {tCommon("confirm")}
        </Button>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("gallery.confirmDelete.title")}
        description={t("gallery.confirmDelete.description", {
          name: pendingDelete ? decodeFilename(pendingDelete) : "",
        })}
        confirmLabel={t("gallery.confirmDelete.confirm")}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}

/* ------------------------------- file card ------------------------------- */

function fileTypeIcon(s3Key: string) {
  const key = s3Key.toLowerCase();
  const iconClass = "size-6 text-muted-foreground";
  if (
    key.endsWith("jpg") ||
    key.endsWith("jpeg") ||
    key.endsWith("png") ||
    key.endsWith("svg") ||
    key.endsWith("gif") ||
    key.endsWith("webp")
  ) {
    return <ImageIcon aria-hidden="true" className={iconClass} />;
  }
  if (
    key.endsWith("mp3") ||
    key.endsWith("wav") ||
    key.endsWith("m4a") ||
    key.endsWith("mp4") ||
    key.endsWith("mpeg")
  ) {
    return <FileAudio aria-hidden="true" className={iconClass} />;
  }
  if (key.endsWith("pdf")) {
    return <FileIcon aria-hidden="true" className={iconClass} />;
  }
  return <FileText aria-hidden="true" className={iconClass} />;
}

function isImageKey(s3Key: string) {
  const key = s3Key.toLowerCase();
  return (
    key.endsWith("jpg") ||
    key.endsWith("jpeg") ||
    key.endsWith("png") ||
    key.endsWith("svg")
  );
}

function GalleryFileCard({
  s3Key,
  active,
  disabled,
  onSelect,
  onView,
  onDelete,
}: {
  s3Key: string;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("transcriptions");
  const name = decodeFilename(s3Key);

  // aria-disabled (not the disabled attribute) keeps the card hover/focusable
  // so the "Not an audio file" Tooltip still fires (item 25); the inline
  // caption below covers touch (T7).
  const selectSurface = (
    <button
      type="button"
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "flex w-full flex-col rounded-t-lg p-2 text-left transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted",
      )}
    >
      <span className="relative mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-muted/50">
        {isImageKey(s3Key) ? (
          <SecureImage fileKey={s3Key} />
        ) : (
          <span className="flex flex-col items-center justify-center gap-1 px-1 text-center">
            {fileTypeIcon(s3Key)}
            {disabled && (
              <span className="text-[11px] leading-tight text-muted-foreground">
                {t("gallery.notAudio")}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="w-full truncate text-xs">{name}</span>
    </button>
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border transition-colors duration-150",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      {disabled ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{selectSurface}</TooltipTrigger>
            <TooltipContent>{t("gallery.notAudio")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        selectSurface
      )}

      {/* Always-visible actions — no hover-gating (items 23/24, hard rule 4);
          ≥44px targets below md; destructive delete is never at the card's
          extreme tap edge without the ConfirmDialog behind it. */}
      <div className="flex items-center justify-end gap-1 px-1 pb-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground hover:text-foreground md:size-7"
                aria-label={t("gallery.view")}
                onClick={onView}
              >
                <Download aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("gallery.view")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground hover:text-destructive md:size-7"
                aria-label={t("gallery.delete")}
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("gallery.delete")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

/** Signed-URL image preview (getPresignedUrl keeps its short module cache). */
function SecureImage({ fileKey }: { fileKey: string }) {
  const [url, setUrl] = React.useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setUrl(undefined);
    getPresignedUrl(fileKey)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch((err) => {
        console.error("Failed to get presigned url", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileKey]);

  if (isLoading) {
    return (
      <Loader2
        aria-hidden="true"
        className="size-4 animate-spin text-muted-foreground"
      />
    );
  }

  if (!url) {
    return fileTypeIcon(fileKey);
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={fileKey} className="size-full object-cover" />;
}
