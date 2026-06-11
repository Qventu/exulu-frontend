"use client";

/**
 * LEGACY SHIM — projects redesign (work item 2.4).
 *
 * The projects surface now lives route-local under
 * app/(application)/projects/ (project-detail-view, sessions/files/settings
 * tabs, project-item-card). This file keeps ONLY `SessionItemBadge`, whose
 * single external consumer is the chat composer's PinnedContextRow
 * (app/(application)/chat/components/pinned-context-row.tsx:23 — projects.md
 * inventory item 42: "must survive any refactor"). The `ProjectItem` card
 * moved to app/(application)/projects/components/project-item-card.tsx; the
 * consumer-less `SessionItem` alias is dropped (sanctioned by projects.md
 * §3 ladder row 42).
 *
 * When chat adopts a colocated badge, this file is deleted.
 */

import { useQuery } from "@apollo/client";
import { Database, X } from "lucide-react";

import { GET_ITEM_BY_ID } from "@/queries/queries";
import { Item } from "@/types/models/item";

/** Compact badge variant for the chat input toolbar (chat-owned consumer). */
export function SessionItemBadge({
  gid,
  onRemove,
}: {
  gid: string;
  onRemove: (gid: string) => void;
}) {
  const slashIdx = gid.indexOf("/");
  const context = slashIdx !== -1 ? gid.slice(0, slashIdx) : gid;
  const id = slashIdx !== -1 ? gid.slice(slashIdx + 1) : undefined;

  const { data } = useQuery<{ [key: string]: Item }>(
    GET_ITEM_BY_ID(context, []),
    { variables: { id: id ?? "" }, skip: !id },
  );

  const label = id
    ? (data?.[context + "_itemsById"]?.name ?? "…")
    : context.replace(/_/g, " ");

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 rounded-full px-2.5 py-1 max-w-[200px]">
      <Database className="w-3 h-3 shrink-0" />
      <span className="capitalize truncate">{label}</span>
      <button
        type="button"
        onClick={() => onRemove(gid)}
        className="ml-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 p-0.5 transition-colors"
        aria-label={`Remove ${label}`}
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
