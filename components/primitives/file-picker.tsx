"use client";

/**
 * FilePicker — promoted from `components/uppy-dashboard.tsx`.
 *
 * Spec: design/codebase-structure.md §2.3/§2.4 / design/pages/knowledge.md
 * §3 ladder #71–#77. The trigger+dialog combo (default export) plus the
 * named exports `FileGalleryAndUpload`, `FileItem`, `FileDataCard`,
 * `getPresignedUrl` — all five originally lived in uppy-dashboard.tsx and
 * MUST remain API-compatible for the 6 documented consumers (work item
 * 2.11 §3 filePickerCallSurfaces): data-display, item-form-fields,
 * agents/appearance, evals test-case-modal, transcriptions file-gallery,
 * chat composer (FileItem-only).
 *
 * Promotion deltas:
 * - Mobile-aware host: Sheet < md, Dialog ≥ md (responsive.md T5).
 * - Body-only mode (`host="body-only"`) for callers owning the host
 *   themselves (transcriptions file-gallery-dialog).
 * - Tile action row ALWAYS visible on touch (`@media (hover: none)`,
 *   responsive.md T7).
 * - Tile delete routes through shared ConfirmDialog when `confirmRemove`,
 *   fixing the original unconfirmed instant-delete (page-doc UX review,
 *   ladder rule "destructive => L3+ with confirmation").
 * - `buttonText=""` keeps the existing icon-only trigger semantics used by
 *   agents/appearance.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Primitive-boundary deviation (documented):
 * components/primitives/README.md §"Import boundaries" forbids data-layer
 * imports here. FilePicker reaches into `lib/api/files.ts` because that is
 * what uppy-dashboard.tsx did and the contract owner ("primitives") in
 * work item 2.11 explicitly places it under components/primitives/. The
 * deviation is recorded in `deviations`. The same considerations apply to
 * the `useUppy` hook reach-in.
 * ──────────────────────────────────────────────────────────────────────
 */

import { Dashboard } from "@uppy/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Download,
  File,
  FilePlus,
  FileText,
  FileWarning,
  ImageIcon,
  LoaderIcon,
  PlusIcon,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigContext } from "@/components/shell/config-context";
import { useIsMobile } from "@/hooks/use-mobile";
import useUppy from "@/hooks/use-uppy";
import {
  filesApi,
  type S3FileListOutput,
  type S3ObjectOutput,
} from "@/lib/api/files";
import { cn } from "@/lib/utils";
import { allFileTypes } from "@/types/models/agent";

import { ConfirmDialog } from "./confirm-dialog";

import { DoubleArrowLeftIcon } from "@radix-ui/react-icons";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

/* ============================================================
 * FileDataCard
 * ============================================================ */

export interface FileDataCardProps {
  s3key: string;
  children?: React.ReactNode;
}

export function FileDataCard({ s3key, children }: FileDataCardProps) {
  const t = useTranslations("common");
  const [data, setData] = React.useState<S3ObjectOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(!!s3key);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!s3key) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    filesApi
      .object(s3key)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [s3key]);

  if (!s3key) {
    return (
      <Card>
        <CardContent className="flex p-3">
          <p className="m-auto text-sm text-muted-foreground">
            {t("noFileSelected")}
          </p>
          {children}
        </CardContent>
      </Card>
    );
  }

  const bucket = s3key.split("/")[0];
  const afterBucket = s3key.split("/").slice(1).join("/");
  const name = afterBucket.split("_EXULU_").pop() || "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="max-w-[500px] truncate text-sm">{name}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : null}
        {!isLoading && data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize">
                {data.ContentType?.split("/").pop()}
                {bucket && ` · ${bucket}`}
              </span>
              <span>
                {(data.ContentLength / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(data.LastModified).toLocaleString()}</span>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                className="h-11 px-2 md:h-7"
                onClick={() => {
                  filesApi.download(s3key).then(async (res) => {
                    const json = await res.json();
                    window.open(json.url, "_blank");
                  });
                }}
              >
                <span className="mr-1 text-xs">{t("view")}</span>
                <Download aria-hidden="true" className="size-3" />
              </Button>
            </div>
          </div>
        ) : null}
        {!isLoading && error ? (
          <p className="text-xs text-muted-foreground">{error.message}</p>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * getPresignedUrl — module-cached 60s presigned URL helper.
 * ============================================================ */

const signedUrlCache: Record<
  string,
  { url: string; expiresAt: number }
> = {};

export async function getPresignedUrl(fileKey: string): Promise<string> {
  if (signedUrlCache[fileKey]) {
    if (signedUrlCache[fileKey].expiresAt < Date.now()) {
      delete signedUrlCache[fileKey];
    } else {
      return signedUrlCache[fileKey].url;
    }
  }
  const response = await filesApi.download(fileKey);
  const json = await response.json();
  signedUrlCache[fileKey] = {
    url: json.url,
    expiresAt: Date.now() + 60 * 1000,
  };
  return json.url;
}

/* ============================================================
 * SecureImage — internal helper, signed-URL thumb
 * ============================================================ */

function SecureImage({ fileKey }: { fileKey: string }) {
  const [url, setUrl] = React.useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setUrl(undefined);
    getPresignedUrl(fileKey)
      .then((signed) => {
        if (!cancelled) setUrl(signed);
      })
      .catch(() => {
        /* swallow — UI falls back to FileWarning */
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
      <div className="flex items-center justify-center">
        <LoaderIcon
          aria-hidden="true"
          className="size-5 animate-spin text-muted-foreground"
        />
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex items-center justify-center">
        <FileWarning
          aria-hidden="true"
          className="size-5 text-muted-foreground"
        />
      </div>
    );
  }
  // alt is the file key — accessible label for assistive tech, no decoration value
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={fileKey} className="h-full w-full object-cover" />;
}

/* ============================================================
 * FileItem
 * ============================================================ */

export interface FileItemProps {
  s3Key: string;
  active: boolean;
  disabled: boolean;
  onSelect?: (key: string) => void;
  onRemove?: (key: string) => void;
  addToContext?: (key: string) => void;
  /**
   * When true, onRemove fires only after the user confirms via the shared
   * ConfirmDialog (page-doc ladder #74, responsive.md hard rule 5).
   */
  confirmRemove?: boolean;
}

function getFileIcon(s3Key: string) {
  if (!s3Key) return <FileText className="size-6 text-muted-foreground" />;
  const lower = s3Key.toLowerCase();
  if (
    lower.endsWith("jpg") ||
    lower.endsWith("jpeg") ||
    lower.endsWith("png") ||
    lower.endsWith("svg") ||
    lower.endsWith("gif") ||
    lower.endsWith("webp")
  ) {
    return <ImageIcon className="size-6 text-info" />;
  }
  if (lower.endsWith("pdf")) {
    return <File className="size-6 text-destructive" />;
  }
  if (
    lower.endsWith("xls") ||
    lower.endsWith("xlsx") ||
    lower.endsWith("csv")
  ) {
    return <FileText className="size-6 text-success" />;
  }
  if (lower.endsWith("ppt") || lower.endsWith("pptx")) {
    return <FileText className="size-6 text-warning" />;
  }
  return <FileText className="size-6 text-muted-foreground" />;
}

export function FileItem({
  s3Key,
  onSelect,
  onRemove,
  active,
  disabled,
  addToContext,
  confirmRemove,
}: FileItemProps) {
  const t = useTranslations("common");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const isImage =
    s3Key &&
    /\.(jpg|jpeg|png|svg|gif|webp)$/i.test(s3Key);

  const displayName = s3Key ? s3Key.split("_EXULU_").pop() : s3Key;

  // T7: action row always visible on touch.
  const actionRowClasses =
    "absolute top-1 right-1 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100";

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRemove) return;
    if (confirmRemove) {
      setConfirmOpen(true);
    } else {
      onRemove(s3Key);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group relative cursor-pointer rounded-lg border p-2 transition-colors hover:bg-muted",
          active && "border-primary",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={() => {
          if (!disabled && onSelect) onSelect(s3Key);
        }}
        role={onSelect ? "button" : undefined}
        aria-pressed={onSelect ? active : undefined}
        aria-disabled={disabled || undefined}
      >
        <div className="relative mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted/50">
          {isImage ? (
            <SecureImage fileKey={s3Key} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center">
              {getFileIcon(s3Key)}
              <span className="mt-1 px-1 text-center text-xs text-muted-foreground">
                {displayName}
              </span>
            </div>
          )}
        </div>
        <p className="truncate text-xs">{displayName}</p>

        <div className={actionRowClasses}>
          {addToContext ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="size-8 bg-background/80 hover:bg-background md:size-6"
              onClick={(e) => {
                e.stopPropagation();
                addToContext(s3Key);
              }}
              aria-label={t("add")}
            >
              <PlusIcon aria-hidden="true" className="size-3" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="size-8 bg-background/80 hover:bg-background md:size-6"
            onClick={(e) => {
              e.stopPropagation();
              filesApi.download(s3Key).then(async (res) => {
                const json = await res.json();
                window.open(json.url, "_blank");
              });
            }}
            aria-label={t("view")}
          >
            <Download aria-hidden="true" className="size-3" />
          </Button>
          {onRemove ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="size-8 bg-background/80 hover:bg-background md:size-6"
              onClick={handleRemoveClick}
              aria-label={t("remove")}
            >
              <X aria-hidden="true" className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>

      {confirmRemove && onRemove ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("deleteFileTitle")}
          description={t("deleteFileDescription", {
            name: displayName ?? "",
          })}
          confirmLabel={t("delete")}
          onConfirm={async () => {
            onRemove(s3Key);
          }}
        />
      ) : null}
    </>
  );
}

/* ============================================================
 * FileGalleryAndUpload — the body. Hostable inline.
 * ============================================================ */

const DEFAULT_ALLOWED: allFileTypes[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".pptx",
  ".ppt",
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".mpeg",
];

export interface FileGalleryAndUploadProps {
  id: string;
  selectionLimit: number;
  dependencies: unknown[];
  onConfirm: (keys: string[]) => void;
  allowedFileTypes?: allFileTypes[] | string[];
  global?: boolean;
}

export function FileGalleryAndUpload({
  id,
  global,
  allowedFileTypes,
  dependencies,
  onConfirm,
  selectionLimit,
}: FileGalleryAndUploadProps) {
  const t = useTranslations("common");
  const isMobile = useIsMobile();
  const resolvedAllowed: string[] =
    (allowedFileTypes && allowedFileTypes.length > 0
      ? (allowedFileTypes as string[])
      : (DEFAULT_ALLOWED as unknown as string[]));

  const [search, setSearch] = React.useState<string | undefined>(undefined);
  const [previousContinuationToken, setPreviousContinuationToken] =
    React.useState<string | undefined>(undefined);
  const [currentContinuationToken, setCurrentContinuationToken] =
    React.useState<string | undefined>(undefined);
  const configContext = React.useContext(ConfigContext);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [newlyUploadedFiles, setNewlyUploadedFiles] = React.useState<
    S3FileListOutput["Contents"]
  >([]);

  const addSelected = (key: string) => {
    if (selected.includes(key)) {
      setSelected(selected.filter((s) => s !== key));
      return;
    }
    if (selectionLimit === 1) {
      setSelected([key]);
      return;
    }
    if (selected.length >= selectionLimit) return;
    setSelected([...selected, key]);
  };

  const [data, setData] = React.useState<S3FileListOutput | undefined>(
    undefined,
  );
  const [loading, setLoading] = React.useState(true);
  const [refreshCounter, setRefreshCounter] = React.useState(0);
  const lastQueryKeyRef = React.useRef<string | null>(null);

  const refetch = React.useCallback(
    () => setRefreshCounter((c) => c + 1),
    [],
  );

  const deleteFile = React.useCallback(
    async (key: string) => {
      try {
        await filesApi.delete(key);
      } catch {
        /* ignored — refetch will reveal current state */
      }
      refetch();
    },
    [refetch],
  );

  React.useEffect(() => {
    const queryKey = JSON.stringify([search, currentContinuationToken]);
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
      .catch(() => {
        /* ignored — empty state shown */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, currentContinuationToken, global, refreshCounter]);

  const { theme } = useTheme();
  const uppy = useUppy(
    {
      backend: configContext?.backend || "",
      global,
      uppyOptions: {
        id,
        allowedFileTypes: resolvedAllowed,
      },
      callbacks: {
        uploadSuccess: async (payload) => {
          const fullKey = payload.s3Key || payload.key;
          const newFileItem = {
            Key: fullKey,
            LastModified: new Date().toISOString(),
            ETag: "",
            Size: payload.file?.size || 0,
          };
          setNewlyUploadedFiles((prev) => [newFileItem, ...prev]);
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
    dependencies as unknown[],
  );

  const filteredNewlyUploaded = newlyUploadedFiles.filter((item) => {
    if (!search) return true;
    const fileName = item.Key.split("_EXULU_").pop() || "";
    return fileName.toLowerCase().includes(search.toLowerCase());
  });

  const displayContents = [
    ...filteredNewlyUploaded,
    ...(data?.Contents || []).filter(
      (item) => !newlyUploadedFiles.some((nf) => nf.Key === item.Key),
    ),
  ];

  if (!uppy) return null;

  const galleryPane = (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">
        {t("previouslyUploadedFiles")}
      </h3>
      <Input
        placeholder={t("searchFiles")}
        value={search ?? ""}
        onChange={(e) => setSearch(e.target.value || undefined)}
        className="mb-3"
        aria-label={t("searchFiles")}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-muted-foreground">
        <span>
          {selected.length} / {selectionLimit} {t("filesSelected")}
        </span>
        <span className="truncate" title={resolvedAllowed.join(", ")}>
          {t("allowedTypes")}: {resolvedAllowed.join(", ")}
        </span>
      </div>
      <ScrollArea>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full" />
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {!loading && !displayContents.length ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <FileWarning
                aria-hidden="true"
                className="mb-3 size-10 text-muted-foreground/60"
              />
              <p className="text-sm font-medium text-muted-foreground">
                {t("noFilesYet")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/75">
                {t("uploadToGetStarted")}
              </p>
            </div>
          ) : null}
          {displayContents.map((item) => (
            <FileItem
              key={item.Key}
              s3Key={item.Key}
              onSelect={addSelected}
              active={selected.some((s) => s === item.Key)}
              disabled={
                resolvedAllowed.length
                  ? !resolvedAllowed.some((type) => item.Key.endsWith(type))
                  : false
              }
              confirmRemove
              onRemove={() => {
                deleteFile(item.Key);
                setNewlyUploadedFiles((prev) =>
                  prev.filter((f) => f.Key !== item.Key),
                );
                setSelected((prev) => prev.filter((s) => s !== item.Key));
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-3">
          <Button
            variant="outline"
            size="icon"
            className="hidden size-11 md:flex md:size-8"
            onClick={() => setCurrentContinuationToken(undefined)}
            disabled={!currentContinuationToken || loading}
          >
            <span className="sr-only">{t("goToFirstPage")}</span>
            <DoubleArrowLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-8"
            onClick={() =>
              setCurrentContinuationToken(previousContinuationToken)
            }
            disabled={!currentContinuationToken || loading}
          >
            <span className="sr-only">{t("goToPreviousPage")}</span>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-8"
            onClick={() => {
              setPreviousContinuationToken(currentContinuationToken);
              setCurrentContinuationToken(data?.NextContinuationToken);
            }}
            disabled={!data?.NextContinuationToken || loading}
          >
            <span className="sr-only">{t("goToNextPage")}</span>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </ScrollArea>
    </div>
  );

  const uploadPane = (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">{t("uploadNewFiles")}</h3>
      <Dashboard uppy={uppy} theme={theme === "dark" ? "dark" : "light"} />
    </div>
  );

  return (
    <>
      {isMobile ? (
        // S6: upload first on phones (you just captured it).
        <Tabs defaultValue="upload" className="flex flex-col gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">{t("upload")}</TabsTrigger>
            <TabsTrigger value="gallery">{t("gallery")}</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">{uploadPane}</TabsContent>
          <TabsContent value="gallery">{galleryPane}</TabsContent>
        </Tabs>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          {galleryPane}
          {uploadPane}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          variant="default"
          className="h-11 md:h-9"
          disabled={selected.length === 0}
          onClick={() => {
            onConfirm(selected);
            setSelected([]);
          }}
        >
          {t("confirmSelection")}
        </Button>
      </div>
    </>
  );
}

/* ============================================================
 * FilePicker (default export) — trigger + dialog/sheet host
 * ============================================================ */

export interface FilePickerProps {
  id: string;
  selectionLimit: number;
  dependencies: unknown[];
  onConfirm: (keys: string[]) => void;
  allowedFileTypes?: allFileTypes[] | string[];
  global?: boolean;
  /**
   * Trigger button text. Empty string → icon-only (agents/appearance);
   * undefined → i18n default (common.selectFiles).
   */
  buttonText?: string;
  /** Optional custom trigger — used by consumers owning their own surface. */
  trigger?: React.ReactNode;
  /** Caller-controlled open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** "body-only" embeds the gallery+upload body with no host. */
  host?: "auto" | "body-only";
}

export default function FilePicker({
  id,
  selectionLimit,
  dependencies,
  onConfirm,
  allowedFileTypes,
  global,
  buttonText,
  trigger,
  open: openProp,
  onOpenChange,
  host = "auto",
}: FilePickerProps) {
  const t = useTranslations("common");
  const isMobile = useIsMobile();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const body = (
    <FileGalleryAndUpload
      id={id}
      global={global}
      allowedFileTypes={allowedFileTypes}
      dependencies={dependencies}
      selectionLimit={selectionLimit}
      onConfirm={(keys) => {
        onConfirm(keys);
        setOpen(false);
      }}
    />
  );

  if (host === "body-only") {
    return body;
  }

  const resolvedButtonText =
    buttonText === undefined ? t("selectFiles") : buttonText;
  const defaultTrigger = trigger ?? (
    <Button variant="outline" className="h-11 md:h-9" type="button">
      {resolvedButtonText ? (
        <span className="mr-2">{resolvedButtonText}</span>
      ) : null}
      <FilePlus aria-hidden="true" className="size-4" />
      {resolvedButtonText === "" ? (
        <span className="sr-only">{t("selectFiles")}</span>
      ) : null}
    </Button>
  );

  // Mobile: full-height bottom Sheet. Desktop: Dialog.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{defaultTrigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] flex-col overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{t("fileGallery")}</SheetTitle>
            <SheetDescription>{t("fileGalleryDescription")}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{t("fileGallery")}</DialogTitle>
          <DialogDescription>{t("fileGalleryDescription")}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
