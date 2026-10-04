/**
 * /memory/[ctx]/conflicts — near-duplicate and contradiction resolution for
 * one memory base (agent memory redesign, sub-project 3b). Server: guard +
 * context fetch (mirrors `app/(application)/memory/[ctx]/page.tsx`), then the
 * client shell owns scanning, the list and resolution.
 */
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { guardRoute } from "@/lib/route-guard";

import { GET_MEMORY_BASE } from "../../queries";
import { NotFoundBase } from "../components/base-shell";
import type { MemoryContext } from "../components/memory-list-data";
import { ConflictsShell } from "./components/conflicts-shell";

export default async function MemoryConflictsPage({ params }: { params: Promise<{ ctx: string }> }) {
  const denied = await guardRoute("memory");
  if (denied) return denied;
  const { ctx } = await params;
  const data = (await fetchGraphQLServerSide(GET_MEMORY_BASE.loc?.source.body ?? "", { id: ctx })) as
    | { contextById: MemoryContext | null }
    | null
    | undefined;
  const context = data?.contextById ?? null;
  if (!context) return <NotFoundBase contextId={ctx} />;
  return <ConflictsShell context={context} />;
}
