"use client";

/**
 * The in-shell artifact viewer surface: a compact header (back to the list,
 * name, type badge, favourite star, open-in-new-tab, download) over a
 * full-bleed content region.
 *
 * What the region shows depends on the artifact's kind:
 *   - app (HTML): the sandboxed <ArtifactFrame> with the identity handshake,
 *     exactly as the published share route renders it;
 *   - pdf / image: the file is fetched as a blob through the same-origin
 *     content route (session cookie, share-password cookie) and shown from an
 *     object URL — a frame that loaded the content route directly would be
 *     refused by X-Frame-Options: DENY, and a blob: URL carries no headers;
 *   - everything else (slides, sheets, documents, data, …): a download card.
 */

import { ArrowLeft, Download, ExternalLink, FileWarning, LayoutGrid, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { ArtifactFrame } from "@/app/artifacts/[artifact_name]/artifact-frame";
import { EmptyState } from "@/components/primitives/empty-state";
import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { artifactType, displayFilename } from "@/lib/artifacts/artifact-type";

import { useFavoriteArtifacts } from "../../hooks";

export type ViewerStatus = "ready" | "notFound" | "expired" | "noAccess" | "password" | "error";

export interface ArtifactViewerProps {
  name: string;
  filename: string;
  authMode: "public" | "password" | "regular";
  status: ViewerStatus;
  /** The HTML document, present only for app artifacts in `ready` state. */
  html?: string;
}

export function ArtifactViewer({ name, filename, authMode, status, html }: ArtifactViewerProps) {
  const t = useTranslations("artifacts");
  const { isFavorite, toggle, canFavorite } = useFavoriteArtifacts();
  const shown = displayFilename(filename);
  const type = artifactType(shown);
  const shareUrl = `/artifacts/${encodeURIComponent(name)}`;
  const contentUrl = `${shareUrl}/content`;
  const favorite = isFavorite(name);

  const openShare = React.useCallback(() => window.open(shareUrl, "_blank", "noopener,noreferrer"), [shareUrl]);
  const download = React.useCallback(() => window.open(contentUrl, "_blank", "noopener,noreferrer"), [contentUrl]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-2 py-2 md:px-4">
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/artifacts" aria-label={t("viewerBack")}>
            <ArrowLeft aria-hidden="true" className="size-4 md:mr-1" />
            <span className="hidden md:inline">{t("viewerBack")}</span>
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          <Badge variant="secondary" className="hidden shrink-0 md:inline-flex">{t(type.labelKey)}</Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canFavorite && <FavoriteToggle pressed={favorite} onToggle={() => void toggle(name)} label={favorite ? t("unfavorite") : t("favorite")} />}
          <Button type="button" variant="ghost" size="icon" aria-label={t("openInNewTab")} title={t("openInNewTab")} onClick={openShare}>
            <ExternalLink aria-hidden="true" className="size-4" />
          </Button>
          {type.kind !== "app" && status === "ready" && (
            <Button type="button" variant="ghost" size="icon" aria-label={t("download")} title={t("download")} onClick={download}>
              <Download aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-background">
        {status !== "ready" ? (
          <Problem status={status} onOpenShare={openShare} />
        ) : type.kind === "app" && html !== undefined ? (
          <ArtifactFrame html={html} title={t("viewerFrameTitle", { name })} artifactName={name} grantIdentity={authMode === "regular"} className="h-full w-full border-0" />
        ) : type.kind === "pdf" || type.kind === "image" ? (
          <BlobView kind={type.kind} url={contentUrl} name={name} filename={shown} onDownload={download} />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4">
            <EmptyState icon={LayoutGrid} title={t("viewerDownloadTitle")} description={t("viewerDownloadDescription", { filename: shown })} action={{ label: t("download"), onClick: download }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Problem({ status, onOpenShare }: { status: Exclude<ViewerStatus, "ready">; onOpenShare: () => void }) {
  const t = useTranslations("artifacts");
  const title =
    status === "notFound" ? t("viewerNotFound") : status === "expired" ? t("viewerExpired") : status === "noAccess" ? t("viewerNoAccess") : status === "password" ? t("viewerPassword") : t("viewerError");
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <EmptyState
        icon={status === "password" ? Lock : FileWarning}
        title={title}
        action={status === "password" ? { label: t("openInNewTab"), onClick: onOpenShare } : { label: t("viewerBack"), href: "/artifacts" }}
      />
    </div>
  );
}

/** Fetches the file through the content route and shows it from a blob: URL. */
function BlobView({ kind, url, name, filename, onDownload }: { kind: "pdf" | "image"; url: string; name: string; filename: string; onDownload: () => void }) {
  const t = useTranslations("artifacts");
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setObjectUrl(null);
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <EmptyState icon={FileWarning} title={t("viewerError")} action={{ label: t("download"), onClick: onDownload }} />
      </div>
    );
  }
  if (!objectUrl) return <Skeleton aria-hidden="true" className="absolute inset-0 h-full w-full rounded-none" />;
  if (kind === "image") {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL, never optimisable */}
        <img src={objectUrl} alt={filename} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return <iframe src={objectUrl} title={t("viewerFrameTitle", { name })} className="h-full w-full border-0" />;
}
