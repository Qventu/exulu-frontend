import { type Locale, locales } from "@/i18n/config";

/**
 * Host-based routing: one deployment answering under several hostnames, each
 * showing a different part of the product.
 *
 *   EXULU_PUBLIC_HOST     the hostname customers use. It serves ONLY the public
 *                         surface (/public/*), with `/` showing the published
 *                         agents. Everything else is a 404 there.
 *   EXULU_INTERNAL_HOST   the hostname colleagues use. The whole application,
 *                         except that /public/* is sent to the public host.
 *   EXULU_REDIRECT_HOSTS  comma-separated former hostnames. Every page request
 *                         is redirected to whichever of the two hosts owns the
 *                         path, so links sent out earlier keep working.
 *
 * With EXULU_PUBLIC_HOST unset nothing here applies and every host behaves as
 * it always did.
 *
 * The 404 on the public host is the point of the split, not a nicety. The
 * internal application is otherwise still reachable under the customer
 * hostname — hidden, but one typed path away — and "customers get their own
 * address" would be true of the front page only.
 *
 * The rule is an ALLOWLIST. A new internal route added next year is closed on
 * the public host by default, without anyone remembering this file exists.
 */
export interface HostRoutingConfig {
  publicHost: string | null;
  internalHost: string | null;
  redirectHosts: string[];
}

export type HostDecision =
  | { kind: "next" }
  | { kind: "rewrite"; pathname: string }
  | { kind: "redirect"; host: string }
  | { kind: "notFound" };

/** Where `/` on the public host is served from. */
export const PUBLIC_ROOT_PATHNAME = "/public/agents";

/**
 * Top-level entries of the `public/` directory plus the file routes at the app
 * root. These are served from the site root, so the public pages need them
 * (logo, fonts, the default agent animations). Kept as an explicit list — not
 * "anything with a file extension" — because internal pages can carry a dot in
 * their path too (/artifacts/open/report.pdf). host-routing.test.ts fails when
 * `public/` gains an entry that is missing here.
 */
export const PUBLIC_ASSET_ROOTS = [
  "/agent-idle.json",
  "/agent-responding.json",
  "/agent-world",
  "/ai",
  "/assets",
  "/exulu_logo.svg",
  "/fonts",
  "/favicon.ico",
  "/manifest.webmanifest",
] as const;

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  // A forwarded header can carry a list; the first entry is the client-facing
  // one. Strip the port so "localhost:3000" and a bare hostname compare alike.
  const first = host.split(",")[0]?.trim().toLowerCase() ?? "";
  const withoutPort = first.replace(/:\d+$/, "");
  return withoutPort || null;
}

export function readHostRoutingConfig(
  env: Record<string, string | undefined> = process.env,
): HostRoutingConfig {
  return {
    publicHost: normalizeHost(env.EXULU_PUBLIC_HOST),
    internalHost: normalizeHost(env.EXULU_INTERNAL_HOST),
    redirectHosts: (env.EXULU_REDIRECT_HOSTS ?? "")
      .split(",")
      .map((h) => normalizeHost(h))
      .filter((h): h is string => h !== null),
  };
}

const under = (pathname: string, root: string): boolean =>
  pathname === root || pathname.startsWith(`${root}/`);

/** `/public`, `/public/`, `/public/agents/…` — and nothing that merely starts with the letters. */
export const isPublicSurfacePath = (pathname: string): boolean =>
  under(pathname, "/public");

const isPublicAsset = (pathname: string): boolean =>
  PUBLIC_ASSET_ROOTS.some((root) => under(pathname, root));

export function decideHostRouting(
  host: string | null | undefined,
  pathname: string,
  config: HostRoutingConfig,
): HostDecision {
  const { publicHost, internalHost, redirectHosts } = config;
  const current = normalizeHost(host);
  if (!publicHost || !current) return { kind: "next" };

  if (current === publicHost) {
    if (pathname === "/") return { kind: "rewrite", pathname: PUBLIC_ROOT_PATHNAME };
    if (isPublicSurfacePath(pathname) || isPublicAsset(pathname)) return { kind: "next" };
    return { kind: "notFound" };
  }

  if (internalHost && current === internalHost) {
    // The public surface has one address. Serving it here as well would give
    // every published agent two URLs and leave the customer-facing one
    // reachable through the internal hostname.
    if (isPublicSurfacePath(pathname)) return { kind: "redirect", host: publicHost };
    return { kind: "next" };
  }

  if (redirectHosts.includes(current)) {
    if (isPublicSurfacePath(pathname)) return { kind: "redirect", host: publicHost };
    if (internalHost) return { kind: "redirect", host: internalHost };
    return { kind: "next" };
  }

  // Anything else — localhost, a preview URL, a health check by IP — is left
  // alone. Redirecting unknown hosts would take local development down with it.
  return { kind: "next" };
}

/**
 * The hostnames this deployment answers to, for callers that must not trust an
 * arbitrary Host header (the NextAuth route, once it derives its callback URLs
 * from the request). Null when host routing is off: there is then a single
 * canonical URL and nothing to choose between.
 */
export function knownHosts(
  config: HostRoutingConfig,
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  if (!config.publicHost) return null;
  let canonical: string | null = null;
  try {
    canonical = env.NEXTAUTH_URL ? normalizeHost(new URL(env.NEXTAUTH_URL).host) : null;
  } catch {
    canonical = null;
  }
  return [config.publicHost, config.internalHost, canonical, ...config.redirectHosts].filter(
    (h): h is string => !!h,
  );
}

/**
 * A `?lang=` the server can honour, or null.
 *
 * components/shell/locale-from-query.tsx applies the parameter in the browser,
 * which is too late when the first response is a redirect: the published-agents
 * index redirects to the single agent, that redirects to its sign-in page, and
 * neither carries the query along. A link ending in `?lang=en` then arrived in
 * the default language. The proxy sets the locale cookie on the first response
 * instead, so the choice survives however many redirects follow.
 */
export function localeFromSearch(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const wanted = value.trim().toLowerCase();
  return (locales as readonly string[]).includes(wanted) ? (wanted as Locale) : null;
}
