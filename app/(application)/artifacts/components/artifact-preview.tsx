"use client";

/**
 * ArtifactPreview — the thumbnail on a favourite card.
 *
 *  - app (HTML): the document is fetched through the same-origin content
 *    route (session + share-password cookies ride along, exactly like the
 *    viewer does) and rendered scaled down in an iframe sandboxed to
 *    `allow-scripts` ONLY — no popups, no forms, no identity handshake, and
 *    no allow-same-origin, so it is an opaque origin with no cookies and no
 *    parent access. Non-interactive (pointer-events-none, tabIndex -1,
 *    aria-hidden): the card is the link. Loaded only once the card is near
 *    the viewport, so a long favourites row does not boot a dozen apps.
 *  - image: an <img> straight from the content route (images are not
 *    subject to the route's X-Frame-Options, so no blob detour is needed).
 *  - everything else (PDF included): the kind's icon and label — a real
 *    PDF thumbnail would mean a PDF renderer per card.
 * Expired artifacts never load; they show the kind icon with "Expired".
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ArtifactListItem } from "../hooks";
import { KIND_ICON } from "../kind-icon";

/** The frame renders a desktop-sized page and is scaled to the box. */
const FRAME_WIDTH = 1024;
const FRAME_HEIGHT = 640;
const PREVIEW_SANDBOX = "allow-scripts";

/** True once the element is near the viewport; true immediately where IntersectionObserver is absent (jsdom). */
function useNearViewport(ref: React.RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = React.useState(
    () => typeof IntersectionObserver === "undefined",
  );
  React.useEffect(() => {
    if (near || !ref.current || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near, ref]);
  return near;
}

function KindGlyph({
  item,
  caption,
}: {
  item: ArtifactListItem;
  caption: string;
}) {
  const Icon = KIND_ICON[item.type.kind];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon aria-hidden="true" className="size-10" strokeWidth={1} />
      <span className="text-xs font-medium">{caption}</span>
    </div>
  );
}

function AppPreview({
  item,
  active,
}: {
  item: ArtifactListItem;
  active: boolean;
}) {
  const t = useTranslations("artifacts");
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [scale, setScale] = React.useState(0.25);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${item.shareUrl}/content`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setHtml(text);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, item.shareUrl]);

  // Scale the desktop-sized frame to whatever width the card has.
  React.useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(Math.max(box.clientWidth, 1) / FRAME_WIDTH);
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  if (failed) return <KindGlyph item={item} caption={t(item.type.labelKey)} />;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden">
      {html === null ? (
        <Skeleton
          aria-hidden="true"
          className="absolute inset-0 rounded-none"
        />
      ) : (
        <iframe
          title={t("previewTitle", { name: item.name })}
          srcDoc={html}
          sandbox={PREVIEW_SANDBOX}
          tabIndex={-1}
          aria-hidden="true"
          scrolling="no"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-background"
          style={{
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}

export interface ArtifactPreviewProps {
  item: ArtifactListItem;
  className?: string;
}

export function ArtifactPreview({ item, className }: ArtifactPreviewProps) {
  const t = useTranslations("artifacts");
  const ref = React.useRef<HTMLDivElement | null>(null);
  const near = useNearViewport(ref);
  const [imageFailed, setImageFailed] = React.useState(false);

  let body: React.ReactNode;
  if (item.expired) {
    body = <KindGlyph item={item} caption={t("expired")} />;
  } else if (item.type.kind === "app") {
    body = <AppPreview item={item} active={near} />;
  } else if (item.type.kind === "image" && !imageFailed) {
    body = (
      // eslint-disable-next-line @next/next/no-img-element -- same-origin content route, never optimisable
      <img
        src={`${item.shareUrl}/content`}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  } else {
    body = <KindGlyph item={item} caption={t(item.type.labelKey)} />;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "aspect-[16/10] w-full overflow-hidden bg-muted/40",
        className,
      )}
    >
      {body}
    </div>
  );
}
