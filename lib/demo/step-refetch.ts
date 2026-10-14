/**
 * Whether a change of `?tour=` must refetch every active query.
 *
 * The demo link answers from `getWorld(getCurrentPosition())` at request
 * time, so a new step IS a new world — but the product's `cache-first`
 * queries (/data's context list, for one) never ask again when only the
 * query string changes on the same route. Chapter 2's list stayed empty for
 * three steps because of this.
 *
 * `undefined` for `previous` means the first render: nothing is stale yet,
 * and refetching there would double every query on every page load.
 */
export function shouldRefetch(
  previous: string | null | undefined,
  next: string | null,
): boolean {
  if (previous === undefined) return false;
  return previous !== next;
}
