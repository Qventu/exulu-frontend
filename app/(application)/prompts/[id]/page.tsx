/**
 * /prompts/[id] — full-page detail view (work item 2.9; prompts.md inventory
 * items 55–57). Replaces the legacy half-dead route where Edit was a no-op
 * (`onEdit` undefined) and Delete left the user staring at a deleted prompt.
 *
 * Thin server component: fetches the prompt by id and delegates the page
 * body to client wrappers (PromptDetailClient owns Edit + post-delete
 * redirect AND the breadcrumb-style back link; NotFoundView owns the
 * not-found EmptyState). Keeping next-intl out of this server component is
 * intentional — the project's `next-intl/server` getRequestConfig pathway is
 * not wired (see agents/edit/[id]/page.tsx note), so server pages must not
 * call getTranslations. The `console.log(data)` from the legacy code is
 * REMOVED.
 */

import { PageShell } from "@/components/primitives/page-shell";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { GET_PROMPT_BY_ID } from "@/queries/queries";

import { PromptDetailClient } from "./detail-client";
import { NotFoundView } from "./not-found-view";

interface PromptByIdData {
  prompt_library_itemById: {
    id: string;
    [key: string]: unknown;
  } | null;
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = (await fetchGraphQLServerSide(
    GET_PROMPT_BY_ID.loc?.source.body ?? "",
    { id },
  )) as PromptByIdData | null | undefined;

  const prompt = data?.prompt_library_itemById;

  if (!prompt) {
    return <NotFoundView />;
  }

  return (
    <PageShell variant="content">
      <PromptDetailClient prompt={prompt as never} />
    </PageShell>
  );
}
