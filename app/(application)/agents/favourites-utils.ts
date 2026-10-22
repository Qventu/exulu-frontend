/**
 * Pure helpers behind the /agents favourites (star) feature — kept free of
 * React/Apollo so the ordering and toggle rules are unit-testable.
 *
 * Favourite ids live on the user row (`users.favourite_agents`, a JSON array
 * of agent ids — the same shape as `favourite_projects`, see
 * projects/hooks.ts useFavoriteProjects). The order of that array is the
 * order the cards render in: a user's "quick access" row should not reshuffle
 * under them, so a new star is appended, never prepended.
 */

import type { Agent } from "@/types/models/agent";

/** Next favourites list after starring/un-starring one agent. Pure. */
export function toggleFavouriteId(
  base: readonly string[],
  agentId: string,
): string[] {
  return base.includes(agentId)
    ? base.filter((id) => id !== agentId)
    : [...base, agentId];
}

/**
 * Rows for the favourites cards, in star order. The by-ids query is the
 * source of truth; rows already on screen from the paginated index fill in
 * while it resolves (starring never makes a card flash in late). Ids that
 * resolve nowhere — deleted agents, or agents the user lost access to — are
 * simply not rendered; they age out when the user un-stars them.
 */
export function resolveFavouriteAgents(
  favouriteIds: readonly string[],
  fromQuery: readonly Agent[],
  fromIndex: readonly Agent[],
): Agent[] {
  const byQuery = new Map(fromQuery.map((row) => [row.id, row] as const));
  const byIndex = new Map(fromIndex.map((row) => [row.id, row] as const));
  return favouriteIds
    .map((id) => byQuery.get(id) ?? byIndex.get(id))
    .filter((row): row is Agent => row !== undefined);
}
