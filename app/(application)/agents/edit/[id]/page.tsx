/**
 * /agents/edit/[id] — agent workbench (work item 2.8 editor owner).
 *
 * Server fetch via the edit-local GET_AGENT_EDITOR (fetchGraphQLServerSide
 * pattern kept, item 29). Not-found / error → renders <EditorErrorView/>
 * (client) which owns the EmptyState copy — keeps next-intl out of this
 * server component (the project's i18n/config.ts is the named-export
 * variant; the `next-intl/server` getRequestConfig pathway is not wired in
 * this codebase, so server pages must not call getTranslations).
 */

import { fetchGraphQLServerSide } from "@/lib/graphql/server";

import { EditorErrorView } from "./components/editor-error-view";
import { EditorView } from "./components/editor-view";
import { GET_AGENT_EDITOR } from "./queries";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const data = await fetchGraphQLServerSide(
      GET_AGENT_EDITOR.loc?.source.body || "",
      { id },
    );

    if (!data?.agentById) {
      return <EditorErrorView kind="not-found" />;
    }

    return <EditorView agent={data.agentById} />;
  } catch (error) {
    return (
      <EditorErrorView
        kind="error"
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }
}
