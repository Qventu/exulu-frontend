/**
 * The routes the guided demo has fixtures for.
 *
 * The demo user is a super-admin (lib/demo/user.ts), which is the honest
 * portrayal — the person evaluating IMP would be one — but it also opens every
 * entry in the sidebar, including the nine the tour never visits. Those are
 * backed by GraphQL operations the resolver table does not map, so they used
 * to render as empty shells: a prospect clicking around found a product that
 * looked half-built.
 *
 * The sidebar deliberately still shows them. Hiding entries would understate
 * what IMP does; an entry that says why it is quiet in a demo does not.
 *
 * This is an allowlist rather than a denylist because the failure directions
 * are not symmetric. A route missing from an allowlist says "not in the demo"
 * about something that works — mildly embarrassing, and the test below catches
 * it for anything the tour actually visits. A route missing from a DENYlist
 * renders an empty shell and quietly argues the product is broken.
 */

export const DEMO_SUPPORTED_ROUTES = [
  // The entry point. Present because "/" REDIRECTS to the tour's first step
  // (app/(application)/(home)/page.tsx) — and a page whose children the layout
  // has replaced never runs, so an absent "/" would swap the notice in for the
  // redirect and dead-end the demo's own URL. The matcher below is
  // boundary-based, so this entry does not match everything.
  "/",
  "/chat",
  "/data",
  "/agents",
  "/evals",
  "/workflows",
  "/transcriptions",
  "/projects",
  "/prompts",
  "/settings",
  // Reachable from the knowledge library's empty state (LibraryEmpty's
  // action links here), which chapter 2 (`struktur`, `struktur-empty`)
  // deliberately renders on /data with zero contexts. Shepherd's overlay
  // does not block clicks, so without this a visitor could one-click onto
  // the "not available in this demo" notice and lose their `?tour=`
  // position on the tour's second chapter.
  "/explorer",
] as const;

/**
 * True when `pathname` is a supported route or one of its descendants.
 *
 * Matching is on segment boundaries, never bare prefixes: `/agents` must not
 * admit `/agentsomething`, and `/data` must not admit `/datasets`.
 */
export function isDemoSupported(pathname: string): boolean {
  const decoded = decodePathname(pathname);

  // A trailing slash is the same route. Left alone it defeats the exact-match
  // arm ("/agents/" !== "/agents") and falls through to the boundary arm as
  // "/agents/".startsWith("/agents/") — which happens to pass, but by accident
  // rather than by rule. Normalising makes both arms mean what they say.
  const path = decoded.length > 1 ? decoded.replace(/\/+$/, "") : decoded;

  return DEMO_SUPPORTED_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
}

/**
 * Accepts a percent-encoded pathname as well as a plain one.
 *
 * The only pathname a server component in this app can reach is the
 * `x-next-pathname` header, and proxy.ts writes it `encodeURIComponent`'d —
 * because the (application) layout's other consumer interpolates it into
 * `/login?destination=...`, where it must be encoded. So the realistic caller
 * holds "%2Fagents", not "/agents".
 *
 * Every route then failed to match, the layout swapped in the unavailable
 * notice everywhere, and because "/" failed too the entry redirect never got
 * a page to run. Rejecting the input would have been defensible and would
 * have left the same trap armed for the next caller.
 *
 * decodeURIComponent throws on a malformed sequence ("%"), which a crafted URL
 * can produce — hence the catch. An undecodable path is simply not one of ours.
 */
function decodePathname(pathname: string): string {
  if (!pathname.includes("%")) return pathname;
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
