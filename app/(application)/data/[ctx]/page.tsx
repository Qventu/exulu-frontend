/**
 * /data/[ctx] — Knowledge workspace (work item 2.11). Server component
 * mirrors the prompts/[id] and agents/edit/[id] pattern: guard the route,
 * fetch the context by id, hand off to a client wrapper (workspace-shell)
 * which owns all i18n and stateful UI.
 *
 * The project's next-intl `getRequestConfig` is not wired (see
 * agents/edit/[id]/page.tsx + prompts/[id]/page.tsx notes), so server
 * pages MUST NOT call `getTranslations` — all copy lives in client
 * wrappers.
 */

import { GET_CONTEXT_BY_ID } from "@/app/(application)/data/queries";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { guardRoute } from "@/lib/route-guard";
import type { Context } from "@/types/models/context";

import { NotFoundView } from "./components/not-found-view";
import { WorkspaceShell } from "./components/workspace-shell";

interface SearchParamsShape {
  tab?: "items" | "pipeline";
  view?: "active" | "archived";
  item?: string;
  page?: string;
  search?: string;
  new?: string;
  filters?: string;
}

export default async function ContextWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ ctx: string }>;
  searchParams: Promise<SearchParamsShape>;
}) {
  const denied = await guardRoute("knowledge");
  if (denied) return denied;

  const { ctx } = await params;
  const sp = await searchParams;

  const data = (await fetchGraphQLServerSide(
    GET_CONTEXT_BY_ID.loc?.source.body ?? "",
    { id: ctx },
  )) as { contextById: Context | null } | null | undefined;

  const context = data?.contextById ?? null;

  if (!context) {
    return <NotFoundView contextId={ctx} />;
  }

  return <WorkspaceShell context={context} searchParams={sp} />;
}
