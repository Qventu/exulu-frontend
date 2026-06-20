/**
 * Pure helpers for the per-user item pins (Favourites + Recently Viewed).
 *
 * Kept free of React/Apollo imports so the list logic — global-id encoding and
 * the prepend / de-dupe / cap rules — is unit-testable in isolation (the hooks
 * in ./hooks.ts re-export and consume these).
 */

/** Server-side cap mirrored client-side; oldest recents evicted past this. */
export const RECENTLY_VIEWED_CAP = 5;

/** Build the global id used to pin an item across contexts. */
export function itemGlobalId(contextId: string, itemId: string): string {
  return `${contextId}/${itemId}`;
}

/** Split a global id back into context + item parts (null if malformed). */
export function parseItemGlobalId(
  globalId: string,
): { contextId: string; itemId: string } | null {
  const slash = globalId.indexOf("/");
  if (slash === -1) return null;
  const contextId = globalId.slice(0, slash);
  const itemId = globalId.slice(slash + 1);
  if (!contextId || !itemId) return null;
  return { contextId, itemId };
}

/**
 * Next favourites list for a toggle: remove if present, else prepend
 * (most-recently-favourited first).
 */
export function computeNextFavourites(
  base: readonly string[],
  globalId: string,
): string[] {
  return base.includes(globalId)
    ? base.filter((id) => id !== globalId)
    : [globalId, ...base];
}

/**
 * Next recents list after viewing an item: move-to-front, de-duped, capped.
 * Returns the same reference semantics as a fresh array (callers compare by
 * value); viewing the already-most-recent item yields an equivalent list.
 */
export function computeNextRecents(
  base: readonly string[],
  globalId: string,
  cap: number = RECENTLY_VIEWED_CAP,
): string[] {
  return [globalId, ...base.filter((id) => id !== globalId)].slice(0, cap);
}
