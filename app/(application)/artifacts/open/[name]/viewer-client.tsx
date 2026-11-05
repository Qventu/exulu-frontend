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
 *
 * An app artifact with agents assigned to it also carries the call to action
 * that opens one of them in `AgentPanel` beside the content region, and the
 * `panel` half of the frame's channel.
 */

import type { UIMessage } from "ai";
import { ArrowLeft, Bot, Download, ExternalLink, FileWarning, LayoutGrid, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import * as React from "react";

import { ArtifactFrame } from "@/app/artifacts/[artifact_name]/artifact-frame";
import { EmptyState } from "@/components/primitives/empty-state";
import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpenPanelRequest } from "@/lib/artifacts/agent-panel-protocol";
import { artifactType, displayFilename } from "@/lib/artifacts/artifact-type";
import type { AgentSession } from "@/types/models/agent-session";

import { useFavoriteArtifacts } from "../../hooks";

import type { ResolvedSlot } from "./resolve-slots";

/**
 * Loaded on demand, because the panel is the whole chat surface — the session
 * controller, Apollo, the AI SDK transport, the uploader — and the artifact
 * viewer is the page a user opens to look at a PDF. Most artifacts have no
 * agent assigned at all, and none of them mount this until a slot is chosen,
 * so none of them should pay for it on first load. `ssr: false` because it is
 * only ever rendered in response to a click or a URL parameter, never in the
 * server-rendered first paint.
 */
const AgentPanel = dynamic(() => import("./agent-panel").then((module) => module.AgentPanel), {
  ssr: false,
});

export type ViewerStatus = "ready" | "notFound" | "expired" | "noAccess" | "password" | "error";

export interface ArtifactViewerProps {
  name: string;
  filename: string;
  authMode: "public" | "password" | "regular";
  status: ViewerStatus;
  /** The HTML document, present only for app artifacts in `ready` state. */
  html?: string;
  /**
   * The agent slots this viewer may be offered, already joined to the agents
   * it can reach (see resolve-slots.ts). Optional, and empty for every
   * artifact without assignments — which is most of them, and all the error
   * states the page renders before it ever looks for slots.
   */
  slots?: ResolvedSlot[];
  /** The slot `?agent=` named, or the one owning `?session=`; null for neither. */
  initialSlotKey?: string | null;
  /** The conversation `?session=` asks for, loaded and access-checked by the page. */
  initialSession?: AgentSession | null;
  initialMessages?: UIMessage[];
}

export function ArtifactViewer({
  name,
  filename,
  authMode,
  status,
  html,
  slots = [],
  initialSlotKey = null,
  initialSession = null,
  initialMessages = [],
}: ArtifactViewerProps) {
  const t = useTranslations("artifacts");
  const { isFavorite, toggle, canFavorite } = useFavoriteArtifacts();
  const shown = displayFilename(filename);
  const type = artifactType(shown);
  const shareUrl = `/artifacts/${encodeURIComponent(name)}`;
  const contentUrl = `${shareUrl}/content`;
  const favorite = isFavorite(name);

  const openShare = React.useCallback(() => window.open(shareUrl, "_blank", "noopener,noreferrer"), [shareUrl]);
  const download = React.useCallback(() => window.open(contentUrl, "_blank", "noopener,noreferrer"), [contentUrl]);

  // Restated here rather than relied on upstream: the page only fetches slots
  // for a `regular` HTML artifact, but the CTA's absence for anything else is
  // a product rule of its own — there is no frame for the panel to sit beside
  // on a non-app artifact, and a public or password share has no viewer
  // session for the chat to run as. Absent, never disabled.
  const offered = type.kind === "app" && authMode === "regular" ? slots : [];

  const [activeKey, setActiveKey] = React.useState<string | null>(initialSlotKey);
  const activeSlot = offered.find((slot) => slot.key === activeKey) ?? null;
  const activeSlotKey = activeSlot?.key ?? null;

  // --- what the artifact is told about its own box -------------------------
  // The channel carries the ARTIFACT's viewport width, not the panel's, so
  // that an artifact can decide whether it still has room for three columns
  // (spec: "the parent posts the artifact's new viewport width over the port
  // so the artifact can reflow itself"). The panel's own width would not
  // answer that question without the total.
  //
  // Measured off the artifact's own box rather than subtracted from a row
  // width: it is exactly what the layout gives the frame in every mode —
  // docked (squeezed), collapsed (nearly full), Sheet (full, because Radix
  // portals the panel out of this row) — and it stays correct across the
  // docked → Sheet breakpoint flip, for which no panel report is guaranteed
  // to arrive at all.
  const regionRef = React.useRef<HTMLDivElement>(null);
  const [artifactWidth, setArtifactWidth] = React.useState(0);
  const measureRef = React.useRef<() => void>(() => {});

  // Re-keyed on the open panel so opening or closing one measures in the same
  // commit, which puts the new width on the wire with the new `open` flag
  // rather than a frame behind it. Every other geometry change — a window
  // resize, the nav collapsing, a resize drag, a breakpoint flip — is the
  // observer's job.
  React.useEffect(() => {
    const element = regionRef.current;
    if (!element) return;
    const measure = () => {
      const width = Math.round(element.getBoundingClientRect().width);
      setArtifactWidth((previous) => (previous === width ? previous : width));
    };
    measureRef.current = measure;
    measure();
    // Guarded rather than assumed: an environment without a ResizeObserver
    // still gets the mount measurement instead of a crash.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeSlotKey]);

  // The panel's own width report. The number is NOT what goes on the wire —
  // the artifact is told its own width — it is the earliest signal that the
  // artifact's box has changed, so a collapse re-measures without waiting for
  // the observer's next frame. Taken through a ref rather than state on
  // purpose: a resize drag reports every frame, and as a dependency that
  // would tear down and rebuild the observer above each time.
  const onPanelWidthChange = React.useCallback(() => measureRef.current(), []);

  // Turn and tool progress counted into a nonce for the frame. The chat
  // controller exists only inside AgentPanel, so the panel reports and this
  // host counts; Task 10 adds the emission.
  const [progress, setProgress] = React.useState<{ nonce: number; reason: "tool" | "turn" }>({ nonce: 0, reason: "turn" });
  const onProgress = React.useCallback((reason: "tool" | "turn") => {
    setProgress((prev) => ({ nonce: prev.nonce + 1, reason }));
  }, []);

  // The request is tagged with a fresh nonce on every call — never passed
  // through bare — because the artifact can send `exulu:panel:open` more
  // than once while the SAME panel instance stays mounted (clicking its own
  // button twice without closing the panel in between), and AgentPanel
  // applies it against the mounted controller keyed on this nonce, not on
  // request identity (see openRequest's doc comment on AgentPanelProps and
  // the matching consume-once seed on the controller for why — composer.tsx,
  // ChatSessionController.pendingInput).
  const openRequestNonceRef = React.useRef(0);
  const [openRequest, setOpenRequest] = React.useState<{
    request: OpenPanelRequest;
    nonce: number;
  } | null>(null);

  const onOpenRequest = React.useCallback((request: OpenPanelRequest) => {
    // The frame has already checked the slot against the list it was given,
    // and a key naming no offered slot resolves to no panel here anyway.
    setActiveKey(request.slot);
    openRequestNonceRef.current += 1;
    setOpenRequest({ request, nonce: openRequestNonceRef.current });
  }, []);

  // The viewer's OWN header button (AgentTrigger below) opens a slot with no
  // prefill at all — it is not an open REQUEST, just "open this agent" — so
  // it must clear any pending one. Without this, picking a different slot
  // (or the same one again) through this plain button after an artifact-
  // triggered open would hand the FRESH panel a stale prompt/items/files
  // left over from a previous, unrelated open.
  const chooseSlot = React.useCallback((key: string) => {
    setActiveKey(key);
    setOpenRequest(null);
  }, []);

  // Same reasoning as chooseSlot: closing must not leave a stale request
  // behind for whatever opens next, including the SAME slot reopened later.
  const closePanel = React.useCallback(() => {
    setActiveKey(null);
    setOpenRequest(null);
  }, []);

  // AgentPanel's own cue that it has committed to dispatching `openRequest`
  // (see that prop's doc comment on AgentPanelProps). This is the door
  // `chooseSlot`/`closePanel` above do NOT cover: the in-panel history rail
  // and "New chat" navigate to `?session=<id>` WITHIN this same route, which
  // this page re-renders with a new `initialSession` prop without unmounting
  // THIS component — only `AgentPanel`, keyed on `panelSession.id`,
  // remounts. Clearing here is what stops that fresh instance from
  // re-applying a request this component is still holding.
  const onRequestApplied = React.useCallback(() => setOpenRequest(null), []);

  // `?session=` is a URL the user can type, and the history rail's rows and
  // the lazy session create both land on `?session=<id>` with no `?agent=` —
  // so the id the page loaded is not necessarily this slot's. The page has
  // already refused a session belonging to another user (its query is
  // RBAC-scoped) and one whose agent the URL did not address; this covers the
  // case the server cannot see, where the user switches slots in the picker
  // while the URL still names the other one's conversation. A mismatch is a
  // new chat, never someone else's conversation.
  const panelSession = activeSlot && initialSession?.agent === activeSlot.agent.id ? initialSession : null;

  // --- the panel's state lives in the URL ----------------------------------
  // A reload, or a Back, must land on what the user was looking at: the panel
  // open on the same slot, and on the same conversation if there is one.
  //
  // Written with a raw `replaceState`, not `router.push`: a push re-runs this
  // page's server component, which re-fetches the artifact's HTML and so
  // hands the frame a new `srcDoc` — reloading the artifact, discarding
  // whatever it had on screen and re-running the identity handshake. Losing
  // the artifact's state is the exact damage this feature exists to avoid.
  // The chat controller swaps its own session URL the same way, for the same
  // reason (chat/hooks.ts, createSession).
  //
  // Keyed on the panel's state AND on the parameters the server rendered, so
  // a real navigation that drops `?agent=` — the history rail's New chat
  // links to the bare artifact URL — is re-synced instead of quietly leaving
  // an open panel out of the URL.
  const panelSessionId = panelSession?.id ?? null;
  const renderedSessionId = initialSession?.id ?? null;
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const next = new URLSearchParams(url.search);
    if (activeSlotKey) next.set("agent", activeSlotKey);
    else next.delete("agent");
    // `session` is only added here, or cleared when the panel closes. The
    // chat controller writes it itself the moment a lazy session is created,
    // with a `replaceState` this component never sees — so a rule that
    // deleted it whenever `panelSession` was null could wipe a live
    // conversation out of the URL. A stale id left beside a different slot is
    // harmless: the page discards a session whose agent the addressed slot
    // does not point at, and the next send overwrites it.
    if (panelSessionId) next.set("session", panelSessionId);
    else if (!activeSlotKey) next.delete("session");
    const search = next.toString();
    const target = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
    if (target === `${url.pathname}${url.search}${url.hash}`) return;
    window.history.replaceState(null, "", target);
  }, [activeSlotKey, panelSessionId, initialSlotKey, renderedSessionId]);

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
          <AgentTrigger slots={offered} onChoose={chooseSlot} />
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

      {/* A row, so the panel docks beside the artifact and takes real width
          from it rather than floating over the data the agent is editing.
          Below `lg` the panel is a Sheet that Radix portals out of this
          subtree, so it occupies nothing here and the artifact keeps the
          whole row. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div ref={regionRef} className="relative min-h-0 flex-1 bg-background">
          {status !== "ready" ? (
            <Problem status={status} onOpenShare={openShare} />
          ) : type.kind === "app" && html !== undefined ? (
            <ArtifactFrame
              html={html}
              title={t("viewerFrameTitle", { name })}
              artifactName={name}
              grantIdentity={authMode === "regular"}
              // Omitted when nothing is assigned, so the artifact is told
              // `panel: false`: an author who checks only `host.panel` must
              // not end up with a button that could never work here.
              panel={
                offered.length === 0
                  ? undefined
                  : {
                      // Projected down to {key,label}. Agent ids never cross
                      // this channel — the artifact binds its buttons to the
                      // owner-typed slot key.
                      slots: offered.map((slot) => ({ key: slot.key, label: slot.label })),
                      onOpenRequest,
                      // The ARTIFACT's own width, measured above — what it
                      // needs in order to decide whether to reflow. Never
                      // the panel's width.
                      viewport: { width: artifactWidth, open: activeSlot !== null },
                      // Absent until a turn has actually made progress: the
                      // frame announces on every change of this, and a 0 on
                      // mount would announce an event nobody caused.
                      progressNonce: progress.nonce > 0 ? progress.nonce : undefined,
                      progressReason: progress.reason,
                    }
              }
              className="h-full w-full border-0"
            />
          ) : type.kind === "pdf" || type.kind === "image" ? (
            <BlobView kind={type.kind} url={contentUrl} name={name} filename={shown} onDownload={download} />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4">
              <EmptyState icon={LayoutGrid} title={t("viewerDownloadTitle")} description={t("viewerDownloadDescription", { filename: shown })} action={{ label: t("download"), onClick: download }} />
            </div>
          )}
        </div>

        {activeSlot && (
          <AgentPanel
            // Keyed on the conversation, because a change of search parameter
            // alone does not remount a client component (precedent:
            // ba6b8843, "make session switching and New chat actually change
            // the screen") and a different session has to start the chat
            // surface over. The slot is in the key for the same reason.
            key={`${activeSlot.key}:${panelSession?.id ?? "new"}`}
            agent={activeSlot.agent}
            initialSession={panelSession}
            initialMessages={panelSession ? initialMessages : []}
            artifactName={name}
            open
            onClose={closePanel}
            onWidthChange={onPanelWidthChange}
            onProgress={onProgress}
            openRequest={openRequest}
            onRequestApplied={onRequestApplied}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The call to action: one button for a single assignment, one trigger over a
 * picker for several, nothing at all for none — no dead chrome on the
 * majority of artifacts that have no agents assigned.
 */
function AgentTrigger({ slots, onChoose }: { slots: ResolvedSlot[]; onChoose: (key: string) => void }) {
  const t = useTranslations("artifacts");
  if (slots.length === 0) return null;

  if (slots.length === 1) {
    const only = slots[0];
    const label = t("openAgentNamed", { name: only.label });
    return (
      <Button type="button" variant="outline" size="sm" className="shrink-0" data-testid="agent-cta" aria-label={label} title={label} onClick={() => onChoose(only.key)}>
        <Bot aria-hidden="true" className="size-4 md:mr-1" />
        <span className="hidden md:inline">{only.label}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0" data-testid="agent-cta" aria-label={t("openAgentPanel")} title={t("openAgentPanel")}>
          <Bot aria-hidden="true" className="size-4 md:mr-1" />
          <span className="hidden md:inline">{t("openAgentPanel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {slots.map((slot) => (
          <DropdownMenuItem key={slot.key} onSelect={() => onChoose(slot.key)}>
            {slot.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
