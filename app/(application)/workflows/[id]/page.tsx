/**
 * /workflows/[id] — Routine workbench (subpage promotion of the inline panel).
 *
 * Server fetch via the route-local GET_WORKFLOW_TEMPLATE_BY_ID (re-imports the
 * existing definition from ../queries — semantically identical, no schema
 * change). Mirrors the agents/edit/[id] server-component pattern exactly:
 * not-found / error → renders <RoutineErrorView/> (client) which owns the
 * EmptyState copy.
 *
 * SERVER-SIDE i18n TRAP (6th-time-this-bites pattern): this file MUST NOT call
 * getTranslations / t() from next-intl/server — the project's
 * getRequestConfig pathway is not wired (the i18n/config.ts is the named-
 * export variant). All UI copy lives in the client wrappers.
 */
import { fetchGraphQLServerSide } from "@/lib/graphql/server";

import { GET_WORKFLOW_TEMPLATE_BY_ID } from "../queries";
import type { Routine } from "../types";
import { RoutineErrorView } from "./components/routine-error-view";
import { RoutineWorkbench } from "./components/routine-workbench";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const data = await fetchGraphQLServerSide(
      GET_WORKFLOW_TEMPLATE_BY_ID.loc?.source.body ?? "",
      { id },
    );

    const routine = data?.workflow_templateById as Routine | undefined;
    if (!routine) {
      return <RoutineErrorView kind="not-found" />;
    }

    return <RoutineWorkbench routine={routine} />;
  } catch (error) {
    return (
      <RoutineErrorView
        kind="error"
        message={error instanceof Error ? error.message : undefined}
      />
    );
  }
}
