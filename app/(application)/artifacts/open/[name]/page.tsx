/**
 * /artifacts/open/[name] — the in-shell artifact viewer.
 *
 * The published share route (`app/artifacts/[artifact_name]`) renders an
 * artifact full-screen with its own root layout, for people who follow a
 * link. This page renders the same artifact inside the IMP shell (sidebar,
 * top bar, nav) and otherwise follows the share route step for step: meta
 * first, then the viewer's credential (session JWT for `regular`, the
 * share-password cookie for `password`, nothing for `public`), then the HTML
 * is fetched server-side so the frame can use `srcDoc` — the global
 * X-Frame-Options: DENY would block a frame that loads the content route
 * itself. Non-HTML artifacts are fetched by the client component as a blob.
 *
 * This is also the only route with an agent panel, so it carries the panel's
 * server-side data: the agent slots assigned to the artifact joined to the
 * agents the viewer can actually reach, and the conversation `?session=` asks
 * for. That load is kicked off after the credential step and awaited after
 * the content fetch, so it overlaps the artifact's round trip instead of
 * being added to it — the meta → credential → content sequence above is
 * unchanged.
 */
import type { UIMessage } from "ai";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import type { AgentSlot } from "@/lib/api/shared-artifacts";
import { withFragmentNavFix } from "@/lib/artifacts/fragment-nav";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import {
  GET_AGENTS_BY_IDS,
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
} from "@/queries/queries";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

import { choosePanelState, resolveSlots, type ResolvedSlot } from "./resolve-slots";
import { ArtifactViewer, type ViewerStatus } from "./viewer-client";

export const dynamic = "force-dynamic";

type Meta = {
  auth_mode: "public" | "password" | "regular";
  filename: string;
  is_html: boolean;
};

/** Everything the agent panel needs, or the "nothing is offered" shape below. */
type PanelData = {
  slots: ResolvedSlot[];
  initialSlotKey: string | null;
  initialSession: AgentSession | null;
  initialMessages: UIMessage[];
};

const NO_PANEL: PanelData = {
  slots: [],
  initialSlotKey: null,
  initialSession: null,
  initialMessages: [],
};

/** The first value of a repeated query parameter; `?agent=a&agent=b` is not a thing. */
const one = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * The first 50 messages of a session, oldest last out of the query and
 * reversed into display order — the same transform
 * `chat/[agent]/[session]/page.tsx` applies, deliberately: the panel mounts
 * the same `SessionScreen`.
 */
async function loadSessionMessages(session: string): Promise<UIMessage[]> {
  const history = await fetchGraphQLServerSide(
    GET_AGENT_MESSAGES.loc?.source.body || "",
    {
      page: 1,
      limit: 50,
      sort: { field: "createdAt", direction: "DESC" },
      filters: { session: { eq: session } },
    },
  );
  const items = history?.agent_messagesPagination?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item: { content: string }) => JSON.parse(item.content))
    .reverse();
}

/**
 * The agent panel's server-side data: which slots this viewer may be offered,
 * which one the URL addresses, and the conversation to open with.
 *
 * **Never rejects.** The caller starts this before the content fetch and does
 * not await it on the error paths, so a rejection would surface as an
 * unhandled one; and the product rule is the same shape anyway — an agent the
 * viewer cannot reach degrades to "not offered", never to an error, and a
 * panel route that is down costs the CTA rather than the artifact.
 */
async function loadPanelData(
  base: string,
  credHeaders: Record<string, string>,
  url: { agent?: string; session?: string },
): Promise<PanelData> {
  try {
    // The slots come from /panel, not /meta: /meta is fetched with no
    // credentials at all, so slots there would publish agent ids to anyone
    // holding the share name. /panel authenticates and runs the same access
    // check as /content.
    const slotsRes = await fetch(`${base}/panel`, { headers: credHeaders, cache: "no-store" });
    if (!slotsRes.ok) return NO_PANEL;
    const stored = ((await slotsRes.json())?.agent_slots ?? []) as AgentSlot[];
    const ids = [...new Set(stored.map((slot) => slot?.agentId).filter(Boolean))];
    // Most artifacts have no assignments, and this is the branch they take:
    // no agents query is issued at all.
    if (ids.length === 0) return NO_PANEL;

    // By id, not the paginated list: `GET_AGENTS` would have to be capped
    // (the chat page uses 200), and an agent outside that page would make its
    // slot vanish with no error anywhere. `agentByIds` is RBAC-scoped like
    // every other generic resolver, so reachability filtering still happens
    // server-side — an agent the viewer may not read is absent from the
    // result and resolveSlots drops its slot. It asks for exactly the agents
    // the slots name, so it cannot be short.
    const agentsData = await fetchGraphQLServerSide(
      GET_AGENTS_BY_IDS.loc?.source.body || "",
      { ids },
    );
    const agents = (agentsData?.agentByIds ?? []) as Agent[];
    const slots = resolveSlots(stored, agents);
    if (slots.length === 0) return NO_PANEL;

    // Only when the URL names one — a page without `?session=` must not pay
    // for a session query.
    let session: AgentSession | null = null;
    if (url.session) {
      const sessionData = await fetchGraphQLServerSide(
        GET_AGENT_SESSION_BY_ID.loc?.source.body || "",
        { id: url.session },
      );
      // Also RBAC-scoped (resolvers/index.ts applies access control to every
      // `*ById`), so a session belonging to another user comes back null and
      // the panel opens a new chat instead — the first half of "never render
      // someone else's conversation". The second half (the user's own
      // session, but another agent's) is choosePanelState's `keep`.
      session = (sessionData?.agent_sessionById ?? null) as AgentSession | null;
    }

    const { initialSlotKey, keep } = choosePanelState({ slots, session, urlAgent: url.agent });
    return {
      slots,
      initialSlotKey,
      initialSession: keep ? session : null,
      // Fetched only once the session is known to be one this viewer will be
      // shown: a conversation that is going to be discarded must not be
      // loaded into the page's payload at all.
      initialMessages: keep && url.session ? await loadSessionMessages(url.session) : [],
    };
  } catch {
    return NO_PANEL;
  }
}

export default async function ArtifactOpenPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  /** `?agent=<slotKey>` (a deep link from outside) and `?session=<id>` (the panel's own URL state). */
  searchParams: Promise<{ agent?: string | string[]; session?: string | string[] }>;
}) {
  const { name } = await params;
  const query = await searchParams;
  const backend = process.env.BACKEND;
  if (!backend) return <ArtifactViewer name={name} filename={name} authMode="regular" status="error" />;

  const base = `${backend}/shared-artifacts/${encodeURIComponent(name)}`;
  const metaRes = await fetch(`${base}/meta`, { cache: "no-store" });
  const failed = (status: ViewerStatus) => <ArtifactViewer name={name} filename={name} authMode="regular" status={status} />;
  if (metaRes.status === 404) return failed("notFound");
  if (metaRes.status === 410) return failed("expired");
  if (!metaRes.ok) return failed("error");
  const meta = (await metaRes.json()) as Meta;

  const credHeaders: Record<string, string> = {};
  if (meta.auth_mode === "regular") {
    const user = await serverSideAuthCheck();
    if (!user) redirect(`/login?destination=/artifacts/open/${encodeURIComponent(name)}`);
    const session: any = await getServerSession(await getAuthOptions());
    const jwt = session?.user?.jwt as string | undefined;
    if (!jwt) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="noAccess" />;
    credHeaders["Authorization"] = `Bearer ${jwt}`;
  } else if (meta.auth_mode === "password") {
    const pw = (await cookies()).get(`share_pw_${name}`)?.value;
    // Without the share-password cookie the viewer cannot read the content;
    // the share link carries the password gate, so the viewer points there.
    if (!pw) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="password" />;
    credHeaders["x-share-password"] = pw;
  }

  // Started here, awaited after the content fetch below, so the panel's round
  // trips overlap the artifact's. Only `regular` HTML artifacts can have a
  // panel: a public or password share has no viewer session for the chat to
  // run as, and anything that is not an app has no frame to sit beside.
  const panel =
    meta.auth_mode === "regular" && meta.is_html
      ? loadPanelData(base, credHeaders, { agent: one(query.agent), session: one(query.session) })
      : null;

  const contentStatus = (status: number): ViewerStatus | null => {
    if (status === 401) return meta.auth_mode === "password" ? "password" : "noAccess";
    if (status === 403) return "noAccess";
    if (status === 404) return "notFound";
    if (status === 410) return "expired";
    return null;
  };

  if (meta.is_html) {
    const contentRes = await fetch(`${base}/content`, { headers: credHeaders, cache: "no-store" });
    if (!contentRes.ok) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status={contentStatus(contentRes.status) ?? "error"} />;
    const html = await contentRes.text();
    return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="ready" html={withFragmentNavFix(html)} {...((await panel) ?? NO_PANEL)} />;
  }

  // Non-HTML: confirm access here so the client never starts a blob fetch
  // (or a download) that is going to be refused.
  if (meta.auth_mode !== "public") {
    const check = await fetch(`${base}/content`, { headers: credHeaders, cache: "no-store" });
    await check.body?.cancel();
    if (!check.ok) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status={contentStatus(check.status) ?? "error"} />;
  }
  return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="ready" />;
}
