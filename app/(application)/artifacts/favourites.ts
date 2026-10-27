/**
 * The starred artifacts, in star order, resolved against the list the viewer
 * may see. Pure, so the ordering rule is unit-testable (same shape as
 * lib/agents/favourites.ts, keyed by share name instead of id).
 */
export function orderFavouriteArtifacts<T extends { name: string }>(
  favouriteNames: readonly string[],
  items: readonly T[],
): T[] {
  const byName = new Map(items.map((item) => [item.name, item] as const));
  return favouriteNames
    .map((name) => byName.get(name))
    .filter((item): item is T => item !== undefined);
}
