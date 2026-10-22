"use client";

/**
 * AgentFavourites — the starred agents as a card grid above the /agents list.
 *
 * Per-user, cross-device (users.favourite_agents — see hooks.ts
 * useFavouriteAgents); cards render in star order (favourites-utils.ts). The
 * section renders only when there is something to show, so a new user's
 * /agents is unchanged; the parent hides it while a search or status filter
 * is active (the user is looking for something specific — projects/page.tsx
 * precedent). Starred agents also stay in their Active/Inactive list — the
 * cards are a shortcut, not a third bucket (the /data pins precedent, and
 * removing rows from a server-paginated list would leave ragged pages).
 *
 * Card anatomy: 40px AgentAvatar · name · quiet StatusDot(Active/Inactive)
 * + model name · FavoriteToggle. The card's main target is a real <button>
 * (opens the detail panel, like a row); the star is a sibling, never nested.
 */

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";

import { AgentAvatar } from "./agent-row";

interface AgentFavouriteCardProps {
  agent: Agent;
  selected: boolean;
  onSelect: (agent: Agent) => void;
  onToggleFavourite: (agent: Agent) => void;
}

function AgentFavouriteCard({
  agent,
  selected,
  onSelect,
  onToggleFavourite,
}: AgentFavouriteCardProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");

  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 rounded-md border p-3 transition-colors duration-150",
        "hover:border-primary/40 hover:bg-accent/40",
        selected && "border-primary/60 bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(agent)}
        aria-current={selected || undefined}
        className="flex min-w-0 flex-1 items-start gap-3 text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
      >
        <AgentAvatar
          agent={agent}
          className="size-10"
          monogramClassName="text-base"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {agent.name}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {/* Color is never the only carrier — the label rides along. */}
            <StatusDot
              status={agent.active ? "success" : "muted"}
              label={agent.active ? tCommon("active") : tCommon("inactive")}
              className="shrink-0"
            />
            {agent.modelName ? (
              <span className="truncate">· {agent.modelName}</span>
            ) : null}
          </span>
        </span>
      </button>
      <FavoriteToggle
        className="relative z-10 -mr-1 -mt-1"
        pressed
        label={t("favourites.remove")}
        onToggle={() => onToggleFavourite(agent)}
      />
    </li>
  );
}

export interface AgentFavouritesProps {
  /** Resolved rows in star order (favourites-utils resolveFavouriteAgents). */
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
  onToggleFavourite: (agent: Agent) => void;
}

export function AgentFavourites({
  agents,
  selectedId,
  onSelect,
  onToggleFavourite,
}: AgentFavouritesProps) {
  const t = useTranslations("agents");
  const headingId = React.useId();

  if (agents.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        id={headingId}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
      >
        <Star aria-hidden="true" className="size-4" />
        {t("favourites.title")}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentFavouriteCard
            key={agent.id}
            agent={agent}
            selected={agent.id === selectedId}
            onSelect={onSelect}
            onToggleFavourite={onToggleFavourite}
          />
        ))}
      </ul>
    </section>
  );
}
