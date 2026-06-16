/**
 * /data/[ctx]/items/[itemId] — dedicated item detail page (knowledge V2
 * Phase F1). Supersedes the wide Sheet that opened over the Items tab.
 *
 * Thin server shell mirroring the workspace + prompts/[id] pattern: guard
 * the route, fetch the context by id server-side (the client needs its
 * field schema to render typed fields), and hand off to the client wrapper
 * which owns i18n + the item fetch + the edit lifecycle. No
 * `getTranslations` here — the project's next-intl server pathway is not
 * wired (see ../../page.tsx note).
 */

import { GET_CONTEXT_BY_ID } from "@/app/(application)/data/queries";
import { PageShell } from "@/components/primitives/page-shell";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { guardRoute } from "@/lib/route-guard";
import type { Context } from "@/types/models/context";

import { NotFoundView } from "../../components/not-found-view";
import { ItemDetailClient } from "./item-detail-client";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ ctx: string; itemId: string }>;
}) {
  const denied = await guardRoute("knowledge");
  if (denied) return denied;

  const { ctx, itemId } = await params;

  const data = (await fetchGraphQLServerSide(
    GET_CONTEXT_BY_ID.loc?.source.body ?? "",
    { id: ctx },
  )) as { contextById: Context | null } | null | undefined;

  const context = data?.contextById ?? null;

  if (!context) {
    return <NotFoundView contextId={ctx} />;
  }

  return (
    <PageShell variant="content">
      <ItemDetailClient context={context} itemId={itemId} />
    </PageShell>
  );
}
