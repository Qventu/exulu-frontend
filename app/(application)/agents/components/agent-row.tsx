"use client";

/**
 * AgentRow — accessible list row for the /agents index (work item 2.8,
 * inventory items 14/17/18/19/20/21/22 + row-overflow shares of 33/35).
 *
 * Replaces the legacy agent-card.tsx: rows in a `divide-y` list, no
 * card-in-card nesting (philosophy anti-pattern #6), and the whole-card
 * onClick session side effect is GONE — "Chat" is an explicit link to
 * /chat/{id}/new where the session is created lazily on first message
 * (agents.md reviews #3/#15; chat contract, agent-grid.tsx:8-13).
 *
 * Anatomy (md+): 32px AgentVisual avatar · name (text-sm font-medium) +
 * model name muted · quiet StatusDot (success/muted — item 19, "status is
 * quiet until it isn't") · RelativeTime(updatedAt) · Edit (ghost,
 * write-gated) · Chat (ghost) · OverflowMenu (Details, Duplicate, Copy ID —
 * NO Delete: the single delete entry point is the editor header overflow,
 * ladder item 32).
 *
 * <md (responsive.md T1/T7): avatar + name + dot + chevron; Edit/Chat move
 * INTO the always-visible overflow; all targets ≥44px (size-11 md:size-8).
 *
 * The row's main click target is a real <button> (opens the detail panel);
 * the action buttons are siblings, never nested interactive elements.
 */

import {
  ChevronRight,
  Copy,
  CopyPlus,
  Info,
  MessageCircle,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import AgentVisual from "@/components/lottie";
import { OverflowMenu, type OverflowMenuItem } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

/** Honors prefers-reduced-motion for the Lottie avatar (philosophy §6). */
function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export interface AgentAvatarProps {
  agent: Agent;
  /** Tailwind size class pair, e.g. "size-8". */
  className?: string;
  /** Monogram font size, e.g. "text-sm". */
  monogramClassName?: string;
}

/**
 * Shared avatar visual (items 14 + 17): the agent's image when set, the
 * animated Lottie AgentVisual otherwise — and the monogram fallback under
 * prefers-reduced-motion (the Lottie loop is content, but it must pause for
 * reduced-motion users; the monogram keeps identity without movement).
 * Decorative: consumers carry the accessible name in adjacent text.
 */
export function AgentAvatar({
  agent,
  className,
  monogramClassName,
}: AgentAvatarProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-primary/5",
        className,
      )}
    >
      {agent.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.image}
          alt=""
          className="size-full rounded-full object-cover"
        />
      ) : reducedMotion ? (
        <span
          className={cn("font-semibold text-primary", monogramClassName)}
        >
          {agent.name?.charAt(0).toUpperCase() || "A"}
        </span>
      ) : (
        <AgentVisual agent={agent} status="ready" className="size-full" />
      )}
    </span>
  );
}

export interface AgentRowProps {
  agent: Agent;
  /** can(user, { area: "agents", level: "write" }) — gates Edit + Duplicate. */
  canEdit: boolean;
  /** Currently shown in the detail panel (ListDetail selection). */
  selected?: boolean;
  /** Row click / overflow "Details" → detail panel (item 22). */
  onSelect: (agent: Agent) => void;
  /** Overflow "Duplicate" (item 33 row share, write-gated). */
  onDuplicate: (agent: Agent) => void;
}

export function AgentRow({
  agent,
  canEdit,
  selected = false,
  onSelect,
  onDuplicate,
}: AgentRowProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const router = useRouter();

  const copyId = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(agent.id);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  }, [agent.id, tCommon]);

  const overflowItems = React.useMemo<OverflowMenuItem[]>(() => {
    const items: OverflowMenuItem[] = [
      {
        label: tCommon("details"),
        icon: Info,
        onSelect: () => onSelect(agent),
      },
    ];
    // <md the ghost actions live here instead (responsive.md T1 — actions
    // never crowd the card edge; 44px targets preserved by the menu items).
    if (isMobile) {
      items.push({
        label: t("chatAction"),
        icon: MessageCircle,
        onSelect: () => router.push(`/chat/${agent.id}/new`),
      });
      if (canEdit) {
        items.push({
          label: tCommon("edit"),
          icon: Pencil,
          onSelect: () => router.push(`/agents/edit/${agent.id}`),
        });
      }
    }
    if (canEdit) {
      items.push({
        label: t("duplicate"),
        icon: CopyPlus,
        onSelect: () => onDuplicate(agent),
      });
    }
    items.push({
      label: t("copyId"),
      icon: Copy,
      onSelect: () => void copyId(),
    });
    return items;
  }, [agent, canEdit, copyId, isMobile, onDuplicate, onSelect, router, t, tCommon]);

  return (
    <li
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 transition-colors duration-150 md:px-4",
        selected ? "bg-muted/50" : "hover:bg-muted/50",
      )}
    >
      {/* Main target: a real button opening the detail panel (item 22). */}
      <button
        type="button"
        onClick={() => onSelect(agent)}
        aria-current={selected || undefined}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <AgentAvatar
          agent={agent}
          className="size-8"
          monogramClassName="text-sm"
        />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {agent.name}
            </span>
            {agent.modelName ? (
              <span className="hidden truncate text-sm text-muted-foreground md:block">
                {agent.modelName}
              </span>
            ) : null}
          </span>
          {/* Quiet status (item 19): color is never the only carrier —
              sr-only Active/Inactive rides along. */}
          <span aria-hidden="true" className="shrink-0">
            <StatusDot status={agent.active ? "success" : "muted"} />
          </span>
          <span className="sr-only">
            {agent.active ? tCommon("active") : tCommon("inactive")}
          </span>
        </span>
        {agent.updatedAt ? (
          <span className="hidden shrink-0 text-sm text-muted-foreground md:block">
            <RelativeTime date={agent.updatedAt} tabIndex={-1} />
          </span>
        ) : null}
      </button>

      {/* Sibling actions — never nested inside the row button. */}
      <span className="flex shrink-0 items-center gap-1">
        {canEdit ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
          >
            <Link href={`/agents/edit/${agent.id}`}>
              {tCommon("edit")}
            </Link>
          </Button>
        ) : null}
        {/* Item 20: plain navigation — NO session creation on click. */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex"
        >
          <Link href={`/chat/${agent.id}/new`}>{t("chatAction")}</Link>
        </Button>
        <OverflowMenu
          items={overflowItems}
          label={tCommon("actions")}
          className="size-11 md:size-8"
        />
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-muted-foreground md:hidden"
        />
      </span>
    </li>
  );
}
