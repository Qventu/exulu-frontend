/**
 * Where a legacy `/transcriptions?review=<id>` link goes now that the review
 * sheet is a page.
 *
 * Keeps every other search param. The guided demo tour carries its position
 * as `?tour=`, and dropping it here reset the tour to chapter 1 on step 30.
 */
export function reviewHref(jobId: string, searchParams: URLSearchParams): string {
  const rest = new URLSearchParams(searchParams);
  rest.delete("review");
  const query = rest.toString();
  return `/transcriptions/review/${encodeURIComponent(jobId)}${query ? `?${query}` : ""}`;
}
